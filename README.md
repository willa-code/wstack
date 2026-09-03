# wstack

wstack turns intent into verified delivery and keeps the work resumable.

wstack has two parts:
- skills that tell the active agent how to work;
- a small runtime that validates and records the result in `.wstack/`.

## install and start

```bash
npx skills@latest add willa-code/wstack
```

Then use `w-mode` as the default entry point for substantial development,
evaluation, or decision-grade research.

The model may enter w-mode
automatically when those indicators are present.

See [the guide](docs/guide/README.md) for more details.

## motivation

Inspired by [Matt's awesome skills](https://github.com/mattpocock/skills/tree/main)
and [Lauren's fantastic pstack](https://github.com/cursor/plugins/tree/main/pstack).
