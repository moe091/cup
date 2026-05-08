import { clamp } from './fixedPoint.js';
import { fnv1a32, stableStringify } from './hash.js';
import type {
  AabbFixed,
  DashState,
  EngineConfig,
  PlayerBody,
  Projectile,
  SimulationInput,
  SpawnProjectileInput,
  WorldState,
} from './types.js';

const intersects = (a: AabbFixed, b: AabbFixed): boolean => {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
};

const cloneState = (state: WorldState): WorldState => {
  return JSON.parse(JSON.stringify(state)) as WorldState;
};

const sortState = (state: WorldState): WorldState => {
  state.players.sort((a, b) => a.id.localeCompare(b.id));
  state.projectiles.sort((a, b) => a.id.localeCompare(b.id));
  state.solids.sort((a, b) => {
    if (a.x !== b.x) return a.x - b.x;
    if (a.y !== b.y) return a.y - b.y;
    if (a.w !== b.w) return a.w - b.w;
    return a.h - b.h;
  });
  return state;
};

const defaultDash = (): DashState => ({
  phase: 'ready',
  ticksRemaining: 0,
  directionX: 1,
});

const updateSensors = (player: PlayerBody, solids: AabbFixed[]): void => {
  const px = player.box.x;
  const py = player.box.y;
  const pw = player.box.w;
  const ph = player.box.h;

  const probe = 1;
  const down: AabbFixed = { x: px, y: py + ph, w: pw, h: probe };
  const up: AabbFixed = { x: px, y: py - probe, w: pw, h: probe };
  const left: AabbFixed = { x: px - probe, y: py, w: probe, h: ph };
  const right: AabbFixed = { x: px + pw, y: py, w: probe, h: ph };

  player.sensors.grounded = solids.some((solid) => intersects(down, solid));
  player.sensors.ceiling = solids.some((solid) => intersects(up, solid));
  player.sensors.leftWall = solids.some((solid) => intersects(left, solid));
  player.sensors.rightWall = solids.some((solid) => intersects(right, solid));
};

const moveAxis = (box: AabbFixed, solids: AabbFixed[], delta: number, axis: 'x' | 'y'): number => {
  if (delta === 0) return 0;

  if (axis === 'x') {
    box.x += delta;
  } else {
    box.y += delta;
  }

  let resolved = delta;
  for (const solid of solids) {
    if (!intersects(box, solid)) continue;

    if (axis === 'x') {
      if (delta > 0) {
        const overlap = box.x + box.w - solid.x;
        box.x -= overlap;
        resolved -= overlap;
      } else {
        const overlap = solid.x + solid.w - box.x;
        box.x += overlap;
        resolved += overlap;
      }
    } else if (delta > 0) {
      const overlap = box.y + box.h - solid.y;
      box.y -= overlap;
      resolved -= overlap;
    } else {
      const overlap = solid.y + solid.h - box.y;
      box.y += overlap;
      resolved += overlap;
    }
  }

  return resolved;
};

const splitDeltaToSubsteps = (delta: number, substeps: number): number[] => {
  const steps = Math.max(1, substeps);
  const base = Math.trunc(delta / steps);
  const remainder = delta - base * steps;
  const remainderAbs = Math.abs(remainder);
  const remainderSign = Math.sign(remainder);
  const output: number[] = [];

  for (let i = 0; i < steps; i += 1) {
    const extra = i < remainderAbs ? remainderSign : 0;
    output.push(base + extra);
  }

  return output;
};

export class ArenaDeterministicEngine {
  private readonly config: EngineConfig;
  private state: WorldState;

  constructor(config: EngineConfig) {
    this.config = Object.freeze({ ...config });
    this.state = {
      tick: 0,
      players: [],
      solids: [],
      projectiles: [],
    };
  }

  addSolid(box: AabbFixed): void {
    this.state.solids.push({ ...box });
    sortState(this.state);
  }

  addPlayer(player: Omit<PlayerBody, 'sensors' | 'jumpsRemaining' | 'coyoteTicksRemaining' | 'jumpBufferTicksRemaining' | 'dash'>): void {
    this.state.players.push({
      ...player,
      sensors: { grounded: false, ceiling: false, leftWall: false, rightWall: false },
      jumpsRemaining: this.config.maxJumpCount,
      coyoteTicksRemaining: 0,
      jumpBufferTicksRemaining: 0,
      dash: defaultDash(),
    });
    sortState(this.state);
  }

  spawnProjectile(input: SpawnProjectileInput): void {
    this.state.projectiles.push({
      id: input.id,
      ownerId: input.ownerId,
      alive: true,
      box: { x: input.x, y: input.y, w: input.w, h: input.h },
      vel: { x: input.vx, y: input.vy },
    });
    sortState(this.state);
  }

