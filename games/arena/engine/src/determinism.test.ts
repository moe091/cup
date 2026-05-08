import assert from 'node:assert/strict';
import test from 'node:test';
import { ArenaDeterministicEngine } from './engine.js';
import { DEFAULT_SCALE, toFixed } from './fixedPoint.js';
import type { SimulationInput } from './types.js';

const createEngine = (): ArenaDeterministicEngine => {
  const scale = DEFAULT_SCALE;
  const engine = new ArenaDeterministicEngine(ArenaDeterministicEngine.createDefaultConfig(scale));

  engine.addSolid({ x: 0, y: toFixed(20, scale), w: toFixed(120, scale), h: toFixed(10, scale) });
  engine.addSolid({ x: toFixed(30, scale), y: toFixed(15, scale), w: toFixed(20, scale), h: toFixed(2, scale) });

  engine.addPlayer({
    id: 'p1',
    box: { x: toFixed(4, scale), y: toFixed(10, scale), w: toFixed(1, scale), h: toFixed(2, scale) },
    vel: { x: 0, y: 0 },
    facingX: 1,
  });

  engine.addPlayer({
    id: 'p2',
    box: { x: toFixed(40, scale), y: toFixed(10, scale), w: toFixed(1, scale), h: toFixed(2, scale) },
    vel: { x: 0, y: 0 },
    facingX: -1,
  });

  engine.spawnProjectile({
    id: 'proj-1',
    ownerId: 'p1',
    x: toFixed(8, scale),
    y: toFixed(12, scale),
    w: toFixed(0.5, scale),
    h: toFixed(0.5, scale),
    vx: toFixed(5, scale),
    vy: 0,
  });

  return engine;
};

const buildInputs = (tick: number): SimulationInput[] => {
  const p1MoveX: -1 | 0 | 1 = tick < 40 ? 1 : 0;
  const p2MoveX: -1 | 0 | 1 = tick > 35 && tick < 70 ? -1 : 0;

  return [
    {
      playerId: 'p1',
      moveX: p1MoveX,
      jumpPressed: tick === 8 || tick === 55,
      dashPressed: tick === 20,
    },
    {
      playerId: 'p2',
      moveX: p2MoveX,
      jumpPressed: tick === 45,
      dashPressed: tick === 60,
    },
  ];
};

test('deterministic replay yields identical hash and state', () => {
  const engineA = createEngine();
  const engineB = createEngine();

  for (let tick = 0; tick < 180; tick += 1) {
    const input = buildInputs(tick);
    engineA.step(input);
    engineB.step(input);
  }

  assert.equal(engineA.hashState(), engineB.hashState());
  assert.deepEqual(engineA.getState(), engineB.getState());
});

test('rollback restore and replay converges to the same final hash', () => {
  const engineReference = createEngine();
  const engineRollback = createEngine();
  const history: ReturnType<typeof engineRollback.saveState>[] = [];

  for (let tick = 0; tick < 240; tick += 1) {
    const input = buildInputs(tick);
    history.push(engineRollback.saveState());

    engineReference.step(input);
    engineRollback.step(input);

    if (tick === 120) {
      const restoreTick = 70;
      engineRollback.loadState(history[restoreTick]);
      for (let replayTick = restoreTick; replayTick <= tick; replayTick += 1) {
        engineRollback.step(buildInputs(replayTick));
      }
    }
  }

  assert.equal(engineRollback.hashState(), engineReference.hashState());
  assert.deepEqual(engineRollback.getState(), engineReference.getState());
});
