#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, readlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

function run(command, args, capture = false) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
    stdio: capture ? 'pipe' : 'inherit',
  });
  if (result.status !== 0) process.exit(result.status || 1);
  return result.stdout || '';
}

async function snapshot() {
  const listed = run('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], true);
  const files = listed.split('\0').filter(Boolean).sort();
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(`path\0${file}\0`);
    const path = resolve(ROOT, file);
    try {
      const metadata = await lstat(path);
      hash.update(`mode\0${metadata.mode}\0`);
      if (metadata.isSymbolicLink()) hash.update(`link\0${await readlink(path)}\0`);
      else if (metadata.isFile()) hash.update(await readFile(path));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      hash.update('missing\0');
    }
  }
  return { digest: hash.digest('hex'), files };
}

const before = await snapshot();
run(process.execPath, ['scripts/verification/verify.mjs']);
run(process.execPath, ['--test']);
run(process.execPath, ['scripts/verification/verify-sandbox.mjs']);
const after = await snapshot();

if (after.digest !== before.digest) {
  process.stderr.write('verify changed the repository working state; inspect and restore only verification-generated changes.\n');
  process.stderr.write(`Before digest: ${before.digest}\n`);
  process.stderr.write(`After digest:  ${after.digest}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('verify passed without changing repository state\n');
}
