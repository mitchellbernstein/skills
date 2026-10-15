#!/usr/bin/env python3
"""Package every skill in a Claude Code plugin as Claude-app upload zips.

Usage: python3 scripts/package-claude-app-skills.py [plugin_dir] [out_dir]
Defaults: claude/cstack -> dist/claude-app/cstack

Each zip holds one folder named after the skill, with SKILL.md at its root,
which is the layout Customize > Skills > Upload a skill expects. A CREDITS.md
naming the original authors is added to every skill folder. The script checks
the Agent Skills rules (name: max 64 chars, lowercase letters, digits and
hyphens, no "anthropic"/"claude"; description: 1-1024 chars, no XML tags) and
exits non-zero if any skill breaks them.
"""
import json
import pathlib
import re
import sys
import zipfile

NAME_RE = re.compile(r"^[a-z0-9-]{1,64}$")
XML_RE = re.compile(r"<[^>]+>")


def frontmatter(text):
    m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not m:
        return None
    fields, key = {}, None
    for line in m.group(1).splitlines():
        km = re.match(r"^([A-Za-z_-]+):\s*(.*)$", line)
        if km:
            key = km.group(1)
            fields[key] = km.group(2).strip()
        elif key and line.startswith((" ", "\t")):
            fields[key] = (fields[key] + " " + line.strip()).strip()
    for k, v in fields.items():
        if v in (">", "|", ">-", "|-"):
            fields[k] = ""
        if len(v) >= 2 and v[0] == v[-1] and v[0] in "'\"":
            fields[k] = v[1:-1]
    return fields


def credits_text(plugin_dir):
    readme = (plugin_dir / "README.md").read_text()
    m = re.search(r"## Credits\n(.*?)(?=\n## |\Z)", readme, re.S)
    body = m.group(1).strip() if m else "See the plugin README for credits."
    return (
        "# Credits\n\n"
        "This skill is part of cstack, an unofficial Claude port of "
        "https://github.com/cursor/plugins. It is not original work; credit "
        "belongs to the original authors:\n\n"
        f"{body}\n\n"
        "Source: https://github.com/mitchellbernstein/skills/tree/main/claude/cstack\n"
    )


def main():
    root = pathlib.Path(__file__).resolve().parent.parent
    plugin_dir = root / (sys.argv[1] if len(sys.argv) > 1 else "claude/cstack")
    out_dir = root / (sys.argv[2] if len(sys.argv) > 2 else "dist/claude-app/cstack")
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("*.zip"):
        old.unlink()
    credits = credits_text(plugin_dir)
    errors, built = [], []
    for skill_md in sorted((plugin_dir / "skills").glob("*/SKILL.md")):
        folder = skill_md.parent
        fm = frontmatter(skill_md.read_text())
        name = (fm or {}).get("name", "")
        desc = (fm or {}).get("description", "")
        problems = []
        if fm is None:
            problems.append("no frontmatter")
        if name != folder.name:
            problems.append(f"name {name!r} != folder {folder.name!r}")
        if not NAME_RE.match(name) or "claude" in name or "anthropic" in name:
            problems.append(f"invalid name {name!r}")
        if not desc or len(desc) > 1024 or XML_RE.search(desc):
            problems.append(f"description invalid (len {len(desc)})")
        if problems:
            errors.append(f"{folder.name}: " + "; ".join(problems))
            continue
        zpath = out_dir / f"{folder.name}.zip"
        with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
            for f in sorted(folder.rglob("*")):
                if f.is_file() and "node_modules" not in f.parts and f.name != ".DS_Store":
                    z.write(f, f"{folder.name}/{f.relative_to(folder)}")
            z.writestr(f"{folder.name}/CREDITS.md", credits)
        built.append((folder.name, zpath.stat().st_size))
    manifest = {"plugin": plugin_dir.name, "skills": [n for n, _ in built]}
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"built {len(built)} zips in {out_dir}")
    big = [f"{n} ({s // 1024} KB)" for n, s in built if s > 1_000_000]
    if big:
        print("over 1 MB:", ", ".join(big))
    if errors:
        print("FAILED:\n  " + "\n  ".join(errors))
        sys.exit(1)


if __name__ == "__main__":
    main()
