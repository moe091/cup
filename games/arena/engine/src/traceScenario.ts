import { ArenaDeterministicEngine } from './engine.js';
import { DEFAULT_SCALE, toFixed } from './fixedPoint.js';
import type { SimulationInput } from './types.js';

export type TraceResult = {
  ticks: number;
  sampleEvery: number;
  finalHash: string;
  trace: Array<{ tick: number; hash: string }>;
};

const buildInputs = (tick: number): SimulationInput[] => {
  let p1MoveX: -1 | 0 | 1 = 0;
  if (tick < 140) p1MoveX = 1;
  else if (tick < 240) p1MoveX = -1;
  else if (tick < 370) p1MoveX = 1;
  else if (tick < 480) p1MoveX = -1;
  else p1MoveX = tick % 160 < 80 ? 1 : -1;

  let p2MoveX: -1 | 0 | 1 = 0;
  if (tick < 110) p2MoveX = -1;
  else if (tick < 220) p2MoveX = 1;
  else if (tick < 340) p2MoveX = -1;
  else if (tick < 460) p2MoveX = 1;
  else p2MoveX = tick % 180 < 90 ? -1 : 1;

  return [
    {
      playerId: 'p1',
      moveX: p1MoveX,
      jumpPressed: tick % 55 === 18,
      dashPressed: tick === 40,
    },
    {
      playerId: 'p2',
      moveX: p2MoveX,
      jumpPressed: tick % 65 === 30,
      dashPressed: tick === 120,
    },
  ];
};

const makeTraceEngine = (): ArenaDeterministicEngine => {
  const scale = DEFAULT_SCALE;
  const base = ArenaDeterministicEngine.createDefaultConfig(scale);
  const engine = new ArenaDeterministicEngine({
    ...base,
    gravityPerTick: toFixed(0.2, scale),
    maxFallSpeed: toFixed(4.5, scale),
    moveAccelPerTick: toFixed(0.22, scale),
    moveDecelPerTick: toFixed(0.26, scale),
    maxRunSpeed: toFixed(1.8, scale),
    jumpSpeed: toFixed(2.1, scale),
    dashSpeed: toFixed(4.5, scale),
    projectileGravityPerTick: toFixed(0.14, scale),
    projectileMaxFallSpeed: toFixed(4.8, scale),
  });

  engine.addSolid({ x: 0, y: toFixed(32, scale), w: toFixed(120, scale), h: toFixed(8, scale) });
  engine.addSolid({ x: toFixed(0, scale), y: 0, w: toFixed(1, scale), h: toFixed(40, scale) });
  engine.addSolid({ x: toFixed(119, scale), y: 0, w: toFixed(1, scale), h: toFixed(40, scale) });
  engine.addSolid({ x: toFixed(24, scale), y: toFixed(25, scale), w: toFixed(12, scale), h: toFixed(1.5, scale) });
  engine.addSolid({ x: toFixed(44, scale), y: toFixed(21, scale), w: toFixed(12, scale), h: toFixed(1.5, scale) });
  engine.addSolid({ x: toFixed(64, scale), y: toFixed(17, scale), w: toFixed(12, scale), h: toFixed(1.5, scale) });

  engine.addPlayer({
    id: 'p1',
    box: { x: toFixed(6, scale), y: toFixed(28, scale), w: toFixed(1, scale), h: toFixed(2, scale) },
    vel: { x: 0, y: 0 },
    facingX: 1,
  });

  engine.addPlayer({
    id: 'p2',
    box: { x: toFixed(94, scale), y: toFixed(28, scale), w: toFixed(1, scale), h: toFixed(2, scale) },
    vel: { x: 0, y: 0 },
    facingX: -1,
  });

  engine.spawnProjectile({
    id: 'proj-1',
    ownerId: 'p1',
    x: toFixed(9, DEFAULT_SCALE),
    y: toFixed(29, DEFAULT_SCALE),
    w: toFixed(0.5, DEFAULT_SCALE),
    h: toFixed(0.5, DEFAULT_SCALE),
    vx: toFixed(8, DEFAULT_SCALE),
    vy: toFixed(-0.35, DEFAULT_SCALE),
  });

  return engine;
};

export const runDeterminismTrace = (ticks: number, sampleEvery: number): TraceResult => {
  const engine = makeTraceEngine();
  const clampedTicks = Math.max(1, Math.floor(ticks));
  const clampedSampleEvery = Math.max(1, Math.floor(sampleEvery));
  const trace: Array<{ tick: number; hash: string }> = [];

  trace.push({ tick: 0, hash: engine.hashState() });

  for (let i = 0; i < clampedTicks; i += 1) {
    const tick = engine.getState().tick;
    engine.step(buildInputs(tick));

    if (tick > 0 && tick % 90 === 0) {
      engine.spawnProjectile({
        id: `proj-${tick}`,
        ownerId: 'p2',
        x: toFixed(93, DEFAULT_SCALE),
        y: toFixed(27.5, DEFAULT_SCALE),
        w: toFixed(0.5, DEFAULT_SCALE),
        h: toFixed(0.5, DEFAULT_SCALE),
        vx: toFixed(-9, DEFAULT_SCALE),
        vy: toFixed(-0.25, DEFAULT_SCALE),
      });
    }

    const newTick = engine.getState().tick;
    if (newTick % clampedSampleEvery === 0 || i === clampedTicks - 1) {
      trace.push({ tick: newTick, hash: engine.hashState() });
    }
  }

  return {
    ticks: clampedTicks,
    sampleEvery: clampedSampleEvery,
    finalHash: engine.hashState(),
    trace,
  };
};
