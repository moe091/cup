import { runDeterminismTrace } from '../src/traceScenario.js';

declare global {
  interface Window {
    __ARENA_TRACE_RESULT?: unknown;
  }
}

const params = new URLSearchParams(window.location.search);
const ticks = Number.parseInt(params.get('ticks') ?? '3000', 10);
const sampleEvery = Number.parseInt(params.get('sampleEvery') ?? '1', 10);

const result = runDeterminismTrace(ticks, sampleEvery);
window.__ARENA_TRACE_RESULT = result;

const el = document.getElementById('result');
if (el) {
  el.textContent = JSON.stringify(result, null, 2);
}
