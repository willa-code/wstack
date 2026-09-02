#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] || process.cwd());
let packageJson = null;
try { packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const deterministicCommands = {};
for (const name of ['test', 'lint', 'typecheck', 'build', 'validate']) {
  if (packageJson?.scripts?.[name]) deterministicCommands[name] = { argv: ['npm', 'run', name], mode: name === 'build' ? 'mutating' : 'read-only' };
}
const gh = spawnSync('gh', ['--version'], { cwd: root, encoding: 'utf8', shell: false });
async function instructionFiles(dir, relative = '') {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['node_modules', '.wstack'].includes(entry.name)) continue;
    const path = join(dir, entry.name), rel = relative ? join(relative, entry.name) : entry.name;
    if (entry.isDirectory()) found.push(...await instructionFiles(path, rel));
    else if (['AGENTS.md', 'CLAUDE.md'].includes(entry.name)) found.push(rel);
  }
  return found.sort();
}
const discovery = {
  schemaVersion: '1.0.0',
  deterministicCommands,
  adapters: { github: { available: gh.status === 0, authenticated: null, discoveryOnly: true } },
  discovered: { packageManager: packageJson ? 'npm-compatible' : null, packageScripts: Object.keys(packageJson?.scripts || {}).sort(), instructionFiles: await instructionFiles(root) },
};
process.stdout.write(`${JSON.stringify(discovery, null, 2)}\n`);
