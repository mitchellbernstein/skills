#!/usr/bin/env node
// orchestrate (Claude Code route): plan/state/handoff bookkeeping for a tree of
// Claude Code subagents. Port of cursor/plugins orchestrate scripts/cli.ts
// (Cursor, MIT). The upstream script spawned Cursor cloud agents itself; here
// the planner spawns subagents with the Agent tool and this script owns
// everything else: plan validation, ready-set computation, prompt rendering,
// handoff capture and parsing, measurement re-runs, failure sidecars, Andon,
// and optional Slack mirroring. Node >= 18, no dependencies.
//
// Usage: node orch.mjs <command> <workspace> [args]   (node orch.mjs help)

import { execFileSync, spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(SCRIPT_DIR, "..");
const PROMPTS_DIR = join(SKILL_DIR, "prompts");

const TASK_NAME_RE = /^[a-z0-9-]+$/;
const TASK_TYPES = ["worker", "subplanner", "verifier"];
const VERIFICATION_VALUES = [
  "live-ui-verified",
  "unit-test-verified",
  "type-check-only",
  "verifier-blocked",
  "verifier-failed",
  "not-verified",
];
const FAILURE_MODES = ["cap-hit", "oom", "tool-error", "network-drop", "unknown"];
const TERMINAL = new Set(["handed-off", "error", "cancelled", "pruned"]);
const MEASUREMENT_DEFAULT_TOLERANCE = 0.1;
const MEASUREMENT_TIMEOUT_MS = 5 * 60_000;
const DEFAULT_MODELS = { worker: "sonnet", verifier: "opus", subplanner: "opus" };
const AGENT_TYPES = {
  worker: "orchestrate-worker",
  verifier: "orchestrate-verifier",
  subplanner: "orchestrate-subplanner",
};

const PLAN_KEYS = new Set([
  "$schema", "goal", "summary", "dispatcher", "rootSlug", "baseBranch", "prBase",
  "repoUrl", "acceptanceCriteria", "syncStateToGit", "push", "slackChannel",
  "slackKickoffRef", "andonStateRef", "andonStatePath", "selfAgentId", "tasks",
]);
const TASK_KEYS = new Set([
  "name", "type", "scopedGoal", "brief", "pathsAllowed", "pathsForbidden",
  "acceptance", "verify", "startingRef", "dependsOn", "model", "maxAttempts",
  "openPR", "measurements", "slackTs", "verifies",
]);

class UsageError extends Error {}

// ---------- io ----------

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function atomicWrite(path, body) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp.${process.pid}`;
  writeFileSync(tmp, body);
  renameSync(tmp, path);
}

function nowIso() {
  return new Date().toISOString();
}

function truncate(s, n) {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function readInput(pathOrDash) {
  if (pathOrDash === "-" || pathOrDash === undefined) return readFileSync(0, "utf8");
  return readFileSync(pathOrDash, "utf8");
}

// ---------- workspace ----------

class Workspace {
  constructor(dir) {
    this.dir = resolve(dir);
    this.planPath = join(this.dir, "plan.json");
    this.statePath = join(this.dir, "state.json");
    this.handoffsDir = join(this.dir, "handoffs");
    this.promptsDir = join(this.dir, "prompts");
    this.attentionPath = join(this.dir, "attention.log");
    if (!existsSync(this.planPath)) {
      throw new UsageError(
        `missing ${this.planPath}: the planner writes plan.json first (see references/planner.md, Phase 1)`,
      );
    }
    this.plan = readJson(this.planPath);
    const errors = validatePlan(this.plan);
    if (errors.length > 0) {
      throw new UsageError(`plan.json invalid:\n  - ${errors.join("\n  - ")}`);
    }
    this.state = existsSync(this.statePath)
      ? readJson(this.statePath)
      : { version: 1, rootSlug: this.plan.rootSlug, tasks: [] };
    this.reconcile();
  }

  get tasks() {
    return this.plan.tasks ?? [];
  }

  def(name) {
    return this.tasks.find((t) => t.name === name);
  }

  row(name) {
    return this.state.tasks.find((t) => t.name === name);
  }

  requireRow(name) {
    const r = this.row(name);
    if (!r) throw new UsageError(`unknown task: ${name}`);
    return r;
  }

  plannedBranch(t) {
    const slice = mergeSlice(t);
    return slice ? `orch/${this.plan.rootSlug}/${slice}` : `orch/${this.plan.rootSlug}/${t.name}`;
  }

  branchFor(t) {
    const r = this.row(t.name);
    return r?.branch?.trim() ? r.branch.trim() : this.plannedBranch(t);
  }

  startingRefFor(t) {
    if (t.startingRef) return t.startingRef;
    if (t.type === "verifier") {
      const target = this.def(t.verifies);
      return target ? this.branchFor(target) : this.plan.baseBranch;
    }
    return this.plan.baseBranch;
  }

  // Bring state.json in line with plan.json: new tasks become pending rows,
  // removed ones are pruned, verifier startingRefs follow their target's
  // recorded branch.
  reconcile() {
    const t = nowIso();
    for (const def of this.tasks) {
      if (!this.row(def.name)) {
        this.state.tasks.push({
          name: def.name,
          type: def.type,
          branch: this.plannedBranch(def),
          startingRef: this.startingRefFor(def),
          dependsOn: normalizedDependsOn(def),
          agentId: null,
          parentAgentId: this.plan.selfAgentId ?? null,
          status: "pending",
          resultStatus: null,
          handoffPath: null,
          startedAt: null,
          finishedAt: null,
          lastUpdate: t,
          note: null,
          attempts: 0,
          verification: null,
          failureMode: null,
        });
      } else {
        const r = this.row(def.name);
        r.dependsOn = normalizedDependsOn(def);
        r.type = def.type;
        if (r.status === "pending") r.startingRef = this.startingRefFor(def);
      }
    }
    for (const r of this.state.tasks) {
      if (!this.def(r.name) && !r.adHoc && r.status !== "pruned") {
        r.status = "pruned";
        r.note = "orphaned: removed from plan.json; auto-pruned on load";
        r.lastUpdate = t;
        this.attention(`${r.name}: auto-pruned because it was removed from plan.json`);
      }
    }
  }

  save() {
    atomicWrite(this.statePath, `${JSON.stringify(this.state, null, 2)}\n`);
  }

  attention(msg) {
    mkdirSync(this.dir, { recursive: true });
    appendFileSync(this.attentionPath, `${nowIso()} ${msg}\n`);
  }

  depsSatisfied(row) {
    return (row.dependsOn ?? []).every((d) => this.row(d)?.status === "handed-off");
  }

  andon() {
    const local = this.state.andon;
    if (local?.raisedAt && !local.cleared) return local;
    const p = this.plan.andonStatePath;
    if (p && existsSync(p) && resolve(p) !== this.statePath) {
      try {
        const root = readJson(p).andon;
        if (root?.raisedAt && !root.cleared) return root;
      } catch {
        // unreadable root state: treat as no Andon, the root owns it
      }
    }
    return null;
  }

  readHandoff(name) {
    const p = join(this.handoffsDir, `${name}.md`);
    return existsSync(p) ? readFileSync(p, "utf8") : null;
  }
}

function mergeSlice(t) {
  if (t.type !== "worker") return null;
  const m = /^merge-(.+)$/.exec(t.name);
  return m ? m[1] : null;
}

function normalizedDependsOn(t) {
  const deps = [...(t.dependsOn ?? [])];
  if (t.type === "verifier" && t.verifies && !deps.includes(t.verifies)) deps.unshift(t.verifies);
  return deps;
}

// ---------- validation (mirrors upstream schemas.ts) ----------

function validatePlan(plan) {
  const e = [];
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return ["plan.json must be an object"];
  for (const k of Object.keys(plan)) if (!PLAN_KEYS.has(k)) e.push(`unknown plan field: ${k}`);
  if (typeof plan.goal !== "string" || !plan.goal.trim()) e.push("goal: required non-empty string");
  if (typeof plan.rootSlug !== "string" || !TASK_NAME_RE.test(plan.rootSlug)) e.push("rootSlug: must be kebab-case ascii");
  if (typeof plan.baseBranch !== "string" || !plan.baseBranch.trim()) e.push("baseBranch: required non-empty string");
  if (plan.repoUrl !== undefined && typeof plan.repoUrl !== "string") e.push("repoUrl: must be a string");
  const tasks = plan.tasks;
  if (!Array.isArray(tasks) || tasks.length === 0) {
    e.push("tasks: must be a non-empty array");
    return e;
  }
  const names = new Set();
  tasks.forEach((t, i) => {
    const at = `tasks[${i}]`;
    if (!t || typeof t !== "object") {
      e.push(`${at}: must be an object`);
      return;
    }
    for (const k of Object.keys(t)) if (!TASK_KEYS.has(k)) e.push(`${at}: unknown field ${k}`);
    if (typeof t.name !== "string" || !TASK_NAME_RE.test(t.name)) e.push(`${at}.name: must be kebab-case ascii`);
    if (names.has(t.name)) e.push(`${at}.name: duplicate task name: ${t.name}`);
    names.add(t.name);
    if (!TASK_TYPES.includes(t.type)) e.push(`${at}.type: must be one of ${TASK_TYPES.join(", ")}`);
    if (typeof t.scopedGoal !== "string" || !t.scopedGoal.trim()) e.push(`${at}.scopedGoal: required non-empty string`);
    if (t.type === "verifier") {
      if (typeof t.verifies !== "string" || !TASK_NAME_RE.test(t.verifies)) e.push(`${at}.verifies: required kebab-case task name`);
    } else if (t.verifies !== undefined) {
      e.push(`${at}.verifies: is only valid when type is verifier`);
    }
    for (const k of ["pathsAllowed", "pathsForbidden", "acceptance", "dependsOn"]) {
      if (t[k] !== undefined && (!Array.isArray(t[k]) || t[k].some((x) => typeof x !== "string"))) e.push(`${at}.${k}: must be an array of strings`);
    }
    if (t.maxAttempts !== undefined && !(Number.isInteger(t.maxAttempts) && t.maxAttempts >= 1)) e.push(`${at}.maxAttempts: integer >= 1`);
    if (t.measurements !== undefined) {
      if (!Array.isArray(t.measurements)) e.push(`${at}.measurements: must be an array`);
      else
        t.measurements.forEach((m, j) => {
          if (!m?.name || !m?.command) e.push(`${at}.measurements[${j}]: name and command are required`);
          if (m?.parser && !["wc-l", "regex"].includes(m.parser.kind)) e.push(`${at}.measurements[${j}].parser.kind: wc-l or regex`);
          if (m?.toleranceFraction !== undefined && !(m.toleranceFraction >= 0 && m.toleranceFraction <= 1)) e.push(`${at}.measurements[${j}].toleranceFraction: 0..1`);
        });
    }
  });
  const byName = new Map(tasks.map((t) => [t.name, t]));
  tasks.forEach((t, i) => {
    if (t.type === "verifier") {
      if (t.verifies === t.name) e.push(`tasks[${i}].verifies: verifier task cannot verify itself`);
      else if (t.verifies && !byName.has(t.verifies)) e.push(`tasks[${i}].verifies: verifies unknown task: ${t.verifies}`);
    }
    for (const d of normalizedDependsOn(t)) {
      if (d === t.name) e.push(`tasks[${i}].dependsOn: task dependsOn itself`);
      else if (!byName.has(d)) e.push(`tasks[${i}].dependsOn: dependsOn unknown task: ${d}`);
    }
  });
  const color = new Map(tasks.map((t) => [t.name, 0]));
  const visit = (name, path) => {
    const c = color.get(name);
    if (c === 1) {
      e.push(`dependsOn cycle: ${[...path.slice(path.indexOf(name)), name].join(" -> ")}`);
      return;
    }
    if (c === 2) return;
    color.set(name, 1);
    for (const d of normalizedDependsOn(byName.get(name) ?? {})) if (byName.has(d)) visit(d, [...path, name]);
    color.set(name, 2);
  };
  for (const t of tasks) visit(t.name, []);
  return e;
}

// ---------- prompts ----------

const templateCache = new Map();

function renderTemplate(name, vars) {
  let tpl = templateCache.get(name);
  if (tpl === undefined) {
    tpl = readFileSync(join(PROMPTS_DIR, `${name}.md`), "utf8");
    templateCache.set(name, tpl);
  }
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{{${k}}}`, v);
  const left = [...out.matchAll(/{{([^{}]+)}}/g)].map((m) => m[1].trim());
  if (left.length > 0) throw new UsageError(`template "${name}" has unrendered placeholders: ${[...new Set(left)].join(", ")}`);
  return out;
}

