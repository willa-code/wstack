#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_RELEASE_CHECKS = [
  'Core verification (Node 20, macOS)',
  'Full verification (Node 22.20, macOS)',
  'Latest installer compatibility (release-relevant changes)',
];

export function verifyPullRequestChecks(checks) {
  for (const name of REQUIRED_RELEASE_CHECKS) {
    const matches = checks.filter(check => check.name === name);
    if (matches.length !== 1 || matches[0].state !== 'SUCCESS') {
      throw new Error(`Required release check is missing or unsuccessful: ${name}`);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const checks = JSON.parse(readFileSync(0, 'utf8'));
  verifyPullRequestChecks(checks);
  process.stdout.write('required release checks passed\n');
}
