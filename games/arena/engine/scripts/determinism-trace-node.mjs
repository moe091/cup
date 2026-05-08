import { runDeterminismTrace } from '../dist/traceScenario.js';
import fs from 'node:fs';
import path from 'node:path';

const parseIntArg = (name, fallback) => {
  const flag = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(flag));
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw.slice(flag.length), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const ticks = parseIntArg('ticks', 3000);
const sampleEvery = parseIntArg('sampleEvery', 1);
const outArg = process.argv.find((arg) => arg.startsWith('--out='));
const outPath = outArg ? outArg.slice('--out='.length) : null;

const result = runDeterminismTrace(ticks, sampleEvery);
const serialized = `${JSON.stringify(result, null, 2)}\n`;

if (outPath) {
  const resolvedOutPath = path.resolve(outPath);
  fs.mkdirSync(path.dirname(resolvedOutPath), { recursive: true });
  fs.writeFileSync(resolvedOutPath, serialized, 'utf8');
}

process.stdout.write(serialized);
