#!/usr/bin/env node
import { DEFAULT_ROOT, verifyFast } from './index.mjs';

const result = await verifyFast(process.env.WSTACK_ROOT || DEFAULT_ROOT);
if (result.ok) {
  process.stdout.write(`verify:fast passed (${result.catalog.skills.length} skills)\n`);
} else {
  process.stderr.write(`verify:fast failed:\n${result.issues.map(issue => `- ${issue}`).join('\n')}\n`);
  process.exitCode = 1;
}
