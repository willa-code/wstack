#!/usr/bin/env python3
"""Validate the public wstack v2.1 skill surface and its local contracts."""

from pathlib import Path
import re
import sys


ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "skills")
errors = []

EXPECTED_SKILLS = {
    "setup-wstack", "w-mode", "grill", "specify", "plan-tasks",
    "implement-run", "verify-review", "continue-work", "understand",
    "learn", "prototype", "tdd", "open-pr",
}
HUMAN_ONLY_SKILLS = {"setup-wstack"}
WORKFLOW_SECTIONS = {
    "Entry", "Required artifacts", "Transitions", "Allowed skips",
    "Gates", "Evidence and review", "Terminal condition", "Reply projection",
}

if not ROOT.is_dir():
    print(f"Suite validation failed:\n- suite root does not exist: {ROOT}")
    raise SystemExit(1)

skills = sorted(ROOT.glob("*/SKILL.md"))
if not skills:
    errors.append(f"{ROOT}: no skills found")
actual_skills = {path.parent.name for path in skills}
actual_directories = {path.name for path in ROOT.iterdir() if path.is_dir()}
if actual_skills != EXPECTED_SKILLS:
    missing = sorted(EXPECTED_SKILLS - actual_skills)
    extra = sorted(actual_skills - EXPECTED_SKILLS)
    if missing:
        errors.append(f"{ROOT}: missing public v2 skills: {', '.join(missing)}")
    if extra:
        errors.append(f"{ROOT}: unexpected public skills: {', '.join(extra)}")
if actual_directories != EXPECTED_SKILLS:
    leftovers = sorted(actual_directories - EXPECTED_SKILLS)
    missing_directories = sorted(EXPECTED_SKILLS - actual_directories)
    if leftovers:
        errors.append(f"{ROOT}: retired or unknown skill directories remain: {', '.join(leftovers)}")
    if missing_directories:
        errors.append(f"{ROOT}: expected skill directories are missing: {', '.join(missing_directories)}")

def check_local_links(skill_file: Path, text: str) -> None:
    """Catch broken relative Markdown links without requiring a YAML package."""
    for target in re.findall(r"\]\(([^)]+)\)", text):
        target = target.strip().split("#", 1)[0].split("?", 1)[0]
        if not target or target.startswith(("http://", "https://", "mailto:")):
            continue
        resolved = (skill_file.parent / target).resolve()
        if not resolved.exists():
            errors.append(f"{skill_file}: broken local link {target!r}")

def check_frontmatter(skill_file: Path, text: str) -> None:
    """Require the minimal frontmatter contract used by the distribution."""
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        errors.append(f"{skill_file}: frontmatter must start with ---")
        return
    try:
        end = lines.index("---", 1)
    except ValueError:
        errors.append(f"{skill_file}: frontmatter must close with ---")
        return
    frontmatter = "\n".join(lines[1:end])
    if not re.search(r"^name:\s*[^\n]+$", frontmatter, re.MULTILINE):
        errors.append(f"{skill_file}: missing name in frontmatter")
    if not re.search(r"^description:\s*[^\n]+$", frontmatter, re.MULTILINE):
        errors.append(f"{skill_file}: missing description in frontmatter")

for skill_file in skills:
    folder = skill_file.parent.name
    text = skill_file.read_text()
    check_frontmatter(skill_file, text)
    match = re.search(r"^name:\s*([^\n]+)$", text, re.MULTILINE)
    if not match:
        errors.append(f"{skill_file}: missing name")
        continue
    name = match.group(1).strip().strip('"')
    if name != folder:
        errors.append(f"{skill_file}: name {name!r} does not match folder")
    if not re.search(r"^description:\s*.+$", text, re.MULTILINE):
        errors.append(f"{skill_file}: missing description")

    human_only = bool(re.search(r"^disable-model-invocation:\s*true\s*$", text, re.MULTILINE))
    policy_file = skill_file.parent / "agents" / "openai.yaml"
    if human_only and not policy_file.exists():
        errors.append(f"{skill_file}: human-only skill lacks agents/openai.yaml")
    if policy_file.exists():
        policy = policy_file.read_text()
        blocked = bool(re.search(r"^\s*allow_implicit_invocation:\s*false\s*$", policy, re.MULTILINE))
        if not human_only:
            errors.append(f"{policy_file}: Codex policy exists but skill is not human-only")
        elif not blocked:
            errors.append(f"{policy_file}: policy must set allow_implicit_invocation: false")

    expected_human_only = folder in HUMAN_ONLY_SKILLS
    if human_only != expected_human_only:
        expected = "human-only" if expected_human_only else "model-invocable"
        errors.append(f"{skill_file}: invocation policy must be {expected}")

    check_local_links(skill_file, text)

# A policy file without a matching skill is never discoverable and usually
# means a rename or deletion left stale invocation metadata behind.
for policy_file in sorted(ROOT.glob("*/agents/openai.yaml")):
    if not (policy_file.parent.parent / "SKILL.md").exists():
        errors.append(f"{policy_file}: orphaned Codex policy; matching SKILL.md is missing")

# The suite is intentionally flat so its layout matches the npx distribution
# contract and the human-readable catalog.
for nested_skill in sorted(ROOT.rglob("SKILL.md")):
    if nested_skill not in skills:
        errors.append(f"{nested_skill}: nested skill layout is not supported; place skills directly under {ROOT}")

# Progressive workflow references are part of the public protocol. Each graph
# must expose the same typed decision points so the router can reason without
# loading unrelated workflows.
workflow_dir = ROOT / "w-mode" / "references" / "workflows"
workflow_files = sorted(path for path in workflow_dir.glob("*.md") if path.name != "README.md")
expected_workflows = {
    "feature.md", "bug.md", "refactor-migration.md", "hillclimb.md",
    "product-evaluation.md", "agent-evaluation.md", "decision-research.md",
}
if {path.name for path in workflow_files} != expected_workflows:
    errors.append(f"{workflow_dir}: workflow reference set does not match the v2.1 contract")
for workflow_file in workflow_files:
    text = workflow_file.read_text()
    headings = set(re.findall(r"^##\s+(.+?)\s*$", text, re.MULTILINE))
    headings.update(re.findall(r"^\*\*([^*]+):\*\*", text, re.MULTILINE))
    for section in sorted(WORKFLOW_SECTIONS - headings):
        errors.append(f"{workflow_file}: missing required section {section!r}")

# Validate every relative Markdown link in every distributed Markdown resource,
# not only links directly visible from SKILL.md.
for markdown_file in sorted(ROOT.rglob("*.md")):
    check_local_links(markdown_file, markdown_file.read_text())

if errors:
    print("Suite validation failed:")
    print("\n".join(f"- {error}" for error in errors))
    raise SystemExit(1)

print(f"Suite validation passed: {len(skills)} skills checked.")
