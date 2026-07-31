#!/usr/bin/env python3
"""Run a bounded Pi coding worker against an authorized working directory."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys


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


def ensure_model(pi: str, model_id: str, workdir: Path) -> None:
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
    available = {line.split()[1] for line in result.stdout.splitlines()[1:] if len(line.split()) > 1}
    if model_id not in available:
        fail(f"Pi does not list required model {model_id}; run `pi update --models`")


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

    pi = shutil.which("pi")
    if pi is None:
        fail("Pi executable not found on PATH")

    workdir = resolve_workdir(args.workdir)
    task = load_task(args)
    model_id = MODEL_IDS[args.model]
    ensure_model(pi, model_id, workdir)

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
