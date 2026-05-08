import Phaser from 'phaser';
import { ArenaDeterministicEngine } from '../src/engine.js';
import { DEFAULT_SCALE, fromFixed, toFixed } from '../src/fixedPoint.js';
import type { SimulationInput } from '../src/types.js';

const TPS = 30;
const FIXED_MS = 1000 / TPS;
const WORLD_W_UNITS = 120;
const WORLD_H_UNITS = 40;
const VIEW_SCALE = 10;

const SCREEN_W = WORLD_W_UNITS * VIEW_SCALE;
const SCREEN_H = WORLD_H_UNITS * VIEW_SCALE;

const brightenColor = (hexColor: number, factor: number): number => {
  const r = (hexColor >> 16) & 0xff;
  const g = (hexColor >> 8) & 0xff;
  const b = hexColor & 0xff;

  const nr = Math.min(255, Math.round(r * factor));
  const ng = Math.min(255, Math.round(g * factor));
  const nb = Math.min(255, Math.round(b * factor));

  return (nr << 16) | (ng << 8) | nb;
};

const debugEl = document.getElementById('debug');
if (!(debugEl instanceof HTMLElement)) {
  throw new Error('Missing debug panel element');
}

const makeEngine = (): ArenaDeterministicEngine => {
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

  return engine;
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

class HarnessScene extends Phaser.Scene {
  private engine = makeEngine();
  private accumulatorMs = 0;
  private isPaused = false;
  private readonly gfx!: Phaser.GameObjects.Graphics;

  constructor() {
    super('harness');
  }

  create(): void {
    const gfx = this.add.graphics();
    (this as { gfx: Phaser.GameObjects.Graphics }).gfx = gfx;

    this.engine.spawnProjectile({
      id: 'proj-1',
      ownerId: 'p1',
      x: toFixed(9, DEFAULT_SCALE),
      y: toFixed(29, DEFAULT_SCALE),
      w: toFixed(0.5, DEFAULT_SCALE),
      h: toFixed(0.5, DEFAULT_SCALE),
      vx: toFixed(8, DEFAULT_SCALE),
      vy: toFixed(-0.35, DEFAULT_SCALE),
    });

    window.addEventListener('keydown', (event) => {
      if (event.code === 'KeyP') this.togglePause();
      if (event.code === 'KeyN') this.stepSingleTick();
      if (event.code === 'KeyR') this.resetHarness();
    });

    const pauseBtn = document.getElementById('btn-pause');
    const stepBtn = document.getElementById('btn-step');
    const resetBtn = document.getElementById('btn-reset');

    pauseBtn?.addEventListener('click', () => this.togglePause());
    stepBtn?.addEventListener('click', () => this.stepSingleTick());
    resetBtn?.addEventListener('click', () => this.resetHarness());

    this.render();
  }

  update(_time: number, deltaMs: number): void {
    this.accumulatorMs += deltaMs;

    if (!this.isPaused) {
      while (this.accumulatorMs >= FIXED_MS) {
        this.accumulatorMs -= FIXED_MS;
        this.runTick();
      }
    }

    this.render();
  }

  private runTick(): void {
    const tick = this.engine.getState().tick;
    this.engine.step(buildInputs(tick));

    if (tick > 0 && tick % 90 === 0) {
      this.engine.spawnProjectile({
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
  }

  private stepSingleTick(): void {
    this.runTick();
    this.render();
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;
    const pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn) {
      pauseBtn.textContent = this.isPaused ? 'Play' : 'Pause';
    }
  }

  private resetHarness(): void {
    this.engine = makeEngine();
    this.accumulatorMs = 0;
    this.engine.spawnProjectile({
      id: 'proj-1',
      ownerId: 'p1',
      x: toFixed(9, DEFAULT_SCALE),
      y: toFixed(29, DEFAULT_SCALE),
      w: toFixed(0.5, DEFAULT_SCALE),
      h: toFixed(0.5, DEFAULT_SCALE),
      vx: toFixed(8, DEFAULT_SCALE),
      vy: toFixed(-0.35, DEFAULT_SCALE),
    });
  }

  private render(): void {
    const state = this.engine.getState();
    this.gfx.clear();

    this.gfx.fillStyle(0x161a29, 1);
    this.gfx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    this.gfx.fillStyle(0x577399, 1);
    for (const solid of state.solids) {
      this.drawBox(solid.x, solid.y, solid.w, solid.h);
    }

    for (const player of state.players) {
      const baseColor = player.id === 'p1' ? 0x80ff72 : 0xff7f6e;
      const color = player.dash.phase === 'active' ? brightenColor(baseColor, 1.1) : baseColor;
      this.gfx.fillStyle(color, 1);
      this.drawBox(player.box.x, player.box.y, player.box.w, player.box.h);
    }

    this.gfx.fillStyle(0xffef6b, 1);
    for (const projectile of state.projectiles) {
      this.drawBox(projectile.box.x, projectile.box.y, projectile.box.w, projectile.box.h);
    }

    const p1 = state.players.find((player) => player.id === 'p1');
    const p2 = state.players.find((player) => player.id === 'p2');

    debugEl.textContent = [
      `tick: ${state.tick}`,
      `hash: ${this.engine.hashState()}`,
      `paused: ${this.isPaused}`,
      `projectiles: ${state.projectiles.length}`,
      p1 ? `p1 pos=(${fromFixed(p1.box.x, DEFAULT_SCALE).toFixed(2)}, ${fromFixed(p1.box.y, DEFAULT_SCALE).toFixed(2)}) vel=(${fromFixed(p1.vel.x, DEFAULT_SCALE).toFixed(2)}, ${fromFixed(p1.vel.y, DEFAULT_SCALE).toFixed(2)}) dash=${p1.dash.phase}` : 'p1 missing',
      p2 ? `p2 pos=(${fromFixed(p2.box.x, DEFAULT_SCALE).toFixed(2)}, ${fromFixed(p2.box.y, DEFAULT_SCALE).toFixed(2)}) vel=(${fromFixed(p2.vel.x, DEFAULT_SCALE).toFixed(2)}, ${fromFixed(p2.vel.y, DEFAULT_SCALE).toFixed(2)}) dash=${p2.dash.phase}` : 'p2 missing',
    ].join('\n');
  }

  private drawBox(x: number, y: number, w: number, h: number): void {
    const px = fromFixed(x, DEFAULT_SCALE) * VIEW_SCALE;
    const py = fromFixed(y, DEFAULT_SCALE) * VIEW_SCALE;
    const pw = fromFixed(w, DEFAULT_SCALE) * VIEW_SCALE;
    const ph = fromFixed(h, DEFAULT_SCALE) * VIEW_SCALE;
    this.gfx.fillRect(px, py, pw, ph);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: SCREEN_W,
  height: SCREEN_H,
  parent: 'game-root',
  backgroundColor: '#0f111a',
  scene: [HarnessScene],
});
