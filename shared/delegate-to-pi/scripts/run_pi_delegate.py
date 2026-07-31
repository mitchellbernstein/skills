#!/usr/bin/env python3
"""Run a bounded Pi coding worker against an authorized working directory."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys


PI_PACKAGE = "@earendil-works/pi-coding-agent"
MODEL_IDS = {
    "flash": "deepseek-v4-flash",
    "pro": "deepseek-v4-pro",
}

TOOLS = {
    "worker": "read,bash,edit,write,grep,find,ls",
    "reviewer": "read,grep,find,ls",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Delegate one bounded coding task to Pi using DeepSeek V4."
    )
    parser.add_argument("--workdir", type=Path, default=Path.cwd())
    parser.add_argument("--mode", choices=TOOLS, default="worker")
    parser.add_argument(
        "--model",
        choices=MODEL_IDS,
        default="flash",
        help="DeepSeek model tier; defaults to flash for every worker mode.",
    )
    parser.add_argument("--thinking", choices=("high", "max"), default="high")
    parser.add_argument("--timeout", type=int, default=1800)
    parser.add_argument(
        "--no-bootstrap",
        action="store_true",
        help="Do not install Pi or refresh its model catalog automatically.",
    )
    task_group = parser.add_mutually_exclusive_group(required=True)
    task_group.add_argument("--task", help="Short task text. Prefer --task-file for long briefs.")
    task_group.add_argument("--task-file", type=Path, help="UTF-8 delegation brief path.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate Pi, model, worktree, and brief without calling DeepSeek.",
    )
    return parser.parse_args()


def fail(message: str, exit_code: int = 2) -> None:
    print(f"delegate-to-pi: {message}", file=sys.stderr)
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


def resolve_pi(workdir: Path, bootstrap: bool, dry_run: bool) -> str:
    pi = shutil.which("pi")
    if pi is not None:
        return pi
    if not bootstrap or dry_run:
        fail("Pi executable not found on PATH; install it or omit --no-bootstrap")
    return install_pi(workdir)


def list_models(pi: str, workdir: Path) -> set[str]:
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


def ensure_model(pi: str, model_id: str, workdir: Path, bootstrap: bool) -> None:
    available = list_models(pi, workdir)
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
        available = list_models(pi, workdir)
    if model_id in available:
        return
    if model_id not in available:
        fail(f"Pi does not list required model {model_id}; run `pi update --models`")


def deepseek_auth_source() -> str | None:
    if os.environ.get("DEEPSEEK_API_KEY"):
        return "DEEPSEEK_API_KEY"
    config_dir = Path(os.environ.get("PI_CODING_AGENT_DIR", "~/.pi/agent")).expanduser()
    auth_file = config_dir / "auth.json"
    try:
        auth = json.loads(auth_file.read_text(encoding="utf-8"))
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


def require_deepseek_auth(dry_run: bool) -> str | None:
    source = deepseek_auth_source()
    if source is None and not dry_run:
        fail(
            "DeepSeek authentication is not configured. Set DEEPSEEK_API_KEY in the "
            "parent environment, or run `pi` and use `/login` to select DeepSeek. "
            "Do not paste API keys into chat or commit them.",
            3,
        )
    return source


def worker_prompt(task: str, workdir: Path, mode: str) -> str:
    access = (
        "You may inspect files, run commands, edit existing files, and create required files."
        if mode == "worker"
        else "You are read-only. Do not edit or create files."
    )
    return f"""You are a bounded coding worker supervised by another agent.

Authorized working directory: {workdir}
Access: {access}

Rules:
- Read and obey every applicable AGENTS.md or CLAUDE.md before acting.
- Work only on the assigned goal and owned scope in the brief.
- Other users or agents may have changes in this workspace. Preserve them and never revert unrelated work.
- Inspect repository status before edits. Never use destructive Git commands.
- Do not commit, push, deploy, access credentials, send messages, purchase anything, or trigger provider/production effects.
- Run relevant local verification when permitted. Do not claim success without evidence.
- If blocked or requirements conflict, stop and explain; do not broaden scope.
- Finish with: outcome, files changed, commands/tests run, and unresolved risks.

Delegation brief:
{task}
"""


def main() -> int:
    args = parse_args()
    if args.timeout < 1 or args.timeout > 86_400:
        fail("timeout must be between 1 and 86400 seconds")

    workdir = resolve_workdir(args.workdir)
    task = load_task(args)
    pi = resolve_pi(workdir, not args.no_bootstrap, args.dry_run)
    model_id = MODEL_IDS[args.model]
    ensure_model(pi, model_id, workdir, not args.no_bootstrap and not args.dry_run)
    auth_source = require_deepseek_auth(args.dry_run)

    command = [
        pi,
        "--provider",
        "deepseek",
        "--model",
        model_id,
        "--thinking",
        args.thinking,
        "--tools",
        TOOLS[args.mode],
        "--no-extensions",
        "--no-skills",
        "--no-prompt-templates",
        "--no-approve",
        "--no-session",
        "--print",
        "Execute the bounded delegation brief supplied on stdin.",
    ]

    if args.dry_run:
        print(f"Pi: {pi}")
        print(f"Workdir: {workdir}")
        print(f"Mode: {args.mode}")
        print(f"Model: deepseek/{model_id}")
        print(f"Thinking: {args.thinking}")
        print(f"Tools: {TOOLS[args.mode]}")
        print(f"Brief bytes: {len(task.encode('utf-8'))}")
        print(f"DeepSeek auth: {auth_source or 'missing'}")
        print("DeepSeek call: skipped")
        return 0

    environment = os.environ.copy()
    environment.setdefault("PI_TELEMETRY", "0")
    try:
        result = subprocess.run(
            command,
            cwd=workdir,
            env=environment,
            input=worker_prompt(task, workdir, args.mode),
            text=True,
            timeout=args.timeout,
            check=False,
        )
    except subprocess.TimeoutExpired:
        fail(f"Pi worker timed out after {args.timeout} seconds", 124)
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