function list(items, prefix, empty) {
  return (items ?? []).map((x) => `  ${prefix}${x}`).join("\n") || `  ${empty}`;
}

function verifyBlock(t, heading) {
  return t?.verify?.trim() ? `\n\n${heading}\n\n${t.verify}\n` : "";
}

function scopedGoalWithBrief(t) {
  const brief = t.brief?.trim();
  return brief ? `Task brief:\n\n${brief}\n\n${t.scopedGoal}` : t.scopedGoal;
}

function upstreamSection(ws, t) {
  const deps = normalizedDependsOn(t);
  if (deps.length === 0) return "";
  const chunks = deps.map((dep) => {
    const body = ws.readHandoff(dep);
    if (!body) return `### Upstream: \`${dep}\`\n\n_(no handoff on disk; planner spawned this task without waiting; treat as missing context)_`;
    return `### Upstream: \`${dep}\`\n\n${body.replace(/^<!--[\s\S]*?-->\s*/, "").trim()}`;
  });
  return `\n\nUpstream handoffs (context from tasks you depend on; this is the only summary you get of their work, though their branches are readable in this repository):\n\n${chunks.join("\n\n---\n\n")}\n\n`;
}

function scriptCmd() {
  return `node ${JSON.stringify(join(SCRIPT_DIR, "orch.mjs"))}`;
}

