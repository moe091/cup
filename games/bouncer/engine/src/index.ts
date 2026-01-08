import { World } from "./world.js";
import type { WorldState, Snapshot } from './types.js';

export class Engine {
  private world = new World();
  private tick: number = 0;

  step() {
    this.tick++;
    this.world.step();
  }

  getSnapshot(): Snapshot {
    return {
      tick: this.tick,
      state: this.world.getSnapshot()
    }
  }

  spawnPlayer(playerId: string) {
    return this.world.spawnPlayer(playerId);
  }
}
