import { FinishListener } from './types.js';
import { World } from './world.js';
import type { LevelDefinition, PlayerInputState, TickSnapshot } from '@cup/bouncer-shared';

export class Engine {
  private world = new World();
  private tick: number = 0;
  private onPlayerFinish: FinishListener;

  constructor(private timestep: number, onPlayerFinish: FinishListener) {
    this.world.setTimestep(timestep);
    this.onPlayerFinish = onPlayerFinish;
    this.world.setFinishListener(onPlayerFinish);
  }

  step(inputs: PlayerInputState[]) {
    this.tick++;

    inputs.forEach((input) => {
      this.world.applyMoveInput(input.playerId, input.move);
      if (input.jumpPressed) {
        console.log(`[Engine.step] jumpPressed for ${input.playerId}`);
        this.world.applyJump(input.playerId);
      }
      this.world.applyJumpHold(input.playerId, input.jumpHeld);
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

  loadLevel(level: LevelDefinition) {
    console.log('[DEBUG] ENGINE LOADING LEVEL DEF: ', level.name);
    this.world.resetWorld();
    this.world.loadLevel(level);
    if (this.onPlayerFinish)
      this.world.setFinishListener(this.onPlayerFinish);
    else 
      console.warn("[Engine.loadLevel] loaded level but no finish listener is set!");
  }
}

export type { Ball, Point } from './types.js';