function slackBlock(ws, t) {
  const ref = ws.plan.slackKickoffRef;
  if (!ref) return "";
  const andon = renderTemplate("andon-block", { orch: scriptCmd(), workspace: ws.dir });
  return renderTemplate("slack-block", {
    orch: scriptCmd(),
    workspace: ws.dir,
    taskName: t.name,
    channel: ref.channel,
    threadTs: ref.ts,
  }) + andon;
}

function pushLine(ws, t) {
  if (t.openPR) return `\n- Push \`${ws.branchFor(t)}\` to \`origin\` after your last commit (needed for the PR below).`;
  if (ws.plan.push) return `\n- Push \`${ws.branchFor(t)}\` to \`origin\` after your last commit.`;
  return "\n- Do not push. The branch is shared with the planner through this repository's git directory.";
}

function mergeDiscipline(ws, t) {
  const slice = mergeSlice(t);
  if (!slice) return "";
  const sources = (t.dependsOn ?? [])
    .map((d) => ws.def(d))
    .filter((d) => d && d.type === "worker" && !mergeSlice(d))
    .map((d) => ws.branchFor(d));
  return `
- This is a merge worker for slice \`${slice}\`.
- Merge dependency branches into \`${ws.branchFor(t)}\` one at a time, in \`dependsOn\` order.
- Source branches:
${sources.length ? sources.map((b) => `  - ${b}`).join("\n") : "  - (none)"}`;
}

function buildPrompt(ws, name) {
  const t = ws.def(name);
  if (!t) throw new UsageError(`unknown task: ${name}`);
  const accept = list(t.acceptance, "- [ ] ", "(none declared)");
  const common = {
    goal: ws.plan.goal,
    scopedGoal: scopedGoalWithBrief(t),
    accept,
    upstream: upstreamSection(ws, t),
    slackBlock: slackBlock(ws, t),
    startingRef: ws.startingRefFor(t),
    branch: ws.branchFor(t),
  };
  if (t.type === "worker") {
    const prBase = ws.plan.prBase ?? ws.plan.baseBranch;
    return renderTemplate("worker", {
      ...common,
      allow: list(t.pathsAllowed, "- ", "(none declared; ask before touching anything broad)"),
      forbid: list(t.pathsForbidden, "- ", "(none)"),
      verifyPlan: verifyBlock(t, "Verification plan (how the planner / a verifier will check your work):"),
      pushDiscipline: pushLine(ws, t),
      mergeDiscipline: mergeDiscipline(ws, t),
      prDiscipline: t.openPR
        ? `- Keep \`.orchestrate/\` files out of the PR diff.\n- After pushing, open a draft pull request: \`gh pr create --draft --base ${prBase} --head ${ws.branchFor(t)}\` with a title and body that summarize your handoff. Do NOT merge, rebase, or close it. The planner owns integration.`
        : "- Do NOT merge, rebase, or open a PR. The planner owns integration.",
    });
  }
  if (t.type === "verifier") {
    const target = ws.def(t.verifies);
    return renderTemplate("verifier", {
      ...common,
      targetName: t.verifies,
      targetType: target?.type ?? "(unknown)",
      targetBranch: target ? ws.branchFor(target) : `(unknown branch for ${t.verifies})`,
      targetGoal: target?.scopedGoal ?? "(target task missing from plan)",
      targetAccept: list(target?.acceptance, "- ", "(none declared)"),
      targetVerifyPlan: verifyBlock(target, "Verification plan authored for the target (follow this as your recipe):"),
      ownVerifyPlan: verifyBlock(t, "Your own verification plan (planner-authored for this verifier task):"),
    });
  }
  const root = ws.andonRootStatePath();
  return renderTemplate("subplanner", {
    ...common,
    name: t.name,
    allow: list(t.pathsAllowed, "- ", "(none declared)"),
    forbid: list(t.pathsForbidden, "- ", "(none)"),
    verifyPlan: verifyBlock(t, "Verification plan (how the planner / a verifier will check your work):"),
    workspace: join(dirname(ws.dir), t.name),
    baseBranch: ws.startingRefFor(t),
    andonStatePath: root,
    orch: scriptCmd(),
    skillDir: SKILL_DIR,
    modelCatalog: modelCatalog(),
    loopHygiene: renderTemplate("loop-hygiene", { orch: scriptCmd(), workspace: join(dirname(ws.dir), t.name) }),
  });
}

Workspace.prototype.andonRootStatePath = function andonRootStatePath() {
  return this.plan.andonStatePath ?? this.statePath;
};

function modelCatalog() {
  return [
    "- `sonnet`: default for workers. Strong code model, fast enough for multi-file slices.",
    "- `opus`: default for verifiers and subplanners. Judgment, acceptance checks, ambiguity, hard cross-cutting changes.",
    "- `haiku`: mechanical edits, renames, quick lookups.",
    "- `inherit`: run on the planner's own model.",
    "Run a unit's verifier on a different model from its worker when you can.",
  ].join("\n");
}

// ---------- handoff parsing (mirrors upstream core/handoff.ts) ----------

function readSection(body, heading) {
  const m = new RegExp(`^##\\s+${heading}\\s*\\r?\\n([^\\r\\n]*)`, "m").exec(body);
  if (!m) return null;
  const raw = m[1].trim();
  if (!raw || raw.startsWith("##")) return null;
  return raw.replace(/^`([^`]+)`$/, "$1").trim();
}

function normalizeEnum(raw) {
  return raw.toLowerCase().replace(/[\s_]+/g, "-");
}

function parseBranch(body) {
  const v = readSection(body, "Branch");
  if (!v) return null;
  const unwrapped = v.replace(/^`([^`]+)`.*$/, "$1").trim();
  if (!unwrapped || /^\(no branch\)$/i.test(unwrapped)) return null;
  return unwrapped;
}

