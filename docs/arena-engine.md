---
description: Arena deterministic physics engine and determinism test workflow.
---

# Arena Engine (Deterministic Physics)

This document describes the `games/arena/engine` package: what it does, how to use it, and how to run determinism checks across Node and browsers.

## Goals

- Fixed-tick deterministic simulation suitable for rollback netcode.
- Integer fixed-point authoritative state (JSON-serializable).
- No variable `dt`, no randomness, no wall-clock time dependencies.
- Same inputs + same initial state => same outputs/hashes.

## Engine overview

Entry points are exported from `@cup/arena-engine`:

- `ArenaDeterministicEngine`
- fixed-point helpers: `toFixed`, `fromFixed`, `DEFAULT_SCALE`
- core types (`WorldState`, `EngineConfig`, `SimulationInput`, etc.)

Core implementation files:

- `src/engine.ts` — simulation logic
- `src/types.ts` — authoritative data model/config
- `src/fixedPoint.ts` — fixed-point conversion utilities
- `src/hash.ts` — canonical stringify + FNV-1a hash

## Simulation model

State is plain JSON-compatible data:

- `tick`
- `players[]` dynamic AABBs (position/velocity, dash/jump state, sensors)
- `solids[]` static AABBs
- `projectiles[]` dynamic AABBs

### Deterministic features implemented

- axis-separated movement/collision resolution
- gravity + max fall speed
- acceleration/deceleration run movement
- jump, coyote time, jump buffer, double jump
- dash (`ready -> active -> cooldown` tick state machine)
- sensors (`grounded`, `ceiling`, `leftWall`, `rightWall`)
- projectile substep movement + collision
- player substep movement (anti-tunneling)
- `saveState` / `loadState`
- `hashState` using canonical key-sorted serialization

## Basic usage

```ts
import { ArenaDeterministicEngine, DEFAULT_SCALE, toFixed } from '@cup/arena-engine';

const config = ArenaDeterministicEngine.createDefaultConfig(DEFAULT_SCALE);
const engine = new ArenaDeterministicEngine(config);

engine.addSolid({ x: 0, y: toFixed(20, DEFAULT_SCALE), w: toFixed(80, DEFAULT_SCALE), h: toFixed(5, DEFAULT_SCALE) });

engine.addPlayer({
  id: 'p1',
  box: { x: toFixed(10, DEFAULT_SCALE), y: toFixed(10, DEFAULT_SCALE), w: toFixed(1, DEFAULT_SCALE), h: toFixed(2, DEFAULT_SCALE) },
  vel: { x: 0, y: 0 },
  facingX: 1,
});

engine.step([
  { playerId: 'p1', moveX: 1, jumpPressed: false, dashPressed: false },
]);

const state = engine.getState();
const hash = engine.hashState();
```

## Visual harness

Simple Phaser-based rendering harness for debugging simulation behavior:

```bash
pnpm --filter @cup/arena-engine visual:dev
```

The harness is in `visual/` and is **debug-only** (not authoritative for CI pass/fail).

## Determinism testing

## 1) Unit-style determinism tests

```bash
pnpm --filter @cup/arena-engine test
```

Includes:

- replay determinism test
- rollback restore/replay convergence test

## 2) Trace generation commands

These produce JSON traces with per-tick hash samples:

- `determinism:master` -> `determinism-results/master-trace.json`
- `determinism:node` -> `determinism-results/node-trace.json`
- `determinism:chromium` -> `determinism-results/chromium-trace.json`
- `determinism:firefox` -> `determinism-results/firefox-trace.json`
- `determinism:webkit` -> `determinism-results/webkit-trace.json`

Run examples:

```bash
pnpm --filter @cup/arena-engine determinism:master
pnpm --filter @cup/arena-engine determinism:chromium
pnpm --filter @cup/arena-engine determinism:firefox
pnpm --filter @cup/arena-engine determinism:webkit
```

## 3) Full browser-vs-master comparison

Runs all 3 browser traces and compares each to `master-trace.json`:

```bash
pnpm --filter @cup/arena-engine determinism:full-test
```

The command fails (exit code 1) on any mismatch and prints first divergence details.

## Browser prerequisites

On a new machine, install Playwright browser binaries:

```bash
pnpm --filter @cup/arena-engine exec playwright install
```

On Linux you may also need system deps:

```bash
pnpm --filter @cup/arena-engine exec playwright install-deps
```

## Recommended workflow for cross-platform validation

1. On the authoritative Node environment, generate the master:
   - `pnpm --filter @cup/arena-engine determinism:master`
2. Commit or distribute `master-trace.json` as the baseline artifact.
3. On target platform/browser machines, run:
   - `pnpm --filter @cup/arena-engine determinism:full-test`
4. Investigate first divergence tick if any mismatch occurs.
