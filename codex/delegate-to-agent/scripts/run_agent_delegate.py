#!/usr/bin/env python3
"""Run one bounded coding task through a local agent CLI."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys


TARGETS = ("pi", "codex", "claude", "grok-build")
TARGET_ALIASES = {
    "grok": "grok-build",
    "openai": "codex",
    "codex-cli": "codex",
    "claude-code": "claude",
    "deepseek": "pi",
}
DEFAULT_MODELS = {
    "pi": "flash",
    "codex": "gpt-5.6-sol",
    "claude": "sonnet",
    "grok-build": "grok-4.5",
}
TOOLS = {
    "worker": "read,bash,edit,write,grep,find,ls",
    "reviewer": "read,grep,find,ls",
}
INSTALL_HINTS = {
    "codex": "npm install -g @openai/codex",
    "claude": "npm install -g @anthropic-ai/claude-code",
    "grok-build": "curl -fsSL https://x.ai/cli/install.sh | bash (or npm install -g @xai-official/grok)",
}
PI_PACKAGE = "@earendil-works/pi-coding-agent"
PI_MODELS = {"flash": "deepseek-v4-flash", "pro": "deepseek-v4-pro"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Delegate one bounded coding task to a local agent CLI."
    )
    parser.add_argument(
        "--target",
        choices=TARGETS + tuple(TARGET_ALIASES),
        required=True,
        help="Worker CLI to use: pi, codex, claude, or grok-build.",
    )
    parser.add_argument("--workdir", type=Path, default=Path.cwd())
    parser.add_argument("--mode", choices=TOOLS, default="worker")
    parser.add_argument(
        "--model",
        help="Target-specific model ID or alias. Defaults to the target's safe coding model.",
    )
    parser.add_argument("--thinking", choices=("low", "medium", "high", "xhigh", "max"), default="high")
    parser.add_argument("--timeout", type=int, default=1800)
    parser.add_argument(
        "--no-bootstrap",
        action="store_true",
        help="For Pi, do not install Pi or refresh its model catalog automatically.",
    )
    task_group = parser.add_mutually_exclusive_group(required=True)
    task_group.add_argument("--task", help="Short task text. Prefer --task-file for long briefs.")
    task_group.add_argument("--task-file", type=Path, help="UTF-8 delegation brief path.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate setup without calling the selected model.",
    )
    return parser.parse_args()


def fail(message: str, exit_code: int = 2) -> None:
    print(f"delegate-to-agent: {message}", file=sys.stderr)
    raise SystemExit(exit_code)


def load_task(args: argparse.Namespace) -> str:
    if args.task_file is not None:
        try:
            task = args.task_file.expanduser().resolve().read_text(encoding="utf-8")
        except OSError as error:
            fail(f"cannot read task file: {error}")
    else:
        task = args.task or ""
    task = task.strip()
    if not task:
        fail("delegation brief is empty")
    if len(task.encode("utf-8")) > 256_000:
        fail("delegation brief exceeds 256 KB")
    return task


def resolve_workdir(path: Path) -> Path:
    try:
        resolved = path.expanduser().resolve(strict=True)
    except OSError as error:
        fail(f"invalid workdir: {error}")
    if not resolved.is_dir():
        fail(f"workdir is not a directory: {resolved}")
    return resolved


def install_pi(workdir: Path) -> str:
    npm = shutil.which("npm")
    if npm is None:
        fail("Pi is missing and npm is not installed; install Node.js/npm, then retry")
    print(f"Pi not found; installing {PI_PACKAGE} with npm --ignore-scripts", file=sys.stderr)
    try:
        result = subprocess.run(
            [npm, "install", "--global", "--ignore-scripts", PI_PACKAGE],
            cwd=workdir,
            text=True,
            capture_output=True,
            timeout=300,
            check=False,
        )
    except subprocess.TimeoutExpired:
        fail("timed out installing Pi", 124)
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip().splitlines()
        fail(
            "Pi installation failed; retry as the current user without sudo: "
            + (detail[-1] if detail else "unknown npm error")
        )
    pi = shutil.which("pi")
    if pi is None:
        fail("npm reported success but Pi is still not on PATH")
    return pi


def resolve_cli(target: str, workdir: Path, bootstrap: bool, dry_run: bool) -> str:
    executable = "pi" if target == "pi" else ("grok" if target == "grok-build" else target)
    cli = shutil.which(executable)
    if cli is not None:
        return cli
    if target == "pi" and bootstrap and not dry_run:
        return install_pi(workdir)
    if target == "pi":
        fail("Pi executable not found on PATH; install it or omit --no-bootstrap")
    fail(
        f"{target} CLI executable `{executable}` was not found on PATH; install/authenticate it first. "
        f"Official install hint: {INSTALL_HINTS[target]}"
    )


def list_pi_models(pi: str, workdir: Path) -> set[str]:
    try:
        result = subprocess.run(
            [pi, "--list-models", "deepseek"],
            cwd=workdir,
            text=True,
            capture_output=True,
            timeout=30,
            check=False,
        )
    except subprocess.TimeoutExpired:
        fail("timed out while checking Pi DeepSeek models")
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip().splitlines()
        fail(f"Pi model check failed: {detail[-1] if detail else 'unknown error'}")
    return {
        parts[1]
        for parts in (line.split() for line in result.stdout.splitlines()[1:])
        if len(parts) > 1
    }


def ensure_pi_model(pi: str, model_id: str, workdir: Path, bootstrap: bool) -> None:
    available = list_pi_models(pi, workdir)
    if model_id in available:
        return
    if bootstrap:
        print("DeepSeek model catalog is stale; refreshing with `pi update --models`", file=sys.stderr)
        try:
            result = subprocess.run(
                [pi, "update", "--models"],
                cwd=workdir,
                text=True,
                capture_output=True,
                timeout=120,
                check=False,
            )
        except subprocess.TimeoutExpired:
            fail("timed out refreshing Pi model catalog", 124)
        if result.returncode != 0:
            detail = (result.stderr or result.stdout).strip().splitlines()
            fail(f"Pi model catalog refresh failed: {detail[-1] if detail else 'unknown error'}")
        available = list_pi_models(pi, workdir)
    if model_id not in available:
        fail(f"Pi does not list required model {model_id}; run `pi update --models`")


def pi_auth_source() -> str | None:
    if os.environ.get("DEEPSEEK_API_KEY"):
        return "DEEPSEEK_API_KEY"
    config_dir = Path(os.environ.get("PI_CODING_AGENT_DIR", "~/.pi/agent")).expanduser()
    try:
        auth = json.loads((config_dir / "auth.json").read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return None
    entry = auth.get("deepseek") if isinstance(auth, dict) else None
    if not isinstance(entry, dict):
        return None
    key = entry.get("key")
    if not isinstance(key, str) or not key.strip():
        return None
    if key.startswith("$"):
        variable = key[1:]
        return "Pi auth.json" if variable and os.environ.get(variable) else None
    return "Pi auth.json"


def require_pi_auth(dry_run: bool) -> str | None:
    source = pi_auth_source()
    if source is None and not dry_run:
        fail(
            "DeepSeek authentication is not configured. Set DEEPSEEK_API_KEY in the "
            "parent environment, or run `pi` and use `/login` to select DeepSeek. "
            "Do not paste API keys into chat or commit them.",
            3,
        )
    return source


def worker_prompt(task: str, workdir: Path, target: str, model: str, mode: str) -> str:
    access = (
        "You may inspect files, run commands, edit existing files, and create required files."
        if mode == "worker"
        else "You are read-only. Do not edit or create files."
    )
    return f"""You are a bounded coding worker supervised by another agent.

