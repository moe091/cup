import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

type TraceResult = {
  ticks: number;
  sampleEvery: number;
  finalHash: string;
  trace: Array<{ tick: number; hash: string }>;
};

test('collect browser determinism hash trace', async ({ page, browserName }, testInfo) => {
  const ticks = process.env.ARENA_TRACE_TICKS ?? '3000';
  const sampleEvery = process.env.ARENA_TRACE_SAMPLE_EVERY ?? '1';

  await page.goto(`/trace.html?ticks=${ticks}&sampleEvery=${sampleEvery}`);

  await page.waitForFunction(() => {
    return typeof window.__ARENA_TRACE_RESULT !== 'undefined';
  });

  const result = (await page.evaluate(() => {
    return window.__ARENA_TRACE_RESULT;
  })) as TraceResult;

  expect(result).toBeTruthy();
  expect(result.finalHash).toMatch(/^[0-9a-f]{8}$/);

  const outDir = path.join(testInfo.config.rootDir, 'determinism-results');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `browser-trace-${browserName}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  testInfo.annotations.push({ type: 'finalHash', description: result.finalHash });
});
