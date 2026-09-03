#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const checkOnly = process.argv.includes('--check');
const packagePath = join(ROOT, 'package.json');
const runtimePath = join(ROOT, 'skills/setup-wstack/scripts/runtime/runtime-manifest.json');
const catalogPath = join(ROOT, 'scripts/verification/skill-catalog.json');
const versionPath = join(ROOT, 'skills/setup-wstack/scripts/runtime/version.mjs');

const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
const runtime = JSON.parse(await readFile(runtimePath, 'utf8'));
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const compatible = runtime.compatibleProtocols;
if (!Array.isArray(compatible) || !compatible.includes(runtime.protocolVersion)) {
  throw new Error('runtime-manifest.json compatibleProtocols must include protocolVersion');
}

runtime.productVersion = packageJson.version;
catalog.product.version = packageJson.version;
catalog.protocol.version = runtime.protocolVersion;
catalog.protocol.compatibleVersions = compatible;
catalog.distribution.sourceRevision = `#v${packageJson.version}`;

const versionModule = `// Derived release metadata. Run npm run version after changing an authoritative version.\nexport const PRODUCT_VERSION = '${packageJson.version}';\nexport const PROTOCOL_VERSION = '${runtime.protocolVersion}';\nexport const COMPATIBLE_PROTOCOLS = new Set(${JSON.stringify(compatible)});\n`;
const outputs = new Map([
  [runtimePath, `${JSON.stringify(runtime, null, 2)}\n`],
  [catalogPath, `${JSON.stringify(catalog, null, 2)}\n`],
  [versionPath, versionModule],
]);

const stale = [];
for (const [path, expected] of outputs) {
  const actual = await readFile(path, 'utf8');
  if (actual === expected) continue;
  if (checkOnly) stale.push(path);
  else await writeFile(path, expected);
}
if (stale.length) {
  process.stderr.write(`Derived version metadata is stale:\n${stale.map(path => `- ${path}`).join('\n')}\nRun npm run version to synchronize it.\n`);
  process.exitCode = 1;
} else if (checkOnly) process.stdout.write('version metadata is synchronized\n');