function parseVerification(body) {
  const v = readSection(body, "Verification");
  if (v) {
    const n = normalizeEnum(v.split(/\s/)[0]);
    return VERIFICATION_VALUES.includes(n) ? n : null;
  }
  const legacy = readSection(body, "Verdict");
  if (!legacy) return null;
  return { pass: "type-check-only", fail: "verifier-failed", inconclusive: "verifier-blocked" }[normalizeEnum(legacy)] ?? null;
}

function parseStatus(body) {
  const v = readSection(body, "Status");
  if (!v) return null;
  const n = normalizeEnum(v.split(/\s/)[0]);
  return ["success", "partial", "blocked"].includes(n) ? n : n;
}

function hasStructuredHandoff(body) {
  return /^##\s+(Status|Verification)\s*$/m.test(body ?? "");
}

// ---------- measurements (mirrors upstream measurements.ts) ----------

const MEASUREMENT_OPS = ["→", "<=", ">=", "==", "<", ">"];

function findOp(line, op) {
  let from = 0;
  for (;;) {
    const idx = line.indexOf(op, from);
    if (idx < 0) return -1;
    const before = idx > 0 ? line[idx - 1] : " ";
    const after = idx + op.length < line.length ? line[idx + op.length] : " ";
    if (/\s/.test(before) && /\s/.test(after)) return idx;
    from = idx + op.length;
  }
}

