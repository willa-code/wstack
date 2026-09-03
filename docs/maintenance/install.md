# Install and update wstack

This is the canonical consumer install reference. The bootstrap release is
`2.1.0`.

## Consumers: install the current channel

In a repository where you want to follow the continuously installable `main`
channel, use the public skills installer command:

```bash
npx skills@latest add willa-code/wstack
```

The setup skill installs a dependency-free runtime under `.wstack/bin/`.

For a reproducible formal release, keep the installer channel explicit and pin
the source tag:

```bash
npx skills@latest add willa-code/wstack#v2.1.0
```

The `#v2.1.0` fragment is the source ref syntax; `@v2.1.0` would select a
skill name and is not a release pin.

Maintainers and CI use the exact installer version when collecting
deterministic evidence:

```bash
npx --yes skills@1.5.23 add willa-code/wstack#v2.1.0
```

## Consumers: update deliberately

Choose a new release, review its changelog and migration notes, and rerun the
same command with only the source tag changed. For example:

```bash
npx skills@latest add willa-code/wstack#v2.1.1
```

Keep the consumer's generated `.wstack/` state and review any managed
instruction changes as part of the update.

## Producers: repository maintenance

If you are changing this wstack repository itself, you are a producer, not a
consumer. Do not install wstack into this checkout and do not use the consumer
command as a test of local edits. Use `npm ci` and the verification scripts in
[`MAINTAINING.md`](../../MAINTAINING.md); exercise the source installer in an
isolated temporary consumer only when testing installer compatibility.

Maintainers and CI may pin the installer itself (currently `skills@1.5.23`)
for deterministic compatibility checks. That pin is independent of the wstack
source tag and is not a consumer requirement.
