import { CheckpointListener, FinishListener, HazardListener } from './types.js';
import { World } from './world.js';
import type { BouncerPhysicsConfig } from './config.js';
import type { LevelDefinition, PlayerInputState, TickSnapshot, HazardCatalog } from '@cup/bouncer-shared';

export class Engine {
  private world: World;
  private tick: number = 0;
  private onPlayerFinish: FinishListener;
  private onCheckpoint?: CheckpointListener;
  private onHazard?: HazardListener;

  constructor(
    private timestep: number,
    onPlayerFinish: FinishListener,
    physics?: Partial<BouncerPhysicsConfig>,
    onCheckpoint?: CheckpointListener,
    onHazard?: HazardListener,
  ) {
    this.world = new World(physics);
    this.world.setTimestep(timestep);
    this.onPlayerFinish = onPlayerFinish;
    this.world.setFinishListener(onPlayerFinish);
    this.onCheckpoint = onCheckpoint;
    if (onCheckpoint) this.world.setCheckpointListener(onCheckpoint);
    this.onHazard = onHazard;
    if (onHazard) this.world.setHazardListener(onHazard);
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
    if (this.onPlayerFinish) this.world.setFinishListener(this.onPlayerFinish);
    else console.warn('[Engine.loadLevel] loaded level but no finish listener is set!');
    if (this.onCheckpoint) this.world.setCheckpointListener(this.onCheckpoint);
    if (this.onHazard) this.world.setHazardListener(this.onHazard);
  }
}

export type { Ball, Point } from './types.js';
export { DEFAULT_PHYSICS_CONFIG, type BouncerPhysicsConfig } from './config.js';
