#!/usr/bin/env node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
    stdio: options.capture ? 'pipe' : 'inherit',
  });
  if (result.status !== 0) {
    const detail = options.capture ? [result.stdout, result.stderr].filter(Boolean).join('\n').trim() : '';
    throw new Error(`${command} ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
  return result.stdout?.trim() || '';
}

const rehearsal = await mkdtemp(join(tmpdir(), 'wstack-release-dry-run-'));
let succeeded = false;
try {
  const packageJson = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  const changesetConfig = JSON.parse(await readFile(join(ROOT, '.changeset/config.json'), 'utf8'));
  if (!packageJson.private) throw new Error('package.json must remain private');
  if (changesetConfig.privatePackages?.version !== true || changesetConfig.privatePackages?.tag !== false) {
    throw new Error('Changesets must version the private package without publishing package tags');
  }

  run(process.execPath, ['scripts/verification/sync-versions.mjs', '--check']);
  run('npm', ['run', 'verify']);

  const version = packageJson.version;
  const tag = `v${version}`;
  const existingTag = run('git', ['tag', '--list', tag], { capture: true });
  if (existingTag) throw new Error(`${tag} already exists locally; releases are immutable and must fix forward`);

  const notesPath = join(rehearsal, 'release-notes.md');
  run(process.execPath, ['scripts/release/extract-notes.mjs', version, notesPath]);
  const notes = await readFile(notesPath, 'utf8');
  if (!notes.trim()) throw new Error(`CHANGELOG.md has no usable notes for ${version}`);

  await writeFile(join(rehearsal, 'evidence.json'), `${JSON.stringify({
    productVersion: version,
    proposedTag: tag,
    verification: 'passed',
    installerSandbox: 'passed and cleaned',
    externalMutations: false,
  }, null, 2)}\n`);

  succeeded = true;
  process.stdout.write(`release dry-run passed for ${tag} (no push, merge, tag, release, or publication performed)\n`);
} catch (error) {
  process.stderr.write(`release dry-run failed: ${error.message}\n`);
  process.stderr.write(`diagnostic evidence preserved at ${rehearsal}\n`);
  process.exitCode = 1;
} finally {
  if (succeeded) await rm(rehearsal, { recursive: true, force: true });
}
