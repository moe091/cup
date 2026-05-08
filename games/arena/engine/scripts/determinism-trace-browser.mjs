import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const parseArg = (name, fallback) => {
  const flag = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(flag));
  return raw ? raw.slice(flag.length) : fallback;
};

const browser = parseArg('browser', 'chromium');
const ticks = parseArg('ticks', '3000');
const sampleEvery = parseArg('sampleEvery', '1');
const out = parseArg('out', `determinism-results/browser-trace-${browser}.json`);
const playwrightDefaultOut = path.resolve(`determinism-results/browser-trace-${browser}.json`);
const playwrightAltOut = path.resolve(`playwright/determinism-results/browser-trace-${browser}.json`);

const result = spawnSync(
  'pnpm',
  ['exec', 'playwright', 'test', 'playwright/determinism-trace.spec.ts', '--project', browser],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      ARENA_TRACE_TICKS: ticks,
      ARENA_TRACE_SAMPLE_EVERY: sampleEvery,
    },
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const sourceOutPath = fs.existsSync(playwrightDefaultOut)
  ? playwrightDefaultOut
  : fs.existsSync(playwrightAltOut)
    ? playwrightAltOut
    : null;

if (sourceOutPath === null) {
  throw new Error(
    `Expected output file was not written. Checked: ${playwrightDefaultOut} and ${playwrightAltOut}`,
  );
}

const outPath = path.resolve(out);
if (outPath !== sourceOutPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.copyFileSync(sourceOutPath, outPath);
}

const content = fs.readFileSync(outPath, 'utf8');
process.stdout.write(content);
