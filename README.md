# wstack

wstack turns intent into verified delivery and keeps the work resumable.

wstack has two parts:
- skills tell the active agent how to work, and a small
runtime validates and records the result in `.wstack/`.
- meaningful decisions, changes, failures, proof, and delivery are
recorded.

## install and start

```bash
npx skills@latest add willa-code/wstack
```

Run `setup-wstack` once in a repository when you explicitly want to configure
it. Setup installs a pinned, dependency-free runtime under `.wstack/bin/`,
records project policy, and manages marked guidance in root `AGENTS.md` and
`CLAUDE.md` (plus existing nested files with those names).

Then use `w-mode` as the default entry point for substantial development,
evaluation, or decision-grade research. The model may enter w-mode
automatically when those indicators are present; lightweight work remains
outside it.

See [the guide](docs/guide/README.md) for more details