function parseMeasurementLine(line) {
  for (const op of MEASUREMENT_OPS) {
    const idx = findOp(line, op);
    if (idx < 0) continue;
    const left = line.slice(0, idx).trim();
    const right = line.slice(idx + op.length).trim();
    const colon = left.lastIndexOf(":");
    if (colon < 0) continue;
    const name = left.slice(0, colon).trim().replace(/^`|`$/g, "");
    const before = left.slice(colon + 1).trim();
    if (name && before && right) return { name, before, op, after: right.replace(/`$/, "") };
  }
  return null;
}

function parseMeasurements(body) {
  const m = /^##\s+Measurements\s*\r?\n([\s\S]*?)(?=^##\s+|(?![\s\S]))/m.exec(body);
  if (!m) return null;
  const claims = [];
  const unparsed = [];
  let none = false;
  for (const raw of m[1].split(/\r?\n/)) {
    const s = raw.trim().replace(/^[-*]\s*/, "").replace(/^`/, "").trim();
    if (!s) continue;
    if (/^\(none\)$/i.test(s)) {
      none = true;
      continue;
    }
    const c = parseMeasurementLine(s);
    if (c) claims.push(c);
    else unparsed.push(s);
  }
  return { none: none && claims.length === 0, claims, unparsed };
}

function numericWithUnit(v) {
  const m = /^(-?[\d,]*\.?\d+)\s*([A-Za-z%][\w%/]*)?/.exec(v.trim());
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? { n, unit: m[2] ?? null } : null;
}

function compareMeasurement(spec, measured, claim) {
  const tol = spec.toleranceFraction ?? MEASUREMENT_DEFAULT_TOLERANCE;
  if (!claim) return { outcome: "claim-missing", detail: `worker did not report a claim line named ${JSON.stringify(spec.name)}` };
  const a = numericWithUnit(measured);
  const b = numericWithUnit(claim.after);
  if (a && b) {
    if (a.unit !== b.unit) return { outcome: "value-mismatch", detail: `unit mismatch; claimed ${claim.after}, measured ${measured}` };
    const drift = Math.abs(a.n - b.n) / Math.max(Math.abs(b.n), 1);
    return drift > tol
      ? { outcome: "value-mismatch", detail: `numeric drift ${(drift * 100).toFixed(1)}% > ${(tol * 100).toFixed(0)}%; claimed ${claim.after}, measured ${measured}` }
      : { outcome: "match", detail: `within tolerance (drift ${(drift * 100).toFixed(1)}%)` };
  }
  const eq = measured.replace(/\s+/g, " ").trim() === claim.after.replace(/\s+/g, " ").trim();
  return eq ? { outcome: "match", detail: "string equality" } : { outcome: "value-mismatch", detail: `string mismatch; claimed ${JSON.stringify(claim.after)}, measured ${JSON.stringify(measured)}` };
}

function applyParser(parser, stdout) {
  if (!parser || parser.kind === "wc-l") return String(stdout.split(/\r?\n/).filter((l) => l.trim()).length);
  const m = new RegExp(parser.pattern, parser.flags ?? "").exec(stdout);
  if (!m) return null;
  return (m[1] ?? m[0]).trim();
}

const MEASUREMENT_ENV_ALLOW = ["PATH", "LANG", "LC_ALL", "LC_CTYPE", "TZ", "TERM", "USER", "LOGNAME", "SHELL"];

function repoRoot(cwd) {
  return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" }).trim();
}

// Re-run declared measurements on the worker's branch in a throwaway detached
// worktree, with an allowlisted environment and a scratch HOME so worker code
// can't read the operator's dotfiles.
function checkMeasurements(ws, def, body, branch) {
  const specs = def.measurements ?? [];
  if (specs.length === 0) return [];
  const parsed = parseMeasurements(body);
  if (!parsed) {
    ws.attention(`${def.name}: handoff missing required \`## Measurements\` section; declared: ${specs.map((m) => m.name).join(", ")}`);
    return [];
  }
  if (parsed.unparsed.length) ws.attention(`${def.name}: ${parsed.unparsed.length} unparseable measurement line(s); first: ${truncate(parsed.unparsed[0], 120)}`);
  let root;
  try {
    root = repoRoot(process.cwd());
  } catch {
    ws.attention(`${def.name}: skipped re-measurement; not inside a git repository`);
    return [];
  }
  const dir = mkdtempSync(join(tmpdir(), "orch-measure-"));
  const home = mkdtempSync(join(tmpdir(), "orch-measure-home-"));
  const results = [];
  try {
    execFileSync("git", ["worktree", "add", "--detach", dir, branch], { cwd: root, stdio: "pipe" });
    const env = { HOME: home };
    for (const k of MEASUREMENT_ENV_ALLOW) if (typeof process.env[k] === "string") env[k] = process.env[k];
    for (const spec of specs) {
      const claim = parsed.claims.find((c) => c.name === spec.name) ?? null;
      const r = spawnSync("bash", ["-c", spec.command], { cwd: dir, env, encoding: "utf8", timeout: MEASUREMENT_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 });
      let check;
      if (r.error || r.signal || r.status !== 0) {
        check = { outcome: "command-failed", detail: r.error?.message ?? (r.signal ? `killed by ${r.signal}` : `exit=${r.status}; ${truncate((r.stderr ?? "").trim(), 300)}`) };
      } else {
        const measured = applyParser(spec.parser, r.stdout ?? "");
        check = measured === null ? { outcome: "parse-failed", detail: "parser matched nothing" } : { measured, ...compareMeasurement(spec, measured, claim) };
      }
      results.push({ name: spec.name, ...check });
      if (check.outcome !== "match") ws.attention(`${def.name}: measurement ${JSON.stringify(spec.name)} ${check.outcome}: ${check.detail}`);
    }
  } catch (err) {
    ws.attention(`${def.name}: skipped re-measurement on ${branch}: ${truncate(String(err.message ?? err), 200)}`);
  } finally {
    try {
      execFileSync("git", ["worktree", "remove", "--force", dir], { cwd: root, stdio: "pipe" });
    } catch {
      rmSync(dir, { recursive: true, force: true });
    }
    rmSync(home, { recursive: true, force: true });
  }
  return results;
}

// ---------- failure sidecars (mirrors upstream core/failure-handoff.ts) ----------

function classifyFailure({ error = "", tail = "", durationMs = null }) {
  const e = error.toLowerCase();
  const o = tail.toLowerCase();
  if (/out of memory|oomkilled|exit code 137/.test(o) || /out of memory|oomkilled|exit code 137/.test(e)) return "oom";
  if (/max(imum)? ?turns|turn limit|timed? ?out|context (window|length)|prompt is too long/.test(e)) return "cap-hit";
  if (/tool[_\s-]?use[_\s-]?failed|\btool[_\s-]?error\b/.test(e)) return "tool-error";
  if (/network|econn|etimedout|socket|dns|fetch failed|disconnect|overloaded|529|api error/.test(e)) return "network-drop";
  return "unknown";
}

const FAILURE_SUGGESTIONS = {
  "cap-hit": ["Retry with smaller scope (likely fix for cap-hit)", "Split the task into two workers with narrower pathsAllowed", "Abandon: skip task, replan around it"],
  oom: ["Retry with smaller scope (likely fix for oom)", "Abandon: skip task, replan around it"],
  "network-drop": ["Retry as-is (treat as transient)", "Abandon: skip task, replan around it if retries keep dropping"],
  "tool-error": ["Retry with a different model (likely fix for tool-error)", "Retry as-is if the tool call looks recoverable", "Abandon: skip task, replan around it"],
  unknown: ["Retry as-is (treat as transient)", "Retry with smaller scope if this repeats", "Retry with a different model if the same tool keeps failing", "Abandon: skip task, replan around it"],
};

// ---------- slack (optional; mirrors upstream adapters/slack, best-effort) ----------

async function slack(ws, method, body) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`https://slack.com/api/${method}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.ok) ws.attention(`slack ${method} failed: ${json.error}`);
    return json.ok ? json : null;
  } catch (err) {
    ws.attention(`slack ${method} failed: ${truncate(String(err.message ?? err), 200)}`);
    return null;
  }
}

// Slack upload v2: get an upload URL, POST the bytes, complete into the thread.
async function slackUpload(ws, { channel, threadTs, path, comment }) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token || !existsSync(path)) {
    ws.attention(`upload skipped (${!token ? "no SLACK_BOT_TOKEN" : `missing file ${path}`}): ${truncate(comment, 200)}`);
    return false;
  }
  try {
    const bytes = readFileSync(path);
    const name = path.split(/[\\/]/).pop();
    const form = (o) => ({ method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(o).toString() });
    const a = await (await fetch("https://slack.com/api/files.getUploadURLExternal", form({ filename: name, length: String(bytes.length) }))).json();
    if (!a.ok) throw new Error(a.error);
    const up = await fetch(a.upload_url, { method: "POST", body: bytes });
    if (!up.ok) throw new Error(`upload HTTP ${up.status}`);
    const c = await (await fetch("https://slack.com/api/files.completeUploadExternal", form({ files: JSON.stringify([{ id: a.file_id, title: name }]), channel_id: channel, thread_ts: threadTs, initial_comment: comment }))).json();
    if (!c.ok) throw new Error(c.error);
    return true;
  } catch (err) {
    ws.attention(`slack upload failed: ${truncate(String(err.message ?? err), 200)}`);
    return false;
  }
}

async function ensureKickoff(ws) {
  if (!process.env.SLACK_BOT_TOKEN || ws.plan.slackKickoffRef) return;
  const channel = ws.plan.slackChannel ?? process.env.SLACK_CHANNEL_ID;
  if (!channel) return;
  const username = ws.plan.dispatcher?.firstName ? `${ws.plan.dispatcher.firstName}'s bot` : "orchestrate";
  const text = `${ws.plan.rootSlug}: ${ws.plan.summary ?? truncate(ws.plan.goal, 200)}`;
  const r = await slack(ws, "chat.postMessage", { channel, text, username });
  if (r) {
    ws.plan.slackChannel = channel;
    ws.plan.slackKickoffRef = { channel: r.channel, ts: r.ts };
    atomicWrite(ws.planPath, `${JSON.stringify(ws.plan, null, 2)}\n`);
  }
}

async function mirror(ws, row, line) {
  const ref = ws.plan.slackKickoffRef;
  if (!ref) return;
  const text = `${row.name} → ${line}`;
  if (row.slackTs) {
    const r = await slack(ws, "chat.update", { channel: ref.channel, ts: row.slackTs, text });
    if (r) return;
  }
  const r = await slack(ws, "chat.postMessage", { channel: ref.channel, thread_ts: ref.ts, text, username: row.name });
  if (r) row.slackTs = r.ts;
}

async function pollAndon(ws) {
  const ref = ws.plan.slackKickoffRef;
  if (!ref || ws.plan.andonStatePath) return;
  const r = await slack(ws, "reactions.get", { channel: ref.channel, timestamp: ref.ts });
  if (!r) return;
  const raised = (r.message?.reactions ?? []).some((x) => x.name === "rotating_light");
  const cur = ws.state.andon;
  if (raised && !(cur?.raisedAt && !cur.cleared)) {
    ws.state.andon = { raisedAt: nowIso(), raisedBy: "slack", reason: "rotating_light reaction on the kickoff message", lastCheckedAt: nowIso() };
    ws.attention("andon raised via Slack reaction");
  } else if (!raised && cur?.raisedBy === "slack" && !cur.cleared) {
    Object.assign(cur, { cleared: true, clearedAt: nowIso(), clearedBy: "slack", lastCheckedAt: nowIso() });
    ws.attention("andon cleared via Slack reaction removal");
  }
}

