#!/usr/bin/env node
import { access, mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { DEFAULT_ROOT, VerificationFailure, checkCleanliness, compareDirectories, loadCatalog } from './index.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const DEFAULT_SANDBOX_TIMEOUT_MS = 180000;
export const LATEST_SANDBOX_TIMEOUT_MS = 300000;

export function resolveSandboxTimeoutMs(options = {}) {
  const env = Number.parseInt(process.env.WSTACK_SANDBOX_TIMEOUT_MS || '', 10);
  if (Number.isFinite(env) && env > 0) return env;
  if (Number.isFinite(options.timeoutMs) && options.timeoutMs > 0) return options.timeoutMs;
  const latest = options.latest || process.env.WSTACK_VERIFY_LATEST === '1';
  return latest ? LATEST_SANDBOX_TIMEOUT_MS : DEFAULT_SANDBOX_TIMEOUT_MS;
}

export function describeInstallResult(result, timeoutMs, durationMs) {
  const details = [];
  details.push(`timeout ${timeoutMs}ms, elapsed ${durationMs}ms`);
  if (result.error) details.push(`error ${result.error.code || result.error.message}`);
  if (result.signal) details.push(`signal ${result.signal}`);
  details.push(`exit ${String(result.status)}`);
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
  if (output) details.push(`output: ${output.slice(0, 2000)}`);
  else details.push('no installer output captured');
  if (result.error?.code === 'ETIMEDOUT' || result.signal) {
    details.push('likely cause: network slowness resolving/installing skills@latest or cold npx cache exceeding the timeout; rerun is often sufficient');
  }
  return details.join(' | ');
}

function renderArgs(template, values) {
  return template.map(value => String(value).replaceAll('{source}', values.source).replaceAll('{consumer}', values.consumer).replaceAll('{agentDir}', values.agentDir).replaceAll('{cliVersion}', values.cliVersion));
}

async function isReadable(path) {
  try { await access(path); return true; } catch { return false; }
}

export async function runSandbox(options = {}) {
  const root = resolve(options.root || process.env.WSTACK_ROOT || DEFAULT_ROOT);
  const catalog = options.catalog || await loadCatalog(options.catalogPath);
  const cleanliness = await checkCleanliness(root);
  if (cleanliness.length) throw new VerificationFailure(cleanliness, 'source checkout is not clean enough for sandbox verification');

  const cliVersion = catalog.distribution.skillsCliVersion;
  const latest = options.latest || process.env.WSTACK_VERIFY_LATEST === '1';
  const source = options.source || root;
  const override = options.cliCommand || (process.env.WSTACK_SKILLS_CLI_COMMAND ? JSON.parse(process.env.WSTACK_SKILLS_CLI_COMMAND) : null);
  const localCli = join(root, 'node_modules', '.bin', 'skills');
  const timeoutMs = resolveSandboxTimeoutMs({ ...options, latest });
  // Retry once for networked installs: npx skills@latest resolution is
  // inherently variable on cold caches. Custom CLI overrides (tests) stay
  // single-attempt for determinism.
  const maxAttempts = override ? 1 : (latest || options.network || process.env.WSTACK_VERIFY_NETWORK === '1' ? 2 : 1);
  const installAttempts = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const consumer = await mkdtemp(join(options.tempRoot || tmpdir(), 'wstack-sandbox-'));
    const agentDir = join(consumer, catalog.distribution.agentDirectory);
    let preserved = true;
    try {
      await mkdir(agentDir, { recursive: true });
      await writeFile(join(consumer, 'package.json'), '{"private":true}\n');
      const command = override?.[0] || process.env.WSTACK_SKILLS_CLI_BIN || (!latest && await isReadable(localCli) ? localCli : 'npx');
      const template = override ? override.slice(1) : command === 'npx'
        ? ['--yes', ...(options.network || latest || process.env.WSTACK_VERIFY_NETWORK === '1' ? [] : ['--offline']), `${catalog.distribution.skillsCliPackage}@${latest ? 'latest' : cliVersion}`, 'add', '{source}', '--agent', 'codex', '--skill', '*', '--copy', '--yes']
        : ['add', '{source}', '--agent', 'codex', '--skill', '*', '--copy', '--yes'];
      const args = renderArgs(template, { source, consumer, agentDir, cliVersion });
      const startedAt = Date.now();
      const result = spawnSync(command, args, {
        cwd: consumer,
        env: { ...process.env, WSTACK_VERIFY_SANDBOX: '1' },
        encoding: 'utf8',
        timeout: timeoutMs,
        shell: false,
      });
      const durationMs = Date.now() - startedAt;
      if (result.status !== 0) {
        const detail = describeInstallResult(result, timeoutMs, durationMs);
        installAttempts.push(`attempt ${attempt}/${maxAttempts}: ${command} ${args.join(' ')} | ${detail}`);
        if (attempt < maxAttempts) {
          await rm(consumer, { recursive: true, force: true });
          continue;
        }
        throw new VerificationFailure([`skills CLI installation failed (${command} ${args.join(' ')})`, ...installAttempts, `sandbox preserved at ${consumer}`, `cleanup: rm -rf '${consumer.replaceAll("'", "'\\''")}'`], 'sandbox installation failed');
      }
      const entries = (await readdir(agentDir, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
      const expected = catalog.skills.map(skill => skill.name).sort();
      const issues = [];
      for (const name of expected) {
        if (!entries.includes(name)) { issues.push(`${agentDir}: missing installed skill ${name}`); continue; }
        issues.push(...await compareDirectories(join(root, catalog.distribution.skillsDirectory, name), join(agentDir, name)));
      }
      for (const name of entries) if (!expected.includes(name) && name !== 'maintain-wstack') issues.push(`${agentDir}: unexpected installed skill ${name}`);
      if (issues.length) throw new VerificationFailure([...issues, `sandbox preserved at ${consumer}`, `cleanup: rm -rf '${consumer.replaceAll("'", "'\\''")}'`], 'sandbox content comparison failed');
      preserved = false;
      await rm(consumer, { recursive: true, force: true });
      return { ok: true, consumer, cleaned: true, command: [command, ...args], attempts: attempt };
    } catch (error) {
      if (error instanceof VerificationFailure) throw error;
      throw new VerificationFailure([error.message, `sandbox preserved at ${consumer}`, `cleanup: rm -rf '${consumer.replaceAll("'", "'\\''")}'`], 'sandbox failed');
    } finally {
      // Failure directories are deliberately retained for diagnosis. On success
      // the explicit removal above is the only checkout-independent cleanup.
      if (!preserved) await rm(consumer, { recursive: true, force: true }).catch(() => {});
    }
  }
  throw new VerificationFailure(installAttempts, 'sandbox installation failed');
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(join(HERE, 'verify-sandbox.mjs'))) {
  const argv = process.argv.slice(2);
  const args = new Set(argv);
  const sourceIndex = argv.indexOf('--source');
  const source = sourceIndex >= 0 ? argv[sourceIndex + 1] : undefined;
  try {
    if (sourceIndex >= 0 && !source) throw new VerificationFailure(['--source requires a value'], 'invalid sandbox arguments');
    const result = await runSandbox({ network: args.has('--network') || args.has('--latest') || Boolean(source), latest: args.has('--latest'), source });
    process.stdout.write(`verify:sandbox passed (external consumer cleaned)\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n${(error.issues || []).map(issue => `- ${issue}`).join('\n')}\n`);
    process.exitCode = 1;
  }
}
