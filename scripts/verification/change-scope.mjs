#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const base = process.env.BASE_SHA;
const head = process.env.HEAD_SHA || 'HEAD';
let files = [];
if (base && !/^0+$/.test(base)) {
  const diff = spawnSync('git', ['diff', '--name-only', base, head], { encoding: 'utf8' });
  if (diff.status !== 0) {
    process.stderr.write(diff.stderr || 'Unable to classify changed files.\n');
    process.exit(1);
  }
  files = diff.stdout.trim().split(/\r?\n/).filter(Boolean);
}
const releaseRelevant = !files.length || files.some(path =>
  path.startsWith('skills/') ||
  path.startsWith('scripts/verification/') ||
  path.startsWith('scripts/release/') ||
  path.startsWith('tests/verification/') ||
  path.startsWith('tests/release/') ||
  path.startsWith('.github/workflows/') ||
  path.startsWith('.agents/skills/maintain-wstack/') ||
  path.startsWith('.changeset/') ||
  path === 'package.json' || path === 'package-lock.json' ||
  path === 'README.md' || path === 'CHANGELOG.md' ||
  path === 'MAINTAINING.md' || path === 'docs/maintenance/install.md'
);
process.stdout.write(`${releaseRelevant ? 'release-relevant' : 'no-release'}\n`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `release_relevant=${releaseRelevant}\n`);
