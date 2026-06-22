import {
  CheckpointListener,
  DashEventListener,
  FinishListener,
  HazardListener,
  PlayerEventListener,
} from './types.js';
import { World } from './world.js';
import type { BouncerPhysicsConfig } from './config.js';
import type { LevelDefinition, PlayerInputState, TickSnapshot, HazardCatalog } from '@cup/bouncer-shared';

export type EngineOptions = {
  physics?: Partial<BouncerPhysicsConfig>;
  onCheckpoint?: CheckpointListener;
  onHazard?: HazardListener;
  onDoubleJump?: PlayerEventListener;
  onDash?: DashEventListener;
};

export class Engine {
  private world: World;
  private tick: number = 0;
  private onPlayerFinish: FinishListener;
  private options: EngineOptions;

  constructor(
    private timestep: number,
    onPlayerFinish: FinishListener,
    options: EngineOptions = {},
  ) {
    this.options = options;
    this.world = new World(options.physics);
    this.world.setTimestep(timestep);
    this.onPlayerFinish = onPlayerFinish;
    this.world.setFinishListener(onPlayerFinish);
    this.applyEventListeners();
  }

  // (Re)binds all optional event listeners to the world. Called on construction
  // and after loadLevel (resetWorld clears them).
  private applyEventListeners() {
    const o = this.options;
    if (o.onCheckpoint) this.world.setCheckpointListener(o.onCheckpoint);
    if (o.onHazard) this.world.setHazardListener(o.onHazard);
    if (o.onDoubleJump) this.world.setDoubleJumpListener(o.onDoubleJump);
    if (o.onDash) this.world.setDashListener(o.onDash);
  }

  step(inputs: PlayerInputState[]) {
    this.tick++;

    inputs.forEach((input) => {
      this.world.applyMoveInput(input.playerId, input.move);
      // Space: grounded/coyote jump, otherwise a mid-air double jump.
      if (input.jumpPressed) {
        const jumped = this.world.applyJump(input.playerId);
        if (!jumped) this.world.applyDoubleJump(input.playerId);
      }
      this.world.applyJumpHold(input.playerId, input.jumpHeld);
      // Shift: mid-air dash in the A/D direction (0 = stall).
      if (input.dashPressed) {
        this.world.applyDash(input.playerId, input.dashX ?? 0);
      }
    });

    this.world.step();
  }

  getSnapshot(): TickSnapshot {
    return this.world.getSnapshot(this.tick);
  }

  spawnPlayer(playerId: string) {
    return this.world.spawnPlayer(playerId);
  }

  spawnPlayerAt(playerId: string, xPixels: number, yPixels: number) {
    const spawned = this.world.spawnPlayer(playerId);
    if (!spawned) {
      return false;
    }

    return this.world.setPlayerPosition(playerId, xPixels, yPixels);
  }

  /** Teleports an existing player (zeroes velocity, resets air actions). */
  setPlayerPosition(playerId: string, xPixels: number, yPixels: number) {
    return this.world.setPlayerPosition(playerId, xPixels, yPixels);
  }

  loadLevel(level: LevelDefinition, hazardCatalog?: HazardCatalog) {
    console.log('[DEBUG] ENGINE LOADING LEVEL DEF: ', level.name);
    this.world.resetWorld();
    this.world.loadLevel(level, hazardCatalog);
    this.world.setFinishListener(this.onPlayerFinish);
    this.applyEventListeners();
  }
}

export type { Ball, Point } from './types.js';
export { DEFAULT_PHYSICS_CONFIG, type BouncerPhysicsConfig } from './config.js';
