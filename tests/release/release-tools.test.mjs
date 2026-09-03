import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractReleaseNotes } from '../../scripts/release/extract-notes.mjs';
import { REQUIRED_RELEASE_CHECKS, verifyPullRequestChecks } from '../../scripts/release/verify-pr-checks.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

test('release notes extract the complete requested changelog section', async () => {
  const changelog = await readFile(resolve(ROOT, 'CHANGELOG.md'), 'utf8');
  const notes = extractReleaseNotes(changelog, '2.1.0');
  assert.match(notes, /First formal public release/);
  assert.match(notes, /13-skill workflow suite/);
  assert.doesNotMatch(notes, /^## /m);
});

test('release notes stop before the next version heading', () => {
  const notes = extractReleaseNotes('# Log\n\n## 2.0.0\n\nCurrent.\n\n## 1.0.0\n\nOld.\n', '2.0.0');
  assert.equal(notes, 'Current.\n');
});

test('release notes reject absent or empty versions', () => {
  assert.throws(() => extractReleaseNotes('## 2.0.0\n\n', '2.0.0'), /no release notes/);
  assert.throws(() => extractReleaseNotes('## 2.0.0\n\nNotes.\n', '3.0.0'), /no release notes/);
});

test('release workflow verifies the remote tag before creating the GitHub Release', async () => {
  const workflow = await readFile(resolve(ROOT, '.github/workflows/release.yml'), 'utf8');
  const push = workflow.indexOf('git push origin "$tag"');
  const verify = workflow.indexOf('Verify installation from the exact remote tag');
  const release = workflow.indexOf('gh release create "$tag"');
  assert.ok(push >= 0 && verify > push && release > verify);
  assert.match(workflow, /remote_commit.*git rev-parse HEAD/s);
  assert.doesNotMatch(workflow, /gh pr checks .*--required/);
  assert.match(workflow, /gh pr checks .*verify-pr-checks\.mjs/);
});

test('release metadata keeps npm publication disabled', async () => {
  const packageJson = JSON.parse(await readFile(resolve(ROOT, 'package.json'), 'utf8'));
  const config = JSON.parse(await readFile(resolve(ROOT, '.changeset/config.json'), 'utf8'));
  assert.equal(packageJson.private, true);
  assert.deepEqual(config.privatePackages, { version: true, tag: false });
  assert.equal(packageJson.scripts.release, undefined);
});

test('release provenance requires each named CI check to succeed exactly once', () => {
  const passing = REQUIRED_RELEASE_CHECKS.map(name => ({ name, state: 'SUCCESS' }));
  assert.doesNotThrow(() => verifyPullRequestChecks(passing));
  assert.throws(() => verifyPullRequestChecks(passing.slice(1)), /missing or unsuccessful/);
  assert.throws(() => verifyPullRequestChecks(passing.map((check, index) => index ? check : { ...check, state: 'FAILURE' })), /missing or unsuccessful/);
  assert.throws(() => verifyPullRequestChecks([...passing, passing[0]]), /missing or unsuccessful/);
});