  step(inputs: SimulationInput[]): void {
    this.state.tick += 1;

    const inputById: Record<string, SimulationInput> = {};
    for (const input of inputs) {
      inputById[input.playerId] = input;
    }

    for (const player of this.state.players) {
      updateSensors(player, this.state.solids);
      if (player.sensors.grounded) {
        player.coyoteTicksRemaining = this.config.coyoteTicks;
        player.jumpsRemaining = this.config.maxJumpCount;
      } else {
        player.coyoteTicksRemaining = Math.max(0, player.coyoteTicksRemaining - 1);
      }

      const input = inputById[player.id] ?? {
        playerId: player.id,
        moveX: 0,
        jumpPressed: false,
        dashPressed: false,
      };

      if (input.jumpPressed) {
        player.jumpBufferTicksRemaining = this.config.jumpBufferTicks;
      } else {
        player.jumpBufferTicksRemaining = Math.max(0, player.jumpBufferTicksRemaining - 1);
      }

      if (input.moveX !== 0) {
        player.facingX = input.moveX;
      }

      if (input.dashPressed && player.dash.phase === 'ready') {
        player.dash.phase = 'active';
        player.dash.ticksRemaining = this.config.dashActiveTicks;
        player.dash.directionX = player.facingX;
      }

      if (player.dash.phase === 'active') {
        player.vel.x = player.dash.directionX * this.config.dashSpeed;
        player.vel.y = 0;
        player.dash.ticksRemaining -= 1;
        if (player.dash.ticksRemaining <= 0) {
          player.dash.phase = 'cooldown';
          player.dash.ticksRemaining = this.config.dashCooldownTicks;
        }
      } else {
        const desired = input.moveX * this.config.maxRunSpeed;
        if (desired !== 0) {
          if (player.vel.x < desired) {
            player.vel.x = Math.min(desired, player.vel.x + this.config.moveAccelPerTick);
          } else if (player.vel.x > desired) {
            player.vel.x = Math.max(desired, player.vel.x - this.config.moveAccelPerTick);
          }
        } else if (player.vel.x > 0) {
          player.vel.x = Math.max(0, player.vel.x - this.config.moveDecelPerTick);
        } else if (player.vel.x < 0) {
          player.vel.x = Math.min(0, player.vel.x + this.config.moveDecelPerTick);
        }

        const canGroundJump = player.sensors.grounded || player.coyoteTicksRemaining > 0;
        const hasBufferedJump = player.jumpBufferTicksRemaining > 0;

        if (hasBufferedJump && (canGroundJump || player.jumpsRemaining > 0)) {
          player.vel.y = -this.config.jumpSpeed;
          player.jumpBufferTicksRemaining = 0;
          player.coyoteTicksRemaining = 0;
          player.jumpsRemaining -= 1;
        }

        player.vel.y = Math.min(player.vel.y + this.config.gravityPerTick, this.config.maxFallSpeed);

        if (player.dash.phase === 'cooldown') {
          player.dash.ticksRemaining -= 1;
          if (player.dash.ticksRemaining <= 0) {
            player.dash.phase = 'ready';
            player.dash.ticksRemaining = 0;
          }
        }
      }

      const xSubsteps = splitDeltaToSubsteps(player.vel.x, this.config.playerSubsteps);
      let xBlocked = false;
      for (const stepX of xSubsteps) {
        const movedX = moveAxis(player.box, this.state.solids, stepX, 'x');
        if (movedX !== stepX) {
          xBlocked = true;
          break;
        }
      }
      if (xBlocked) {
        player.vel.x = 0;
      }

      const ySubsteps = splitDeltaToSubsteps(player.vel.y, this.config.playerSubsteps);
      let yBlocked = false;
      for (const stepY of ySubsteps) {
        const movedY = moveAxis(player.box, this.state.solids, stepY, 'y');
        if (movedY !== stepY) {
          yBlocked = true;
          break;
        }
      }
      if (yBlocked) {
        player.vel.y = 0;
      }

      updateSensors(player, this.state.solids);
    }

    for (const projectile of this.state.projectiles) {
      if (!projectile.alive) continue;

      projectile.vel.y = Math.min(
        projectile.vel.y + this.config.projectileGravityPerTick,
        this.config.projectileMaxFallSpeed,
      );

      const substeps = Math.max(1, this.config.projectileSubsteps);
      const stepVx = Math.trunc(projectile.vel.x / substeps);
      const stepVy = Math.trunc(projectile.vel.y / substeps);
      const remX = projectile.vel.x - stepVx * substeps;
      const remY = projectile.vel.y - stepVy * substeps;

      for (let i = 0; i < substeps; i += 1) {
        const dx = stepVx + (i < Math.abs(remX) ? Math.sign(remX) : 0);
        const dy = stepVy + (i < Math.abs(remY) ? Math.sign(remY) : 0);

        const movedX = moveAxis(projectile.box, this.state.solids, dx, 'x');
        if (movedX !== dx) {
          projectile.alive = false;
          break;
        }

        const movedY = moveAxis(projectile.box, this.state.solids, dy, 'y');
        if (movedY !== dy) {
          projectile.alive = false;
          break;
        }
      }

      if (!projectile.alive) continue;
      for (const player of this.state.players) {
        if (player.id === projectile.ownerId) continue;
        if (intersects(projectile.box, player.box)) {
          projectile.alive = false;
          break;
        }
      }
    }

    this.state.projectiles = this.state.projectiles.filter((projectile) => projectile.alive);
    sortState(this.state);
  }

  getState(): WorldState {
    return cloneState(this.state);
  }

  saveState(): WorldState {
    return this.getState();
  }

  loadState(state: WorldState): void {
    this.state = sortState(cloneState(state));
  }

  hashState(): string {
    return fnv1a32(stableStringify(sortState(cloneState(this.state))));
  }

  static createDefaultConfig(scale: number): EngineConfig {
    return {
      scale,
      gravityPerTick: clamp(Math.round(0.35 * scale), 0, Number.MAX_SAFE_INTEGER),
      maxFallSpeed: Math.round(8 * scale),
      moveAccelPerTick: Math.round(0.5 * scale),
      moveDecelPerTick: Math.round(0.6 * scale),
      maxRunSpeed: Math.round(3.2 * scale),
      jumpSpeed: Math.round(6.5 * scale),
      coyoteTicks: 6,
      jumpBufferTicks: 6,
      maxJumpCount: 2,
      dashSpeed: Math.round(8.5 * scale),
      dashActiveTicks: 6,
      dashCooldownTicks: 18,
      playerSubsteps: 4,
      projectileSubsteps: 4,
      projectileGravityPerTick: Math.round(0.28 * scale),
      projectileMaxFallSpeed: Math.round(7 * scale),
    };
  }
}