Authorized working directory: {workdir}
Delegation target: {target}
Selected model: {model}
Access: {access}

Rules:
- Read and obey every applicable AGENTS.md, CLAUDE.md, and repository instruction file before acting.
- Work only on the assigned goal and owned scope in the brief.
- Other users or agents may have changes in this workspace. Preserve them and never revert unrelated work.
- Inspect repository status before edits. Never use destructive Git commands.
- Do not commit, push, deploy, access credentials, send messages, purchase anything, or trigger provider/production effects.
- Do not spawn another coding agent or delegate again.
- Run relevant local verification when permitted. Do not claim success without evidence.
- If blocked or requirements conflict, stop and explain; do not broaden scope.
- Finish with: outcome, files changed, commands/tests run, and unresolved risks.

Delegation brief:
{task}
"""


def native_command(target: str, cli: str, model: str, mode: str, thinking: str, prompt: str) -> list[str]:
    if target == "pi":
        model_id = PI_MODELS.get(model, model)
        return [
            cli,
            "--provider",
            "deepseek",
            "--model",
            model_id,
            "--thinking",
            "max" if thinking == "max" else "high",
            "--tools",
            TOOLS[mode],
            "--no-extensions",
            "--no-skills",
            "--no-prompt-templates",
            "--no-approve",
            "--no-session",
            "--print",
            "Execute the bounded delegation brief supplied on stdin.",
        ]
    if target == "codex":
        sandbox = "workspace-write" if mode == "worker" else "read-only"
        return [
            cli,
            "exec",
            "--ephemeral",
            "--model",
            model,
            "--sandbox",
            sandbox,
            "-c",
            f"model_reasoning_effort={thinking}",
            prompt,
        ]
    if target == "claude":
        command = [
            cli,
            "--model",
            model,
            "--effort",
            thinking,
            "--print",
            "--output-format",
            "text",
            "--no-session-persistence",
            "--permission-mode",
            "acceptEdits" if mode == "worker" else "plan",
        ]
        if mode == "reviewer":
            command.extend(["--disallowed-tools", "Edit,Write,NotebookEdit,Bash,Agent"])
        return command + [prompt]
    command = [
        cli,
        "--model",
        model,
        "--reasoning-effort",
        thinking,
        "--single",
        prompt,
        "--output-format",
        "plain",
        "--permission-mode",
        "acceptEdits" if mode == "worker" else "plan",
        "--no-memory",
        "--no-subagents",
    ]
    if mode == "reviewer":
        command.extend(["--no-web-search"])
    return command


def main() -> int:
    args = parse_args()
    if args.timeout < 1 or args.timeout > 86_400:
        fail("timeout must be between 1 and 86400 seconds")
    target = TARGET_ALIASES.get(args.target, args.target)
    model = args.model or DEFAULT_MODELS[target]
    if target == "pi" and model in PI_MODELS:
        model_id = PI_MODELS[model]
    else:
        model_id = model

    workdir = resolve_workdir(args.workdir)
    task = load_task(args)
    cli = resolve_cli(target, workdir, not args.no_bootstrap, args.dry_run)
    auth_source = None
    if target == "pi":
        ensure_pi_model(cli, model_id, workdir, not args.no_bootstrap and not args.dry_run)
        auth_source = require_pi_auth(args.dry_run)

    prompt = worker_prompt(task, workdir, target, model_id, args.mode)
    command = native_command(target, cli, model, args.mode, args.thinking, prompt)
    if args.dry_run:
        print(f"Target: {target}")
        print(f"CLI: {cli}")
        print(f"Workdir: {workdir}")
        print(f"Mode: {args.mode}")
        print(f"Model: {model_id}")
        print(f"Thinking: {args.thinking}")
        print(f"Brief bytes: {len(task.encode('utf-8'))}")
        if target == "pi":
            print(f"DeepSeek auth: {auth_source or 'missing'}")
        else:
            print("Native CLI auth: not inspected; the selected CLI will use its configured auth")
        print("Model call: skipped")
        return 0

    environment = os.environ.copy()
    if target == "pi":
        environment.setdefault("PI_TELEMETRY", "0")
    try:
        result = subprocess.run(
            command,
            cwd=workdir,
            env=environment,
            input=prompt if target in {"pi"} else None,
            text=True,
            timeout=args.timeout,
            check=False,
        )
    except subprocess.TimeoutExpired:
        fail(f"{target} worker timed out after {args.timeout} seconds", 124)
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
