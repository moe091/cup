import { World } from "./world.js";
import type { PlayerInputVector, TickSnapshot } from "@cup/bouncer-shared";

export class Engine {
  private world = new World();
  private tick: number = 0;

  step(inputs: PlayerInputVector[]) {
    this.tick++;
    this.world.step();
  }

  getSnapshot(): TickSnapshot {
    return this.world.getSnapshot(this.tick);
  }

  spawnPlayer(playerId: string) {
    return this.world.spawnPlayer(playerId);
  }
}


export type { Ball, Point } from './types.js';

