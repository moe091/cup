import { World } from './world.js';
import type { LevelDefinition, PlayerInputVector, TickSnapshot } from '@cup/bouncer-shared';

export class Engine {
  private world = new World();
  private tick: number = 0;

  constructor(private timestep: number) {
    this.world.setTimestep(timestep);
  }

  step(inputs: PlayerInputVector[]) {
    this.tick++;

    inputs.forEach((input) => {
      this.world.launchBall(input.playerId, input.x, input.y);
    });

    this.world.step();
  }

  getSnapshot(): TickSnapshot {
    return this.world.getSnapshot(this.tick);
  }

  spawnPlayer(playerId: string) {
    return this.world.spawnPlayer(playerId);
  }

  loadLevel(level: LevelDefinition) {
    console.log('[DEBUG] ENGINE LOADING LEVEL DEF: ', level.name);
    this.world.resetWorld();
    this.world.loadLevel(level);
  }
}

export type { Ball, Point } from './types.js';
