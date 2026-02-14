import { type BroadcastSnapshot, type PlayerId } from '../types.js';
import { Engine } from '@cup/bouncer-engine';
import { InputState, LevelDefinition, PlayerInputState, TickSnapshot, TICK_MS } from '@cup/bouncer-shared';
import { performance as perf } from 'node:perf_hooks';

import { createRequire } from 'node:module';
import { loadLevelDef } from '../api/helpers.js';
const require = createRequire(import.meta.url);
console.log('Resolved @cup/bouncer-engine to:', require.resolve('@cup/bouncer-engine'));

/**
 * Simulation will import and wrap Engine. It will be wrapped by Match.
 *
 * Match will only need to call functions like start and stop, ticking/stepping will be
 * handled internally. Match will inject a broadcast callback into Simulation's constructor,
 * which simulation will use to broadcast state updates after each tick. Simulation will
 * expose an applyInputs function that Match will use to apply inputs as they come. For now,
 * inputs will simply be applied on the next available tick, but it will be written in a way
 * that allows inputs to be applied on a specific tick(including ones in the past) to support
 * rollback or delay. Simulation will expose a function for spawning players as well(either
 * one at a time or as an array, will ahve to see what makes more sense)
 */

export class Simulation {
  private engine: Engine;
  private startTime = -1;
  private running = false;
  private timer: NodeJS.Timeout | null = null;
  private maxCatchup = 5;
  private tick = -1;
  private tickMs = TICK_MS;
  private nextTickTime = -1;
  private inputState: Map<PlayerId, InputState> = new Map();
  private lastJumpHeld: Map<PlayerId, boolean> = new Map();
  private inputByTick: Map<PlayerId, Map<number, InputState>> = new Map();
  //NOTE: if I want to implement rollback later I'll have to add tick to inputs(can just add as they are applied, as long as re-apply them on the same tick it will be fine)

  constructor(private snapshotCallback: BroadcastSnapshot, onPlayerFinish: (playerId: string) => void) {
    this.engine = new Engine(this.tickMs / 1000, onPlayerFinish); //planck wants seconds
  }

  setInputState(playerId: PlayerId, tick: number, input: InputState) {
    // If input arrives late, apply it immediately as the latest known state.
    // This avoids dead controls under even small network delay.
    if (tick <= this.tick) {
      this.inputState.set(playerId, input);
      return;
    }

    let playerQueue = this.inputByTick.get(playerId);
    if (!playerQueue) {
      playerQueue = new Map<number, InputState>();
      this.inputByTick.set(playerId, playerQueue);
    }
    playerQueue.set(tick, input);
  }

  loop() {
    if (!this.running) return;

    const now = perf.now();
    if (now > this.nextTickTime) {
      const currentTick = this.tick;
      this.applyInputsForTick(currentTick);

      const inputs: PlayerInputState[] = [];
      this.inputState.forEach((state, playerId) => {
        const lastHeld = this.lastJumpHeld.get(playerId) ?? false;
        const jumpPressed = state.jumpPressed || (state.jumpHeld && !lastHeld);
        this.lastJumpHeld.set(playerId, state.jumpHeld);
        inputs.push({
          playerId,
          move: state.move,
          jumpHeld: state.jumpHeld,
          jumpPressed,
        });
      });
      this.engine.step(inputs);
      // inputs.forEach((input) => {
      //   const ball = this.engine.getBallState(input.playerId);
      //   if (!ball) return;
      //   console.log(
      //     `[CSP-S] t=${currentTick} pid=${input.playerId} in(m=${input.move},jp=${Number(input.jumpPressed)},jh=${Number(input.jumpHeld)}) ` +
      //       `p=(${ball.x.toFixed(2)},${ball.y.toFixed(2)}) ` +
      //       `v=(${ball.xVel.toFixed(2)},${ball.yVel.toFixed(2)}) ` +
      //       `a=${ball.angle.toFixed(4)} av=${ball.angularVel.toFixed(4)}`,
      //   );
      // });
      this.snapshotCallback(this.engine.getSnapshot());

      this.tick++; // Last tick is done at this point, it's been broadcast. Move on to next tick
      this.nextTickTime = this.startTime + this.tick * this.tickMs;
    }

    setTimeout(this.loop.bind(this), this.nextTickTime - now);
  }

  start() {
    if (this.running) return;

    this.startTime = perf.now();
    this.tick = 1;
    this.nextTickTime = this.startTime + this.tick * this.tickMs;
    this.running = true;
    console.log('STARTING GAMEPLAY LOOP');
    this.loop();
  }

  stop() {
    this.running = false; // automatically kills loop
  }

  spawnPlayer(playerId: PlayerId) {
    this.engine.spawnPlayer(playerId); // TODO:: ?return the boolean from engine.spawnPlayer indicating whether spawn succeeded
  }

  getSnapshot(): TickSnapshot {
    return this.engine.getSnapshot();
  }

  async loadLevel(level: LevelDefinition) {
    this.engine.loadLevel(level);
  }

  private applyInputsForTick(tick: number) {
    this.inputByTick.forEach((queue, playerId) => {
      const input = queue.get(tick);
      if (!input) return;
      this.inputState.set(playerId, input);
      queue.delete(tick);
    });
  }
}
