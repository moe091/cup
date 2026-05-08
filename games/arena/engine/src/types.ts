export type Fixed = number;

export type Vec2Fixed = {
  x: Fixed;
  y: Fixed;
};

export type AabbFixed = {
  x: Fixed;
  y: Fixed;
  w: Fixed;
  h: Fixed;
};

export type SensorState = {
  grounded: boolean;
  ceiling: boolean;
  leftWall: boolean;
  rightWall: boolean;
};

export type DashPhase = 'ready' | 'active' | 'cooldown';

export type DashState = {
  phase: DashPhase;
  ticksRemaining: number;
  directionX: -1 | 1;
};

export type PlayerBody = {
  id: string;
  box: AabbFixed;
  vel: Vec2Fixed;
  facingX: -1 | 1;
  sensors: SensorState;
  jumpsRemaining: number;
  coyoteTicksRemaining: number;
  jumpBufferTicksRemaining: number;
  dash: DashState;
};

export type Projectile = {
  id: string;
  ownerId: string;
  alive: boolean;
  box: AabbFixed;
  vel: Vec2Fixed;
};

export type WorldState = {
  tick: number;
  players: PlayerBody[];
  solids: AabbFixed[];
  projectiles: Projectile[];
};

export type EngineConfig = {
  scale: number;
  gravityPerTick: Fixed;
  maxFallSpeed: Fixed;
  moveAccelPerTick: Fixed;
  moveDecelPerTick: Fixed;
  maxRunSpeed: Fixed;
  jumpSpeed: Fixed;
  coyoteTicks: number;
  jumpBufferTicks: number;
  maxJumpCount: number;
  dashSpeed: Fixed;
  dashActiveTicks: number;
  dashCooldownTicks: number;
  playerSubsteps: number;
  projectileSubsteps: number;
  projectileGravityPerTick: Fixed;
  projectileMaxFallSpeed: Fixed;
};

export type SimulationInput = {
  playerId: string;
  moveX: -1 | 0 | 1;
  jumpPressed: boolean;
  dashPressed: boolean;
};

export type SpawnProjectileInput = {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
};
