import { type BroadcastSnapshot, type PlayerId } from "../types.js";
import { Engine } from '@cup/bouncer-engine';
import { InputVector, PlayerInputVector, TickSnapshot } from "@cup/bouncer-shared";
import { performance as perf } from 'node:perf_hooks';
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
    private tickMs = 33;
    private nextTickTime = -1;
    private inputBuffer: PlayerInputVector[] = [];
    //NOTE: if I want to implement rollback later I'll have to add tick to inputs(can just add as they are applied, as long as re-apply them on the same tick it will be fine)

    constructor(private snapshotCallback: BroadcastSnapshot) {
        this.engine = new Engine();
    }

    addInput(playerId: PlayerId, inputVector: InputVector) { 
        this.inputBuffer.push({
            playerId,
            x: inputVector.x,
            y: inputVector.y,
        });
    }


    loop() {
        if (!this.running)
            return;

        const now = perf.now();
        if (now > this.nextTickTime) {
            const inputs = this.inputBuffer;
            this.inputBuffer = [];
            this.engine.step(inputs);
            this.inputBuffer = []; //TODO:: For rollback, save these inputs somewhere(combined with snapshot data taken from line below)
            this.snapshotCallback(this.engine.getSnapshot());

            this.tick++; // Last tick is done at this point, it's been broadcast. Move on to next tick
            this.nextTickTime = this.startTime + (this.tick * this.tickMs);
        }

        setTimeout(this.loop.bind(this), this.nextTickTime - now);
    }

    start() {
        if (this.running)
            return;

        this.startTime = perf.now();
        this.tick = 1;
        this.nextTickTime = this.startTime + (this.tick * this.tickMs);
        this.running = true;
        console.log("STARTING GAMEPLAY LOOP");
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


}