// ---------- commands ----------

function parseFlags(args, spec) {
  const flags = {};
  const pos = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      if (spec.bool?.includes(key)) flags[key] = true;
      else {
        if (i + 1 >= args.length) throw new UsageError(`--${key} needs a value`);
        flags[key] = args[++i];
      }
    } else pos.push(a);
  }
  return { flags, pos };
}

function needWs(pos) {
  if (!pos[0]) throw new UsageError("missing <workspace>");
  return new Workspace(pos[0]);
}

function renderTree(ws) {
  const lines = [`${ws.plan.rootSlug}/  (${ws.state.tasks.length} tasks)`];
  ws.state.tasks.forEach((t, i) => {
    const glyph = i === ws.state.tasks.length - 1 ? "└─" : "├─";
    const deps = t.dependsOn?.length ? `  deps: ${t.dependsOn.join(", ")}` : "";
    const id = t.agentId ? `  ${t.agentId}` : "";
    const att = (t.attempts ?? 0) > 1 ? `  attempts=${t.attempts}` : "";
    const ver = t.verification ? `  [${t.verification}]` : "";
    lines.push(`${glyph} ${t.name.padEnd(32)} ${t.type.padEnd(11)} ${t.status.padEnd(11)} ${t.branch}${id}${att}${ver}${deps}`);
  });
  return lines.join("\n");
}

function counts(ws) {
  const c = {};
  for (const t of ws.state.tasks) c[t.status] = (c[t.status] ?? 0) + 1;
  return c;
}

