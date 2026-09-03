#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = dirname(fileURLToPath(import.meta.url));
const root = resolve(process.argv[2] || process.cwd());
const START = '<!-- wstack:managed:start -->';
const END = '<!-- wstack:managed:end -->';
const LEGACY = 'For substantial development or evaluation work, start in w-mode; resume any active .wstack run before creating another.';
const BLOCK = `${START}\n## wstack\n\nFor substantial development, evaluation, or decision-grade research, enter w-mode automatically and resume a matching active \`.wstack\` run before creating another. Use grill when consequential decisions remain unresolved; announce transitions and honor a task-level opt-out. Run setup-wstack only when the user explicitly asks.\n${END}`;
async function instructionPaths(dir, result = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['node_modules', '.wstack'].includes(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await instructionPaths(path, result);
    else if (['AGENTS.md', 'CLAUDE.md'].includes(entry.name)) result.push(path);
  }
  return result;
}
async function manageInstructions() {
  await mkdir(root, { recursive: true });
  const paths = await instructionPaths(root);
  const changed = [];
  for (const name of ['AGENTS.md', 'CLAUDE.md']) {
    const path = join(root, name);
    if (!paths.includes(path)) { await writeFile(path, `${BLOCK}\n`, { mode: 0o644 }); paths.push(path); changed.push(relative(root, path)); }
  }
  for (const path of paths.sort()) {
    const before = await readFile(path, 'utf8');
    let after = before;
    if (after.includes(START) && after.includes(END)) after = after.replace(new RegExp(`${START}[\\s\\S]*?${END}`, 'g'), BLOCK);
    else if (after.includes(LEGACY)) after = after.replace(LEGACY, BLOCK);
    else if (after.trim()) after = `${after.replace(/\s*$/, '')}\n\n${BLOCK}\n`;
    else after = `${BLOCK}\n`;
    if (after !== before) { await writeFile(path, after); changed.push(relative(root, path)); }
  }
  return changed;
}
const instructionChanges = await manageInstructions();
const target = join(root, '.wstack', 'bin');
await mkdir(target, { recursive: true });
const core = await readFile(join(source, 'core.mjs'), 'utf8');
const cli = await readFile(join(source, 'wstack.mjs'), 'utf8');
const bundled = `#!/usr/bin/env node\n${core.replace(/export /g, '')}\n${cli.replace(/^#!.*\n/, '').replace("import { readFile } from 'node:fs/promises';\n", '').replace("import { Workspace, WstackError } from './core.mjs';\n", '').replace("import { PRODUCT_VERSION, PROTOCOL_VERSION } from './version.mjs';\n", '')}`;
await writeFile(join(target, 'wstack.mjs'), bundled, { mode: 0o755 });
await writeFile(join(target, 'version.mjs'), await readFile(join(source, 'version.mjs')), { mode: 0o644 });
await writeFile(join(target, 'projection.mjs'), await readFile(join(source, 'projection.mjs')), { mode: 0o644 });
await writeFile(join(target, 'runtime.json'), await readFile(join(source, 'runtime-manifest.json')));
const schemaTarget = join(target, 'schemas');
await mkdir(schemaTarget, { recursive: true });
for (const name of await readdir(join(source, 'schemas'))) {
  if (name.endsWith('.json')) await writeFile(join(schemaTarget, name), await readFile(join(source, 'schemas', name)));
}
process.stdout.write(`${JSON.stringify({ runtime: join(target, 'wstack.mjs'), instructionChanges }, null, 2)}\n`);
