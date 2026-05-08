import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const MASTER_PATH = path.resolve('determinism-results/master-trace.json');
const BROWSERS = ['chromium', 'firefox', 'webkit'];

const readTrace = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
};

const findFirstTraceDiff = (masterTrace, candidateTrace) => {
  const maxLen = Math.max(masterTrace.length, candidateTrace.length);
  for (let i = 0; i < maxLen; i += 1) {
    const m = masterTrace[i];
    const c = candidateTrace[i];
    if (!m || !c) {
      return { index: i, master: m ?? null, candidate: c ?? null };
    }
    if (m.tick !== c.tick || m.hash !== c.hash) {
      return { index: i, master: m, candidate: c };
    }
  }
  return null;
};

if (!fs.existsSync(MASTER_PATH)) {
  throw new Error(
    `Missing master trace at ${MASTER_PATH}. Run: pnpm --filter @cup/arena-engine determinism:master`,
  );
}

const master = readTrace(MASTER_PATH);
let failed = false;

for (const browser of BROWSERS) {
  const browserOutPath = path.resolve(`determinism-results/${browser}-trace.json`);

  const runResult = spawnSync(
    'pnpm',
    [
      'run',
      'determinism:trace:browser',
      '--',
      `--browser=${browser}`,
      '--ticks=3000',
      '--sampleEvery=1',
      `--out=${browserOutPath}`,
    ],
    { stdio: 'inherit' },
  );

  if (runResult.status !== 0) {
    failed = true;
    continue;
  }

  const candidate = readTrace(browserOutPath);

  const headerMatch =
    candidate.ticks === master.ticks && candidate.sampleEvery === master.sampleEvery;
  const finalHashMatch = candidate.finalHash === master.finalHash;
  const firstDiff = findFirstTraceDiff(master.trace, candidate.trace);

  if (!headerMatch || !finalHashMatch || firstDiff !== null) {
    failed = true;
    process.stdout.write(`\n[FAIL] ${browser} diverged from master trace.\n`);
    if (!headerMatch) {
      process.stdout.write(
        `  Header mismatch: master(ticks=${master.ticks}, sampleEvery=${master.sampleEvery}) vs ${browser}(ticks=${candidate.ticks}, sampleEvery=${candidate.sampleEvery})\n`,
      );
    }
    if (!finalHashMatch) {
      process.stdout.write(
        `  Final hash mismatch: master=${master.finalHash}, ${browser}=${candidate.finalHash}\n`,
      );
    }
    if (firstDiff) {
      process.stdout.write(`  First trace diff at index ${firstDiff.index}:\n`);
      process.stdout.write(`    master=${JSON.stringify(firstDiff.master)}\n`);
      process.stdout.write(`    ${browser}=${JSON.stringify(firstDiff.candidate)}\n`);
    }
  } else {
    process.stdout.write(`\n[PASS] ${browser} matches master trace (${candidate.finalHash}).\n`);
  }
}

if (failed) {
  process.exit(1);
}

process.stdout.write('\nAll browser traces match master trace.\n');