const COMMANDS = {
  async validate(args) {
    const { pos } = parseFlags(args, {});
    const ws = needWs(pos);
    ws.save();
    console.log(`plan.json OK: ${ws.tasks.length} task(s), rootSlug=${ws.plan.rootSlug}`);
  },

  async ready(args) {
    const { flags, pos } = parseFlags(args, { bool: ["json"] });
    const ws = needWs(pos);
    await ensureKickoff(ws);
    await pollAndon(ws);
    const andon = ws.andon();
    const ready = [];
    if (!andon) {
      for (const r of ws.state.tasks) {
        if (r.status !== "pending" || !ws.depsSatisfied(r)) continue;
        const def = ws.def(r.name);
        if (!def) continue;
        if (def.maxAttempts != null && (r.attempts ?? 0) >= def.maxAttempts) {
          ws.attention(`${r.name}: exceeded maxAttempts=${def.maxAttempts}; planner must bump maxAttempts or abandon this task`);
          r.status = "error";
          r.note = `exceeded maxAttempts=${def.maxAttempts}`;
          continue;
        }
        r.startingRef = ws.startingRefFor(def);
        ready.push({
          name: r.name,
          type: r.type,
          subagent_type: AGENT_TYPES[r.type],
          model: def.model ?? DEFAULT_MODELS[r.type],
          isolation: r.type === "subplanner" ? null : "worktree",
          branch: ws.branchFor(def),
          startingRef: r.startingRef,
        });
      }
    }
    ws.save();
    const c = counts(ws);
    const running = c.running ?? 0;
    const pending = c.pending ?? 0;
    if (flags.json) {
      console.log(JSON.stringify({ andon: andon ? { reason: andon.reason ?? null, raisedAt: andon.raisedAt } : null, ready, running, pending, done: running === 0 && ready.length === 0 }, null, 2));
      return;
    }
    if (andon) console.log(`>> ANDON ACTIVE (raised ${andon.raisedAt}): ${andon.reason ?? "(no reason)"}. No new spawns.`);
    for (const r of ready) console.log(`${r.name}\t${r.subagent_type}\tmodel=${r.model}\t${r.isolation ?? "no-isolation"}\tbranch=${r.branch}\tfrom=${r.startingRef}`);
    if (ready.length === 0) console.log(`(nothing ready) running=${running} pending=${pending}`);
  },

  async prompt(args) {
    const { flags, pos } = parseFlags(args, {});
    const ws = needWs(pos);
    const name = pos[1];
    if (!name) throw new UsageError("missing <task>");
    const text = buildPrompt(ws, name);
    const out = flags.out ?? join(ws.promptsDir, `${name}.md`);
    if (flags.out === "-") {
      process.stdout.write(text);
      return;
    }
    atomicWrite(resolve(out), text);
    console.log(resolve(out));
  },

  async start(args) {
    const { flags, pos } = parseFlags(args, {});
    const ws = needWs(pos);
    const r = ws.requireRow(pos[1]);
    if (r.status !== "pending") ws.attention(`${r.name}: start while status=${r.status}`);
    const t = nowIso();
    Object.assign(r, { status: "running", agentId: flags["agent-id"] ?? r.agentId, startedAt: t, lastUpdate: t, attempts: (r.attempts ?? 0) + 1, finishedAt: null, note: null });
    await ensureKickoff(ws);
    await mirror(ws, r, `running (${r.type}, attempt ${r.attempts})`);
    ws.save();
    console.log(`${r.name}: running (attempt ${r.attempts})`);
  },

  async handoff(args) {
    const { flags, pos } = parseFlags(args, {});
    const ws = needWs(pos);
    const r = ws.requireRow(pos[1]);
    const def = ws.def(r.name);
    const body = readInput(pos[2]);
    const t = nowIso();
    const resultStatus = flags["result-status"] ?? "finished";
    const reported = parseBranch(body);
    if (reported) {
      if (reported !== r.branch) ws.attention(`${r.name}: handoff branch ${reported} replaces planned ${r.branch}`);
      r.branch = reported;
    }
    const header = `<!-- orchestrate handoff\ntask: ${r.name}\nbranch: ${r.branch}\nagentId: ${r.agentId}\nresultStatus: ${resultStatus}\nfinishedAt: ${t}\n-->\n\n`;
    const banner = resultStatus === "finished" ? "" : `> Run ended with \`status=${resultStatus}\`. No structured handoff produced; the content below is the agent's raw output.\n\n`;
    const path = join(ws.handoffsDir, `${r.name}.md`);
    atomicWrite(path, header + banner + (body.trim() ? body : "_(empty final message)_\n"));
    Object.assign(r, { status: "handed-off", resultStatus, handoffPath: relative(ws.dir, path), finishedAt: t, lastUpdate: t });
    const status = parseStatus(body);
    r.note = status ? `status: ${status}` : null;
    const ver = parseVerification(body);
    if (ver) {
      // A verifier's verdict overrides a self-report on the target row, never the reverse.
      if (def?.type === "verifier" || r.verificationSource !== "verifier") {
        r.verification = ver;
        r.verificationSource = def?.type === "verifier" ? "verifier" : "self";
      }
      if (def?.type === "verifier") {
        const target = ws.row(def.verifies);
        if (target) Object.assign(target, { verification: ver, verificationSource: "verifier" });
      }
    }
    if (!hasStructuredHandoff(body)) {
      const side = join(ws.handoffsDir, `${r.name}-finished-no-handoff.md`);
      const snippet = body.trim() ? `\n\n## Raw final output (truncated)\n\n${truncate(body.trim(), 2000)}\n` : "";
      atomicWrite(side, renderTemplate("finished-no-handoff", { taskName: r.name, branch: r.branch, agentId: r.agentId ?? "(unknown)", resultStatus, terminatedAt: t, rawSnippetBlock: snippet }));
      ws.attention(`${r.name}: finished without a structured handoff; see handoffs/${r.name}-finished-no-handoff.md`);
    }
    // Verifiers still pointing at this task's placeholder follow its real branch.
    for (const v of ws.tasks) {
      if (v.type === "verifier" && v.verifies === r.name && !v.startingRef) {
        const vr = ws.row(v.name);
        if (vr && vr.status === "pending" && vr.startingRef !== r.branch) {
          vr.startingRef = r.branch;
          ws.attention(`${v.name}: startingRef -> ${r.branch} (from ${r.name} handoff)`);
        }
      }
    }
    let measures = [];
    if (def?.type === "worker" && reported) measures = checkMeasurements(ws, def, body, r.branch);
    if (measures.length) r.measurements = measures;
    await mirror(ws, r, `handed-off${status ? ` (${status})` : ""}${ver ? ` [${ver}]` : ""}`);
    ws.save();
    console.log(`${r.name}: handed-off${status ? ` status=${status}` : ""} branch=${r.branch}${r.verification ? ` verification=${r.verification}` : ""}`);
    for (const m of measures) console.log(`  measurement ${m.name}: ${m.outcome} (${m.detail})`);
  },

  async fail(args) {
    const { flags, pos } = parseFlags(args, {});
    const ws = needWs(pos);
    const r = ws.requireRow(pos[1]);
    const t = nowIso();
    const error = flags.error ?? (pos[2] ? readInput(pos[2]) : "");
    const durationMs = r.startedAt ? Date.parse(t) - Date.parse(r.startedAt) : null;
    let mode = flags.mode ?? classifyFailure({ error, tail: flags.tail ?? "", durationMs });
    if (!FAILURE_MODES.includes(mode)) mode = "unknown";
    const path = join(ws.handoffsDir, `${r.name}-failure.md`);
    atomicWrite(path, renderTemplate("failure-handoff", {
      taskName: r.name,
      branch: r.branch,
      agentId: r.agentId ?? "(unknown)",
      failureMode: mode,
      startedAt: r.startedAt ?? "(unknown)",
      terminatedAt: t,
      duration: durationMs != null && durationMs >= 0 ? `${durationMs}ms` : "(unknown)",
      lastActivityLine: r.lastUpdate ? `${r.lastUpdate}${r.note ? ` - ${r.note}` : ""}` : "(no activity recorded)",
      lastToolCall: flags["last-tool"] ?? "(unknown)",
      agentError: truncate(error.trim() || "(none recorded)", 500),
      suggestions: FAILURE_SUGGESTIONS[mode].map((s) => `- ${s}`).join("\n"),
    }));
    Object.assign(r, { status: "error", failureMode: mode, finishedAt: t, lastUpdate: t, note: `failure: ${mode}`, handoffPath: relative(ws.dir, path) });
    ws.attention(`${r.name}: error (${mode}); see handoffs/${r.name}-failure.md`);
    await mirror(ws, r, `error (${mode})`);
    ws.save();
    console.log(`${r.name}: error failureMode=${mode} -> ${path}`);
  },

  async respawn(args) {
    const { pos } = parseFlags(args, {});
    const ws = needWs(pos);
    const r = ws.requireRow(pos[1]);
    if (r.status === "running") throw new UsageError(`${r.name} is running; stop its agent first (TaskStop), then cancel it`);
    Object.assign(r, { status: "pending", agentId: null, finishedAt: null, lastUpdate: nowIso(), note: `respawn requested (previous: ${r.status})` });
    ws.attention(`${r.name}: reset to pending for respawn (attempts so far: ${r.attempts ?? 0})`);
    ws.save();
    console.log(`${r.name}: pending (respawn); builds on existing branch ${r.branch} if it exists`);
  },

  async cancel(args) {
    const { pos } = parseFlags(args, {});
    const ws = needWs(pos);
    const r = ws.requireRow(pos[1]);
    Object.assign(r, { status: "cancelled", lastUpdate: nowIso(), note: "cancelled by operator" });
    ws.attention(`${r.name}: cancelled by operator`);
    await mirror(ws, r, "cancelled");
    ws.save();
    console.log(`${r.name}: cancelled${r.agentId ? ` (also stop agent ${r.agentId} with TaskStop if it is still running)` : ""}`);
  },

  async prune(args) {
    const { pos } = parseFlags(args, {});
    const ws = needWs(pos);
    const r = ws.requireRow(pos[1]);
    if (r.status !== "pending") throw new UsageError(`${r.name} is ${r.status}; only pending tasks can be pruned (use cancel)`);
    Object.assign(r, { status: "pruned", lastUpdate: nowIso(), note: "pruned by operator" });
    ws.attention(`${r.name}: pruned before spawn (operator)`);
    ws.save();
    console.log(`${r.name}: pruned`);
  },

  async tree(args) {
    const { pos } = parseFlags(args, {});
    const ws = needWs(pos);
    const a = ws.andon();
    if (a) console.log(`>> ANDON ACTIVE (raised ${a.raisedAt}): ${a.reason ?? ""}`);
    console.log(renderTree(ws));
    for (const r of ws.state.tasks) {
      if (r.type !== "subplanner") continue;
      const sub = join(dirname(ws.dir), r.name);
      if (existsSync(join(sub, "plan.json"))) {
        try {
          console.log(`\n${renderTree(new Workspace(sub)).replace(/^/gm, "    ")}`);
        } catch (err) {
          console.log(`    ${r.name}: unreadable sub-workspace (${err.message})`);
        }
      }
    }
  },

  async list(args) {
    const { flags, pos } = parseFlags(args, { bool: ["json"] });
    const ws = needWs(pos);
    const rows = flags.status ? ws.state.tasks.filter((t) => t.status === flags.status) : ws.state.tasks;
    if (flags.json) {
      console.log(JSON.stringify(rows, null, 2));
      return;
    }
    if (rows.length === 0) {
      console.log("(no tasks match)");
      return;
    }
    console.log(["NAME", "TYPE", "STATUS", "BRANCH", "AGENT", "ATTEMPTS", "VERIFICATION"].join("\t"));
    for (const t of rows) console.log([t.name, t.type, t.status, t.branch, t.agentId ?? "-", t.attempts ?? 0, t.verification ?? "-"].join("\t"));
  },

  async status(args) {
    const { pos } = parseFlags(args, {});
    const ws = needWs(pos);
    const c = counts(ws);
    const parts = Object.entries(c).map(([k, v]) => `${k}=${v}`);
    const attn = existsSync(ws.attentionPath) ? readFileSync(ws.attentionPath, "utf8").trim().split("\n").length : 0;
    const a = ws.andon();
    console.log(`orchestrate[${ws.plan.rootSlug}]: ${parts.join(", ")}${attn ? `, attention=${attn}` : ""}${a ? ", ANDON" : ""}`);
    const open = ws.state.tasks.filter((t) => !TERMINAL.has(t.status));
    console.log(open.length === 0 ? "All tasks terminal. The planner decides whether to publish more or stop." : `Non-terminal: ${open.map((t) => `${t.name}(${t.status})`).join(", ")}`);
  },

  async andon(args) {
    const { flags, pos } = parseFlags(args, {});
    const sub = pos[0];
    const ws = needWs([flags.workspace ?? pos[1]]);
    const t = nowIso();
    if (sub === "raise") {
      if (!flags.reason) throw new UsageError("--reason is required");
      ws.state.andon = { raisedAt: t, raisedBy: flags.by ?? "planner", reason: truncate(flags.reason, 500), lastCheckedAt: t };
      ws.attention(`ANDON RAISED: ${flags.reason}`);
      const ref = ws.plan.slackKickoffRef;
      if (ref) {
        await slack(ws, "chat.postMessage", { channel: ref.channel, thread_ts: ref.ts, text: `:rotating_light: ANDON RAISED: ${truncate(flags.reason, 500)}`, username: "orchestrate" });
        await slack(ws, "reactions.add", { channel: ref.channel, timestamp: ref.ts, name: "rotating_light" });
      }
    } else if (sub === "clear") {
      ws.state.andon = { ...(ws.state.andon ?? {}), cleared: true, clearedAt: t, clearedBy: flags.by ?? "planner", clearNote: flags.note, lastCheckedAt: t };
      ws.attention(`ANDON CLEARED${flags.note ? `: ${flags.note}` : ""}`);
      const ref = ws.plan.slackKickoffRef;
      if (ref) {
        await slack(ws, "reactions.remove", { channel: ref.channel, timestamp: ref.ts, name: "rotating_light" });
        await slack(ws, "chat.postMessage", { channel: ref.channel, thread_ts: ref.ts, text: `ANDON CLEARED${flags.note ? `: ${flags.note}` : ""}`, username: "orchestrate" });
      }
    } else throw new UsageError("andon raise --reason <why> <workspace> | andon clear [--note <text>] <workspace>");
    ws.save();
    console.log(sub === "raise" ? "andon raised" : "andon cleared");
  },

  async comment(args) {
    const { flags, pos } = parseFlags(args, {});
    const ws = needWs([flags.workspace]);
    const text = pos[0];
    if (!text) throw new UsageError('comment "<note>" --workspace <ws> [--sender <name>]');
    const ref = ws.plan.slackKickoffRef;
    if (!ref || !process.env.SLACK_BOT_TOKEN) {
      ws.attention(`comment (${flags.sender ?? "planner"}): ${truncate(text, 500)}`);
      console.log("Slack not configured; note recorded in attention.log");
      return;
    }
    const threadTs = flags["thread-ts"] ?? ref.ts;
    if (flags.file) {
      const ok = await slackUpload(ws, { channel: ref.channel, threadTs, path: resolve(flags.file), comment: text });
      if (!ok && flags.criticality === "required") process.exitCode = 1;
      console.log(ok ? "uploaded" : "upload failed; recorded in attention.log");
      return;
    }
    const r = await slack(ws, "chat.postMessage", { channel: ref.channel, thread_ts: threadTs, text, username: flags.sender ?? "orchestrate" });
    if (!r) {
      ws.attention(`comment failed to post (${flags.sender ?? "planner"}): ${truncate(text, 500)}`);
      if (flags.criticality === "required") process.exitCode = 1;
    }
    console.log(r ? "posted" : "post failed; recorded in attention.log");
  },

  async models() {
    console.log(modelCatalog());
  },

  async help() {
    console.log(`orch.mjs: orchestrate bookkeeping for Claude Code subagents

  validate <ws>                         check plan.json, sync state.json
  ready <ws> [--json]                   tasks to spawn now (deps handed off, no Andon)
  prompt <ws> <task> [--out <file>|-]   render the task's spawn prompt (default <ws>/prompts/<task>.md)
  start <ws> <task> [--agent-id <id>]   mark spawned (running, attempts+1)
  handoff <ws> <task> [<file>|-]        record the agent's final message; parses Status/Branch/Verification,
                                        re-runs measurements, writes sidecars
  fail <ws> <task> [--mode m] [--error text] [--last-tool name]
                                        agent died without a handoff; writes handoffs/<task>-failure.md
  respawn|cancel|prune <ws> <task>      operator transitions
  tree|list|status <ws>                 inspect (list: --status s, --json)
  andon raise --reason <why> <ws>       pause new spawns tree-wide; andon clear [--note] <ws>
  comment "<note>" --workspace <ws>     Slack note in the run thread (needs SLACK_BOT_TOKEN), else attention.log
  models                                model guidance for tasks[].model`);
  },
};

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const fn = COMMANDS[cmd ?? "help"];
  if (!fn) throw new UsageError(`unknown command: ${cmd} (try: help)`);
  await fn(args);
}

main().catch((err) => {
  if (err instanceof UsageError) {
    console.error(`orch: ${err.message}`);
    process.exit(2);
  }
  console.error(err?.stack ?? String(err));
  process.exit(1);
});

export { classifyFailure, parseBranch, parseMeasurements, parseVerification, validatePlan };
