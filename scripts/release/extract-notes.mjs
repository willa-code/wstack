#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function extractReleaseNotes(changelog, version) {
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`^## ${escaped}(?:[ \\t]+[^\\n]*)?\\r?\\n([\\s\\S]*?)(?=^##[ \\t]+|(?![\\s\\S]))`, 'm').exec(changelog);
  if (!match?.[1]?.trim()) throw new Error(`CHANGELOG.md has no release notes for ${version}`);
  return `${match[1].trim()}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const [version, output] = process.argv.slice(2);
  if (!version || !output) throw new Error('Usage: extract-notes.mjs VERSION OUTPUT');
  const changelog = await readFile('CHANGELOG.md', 'utf8');
  await writeFile(output, extractReleaseNotes(changelog, version));
}
