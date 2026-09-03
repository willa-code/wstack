#!/usr/bin/env node
import { DEFAULT_ROOT, verifyFull } from './index.mjs';

const args = new Set(process.argv.slice(2));
const result = await verifyFull(process.env.WSTACK_ROOT || DEFAULT_ROOT, { network: args.has('--network') || process.env.WSTACK_VERIFY_NETWORK === '1' });
if (result.ok) {
  process.stdout.write(`verify passed (${result.catalog.skills.length} skills)\n`);
} else {
  process.stderr.write(`verify failed:\n${result.issues.map(issue => `- ${issue}`).join('\n')}\n`);
  process.exitCode = 1;
}
