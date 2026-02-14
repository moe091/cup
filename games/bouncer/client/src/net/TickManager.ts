type TickManagerOptions = {
  tickRate: number;
  leadTicks?: number;
  maxCatchupTicks?: number;
};

export class TickManager {
  private tickMs: number;
  private leadTicks: number;
  private maxCatchupTicks: number;
  private serverTick: number | null = null;
  private tick = 0;
  private accumulatorMs = 0;
  private lastTimeMs = 0;

  constructor(options: TickManagerOptions) {
    this.tickMs = 1000 / options.tickRate;
    this.leadTicks = options.leadTicks ?? 2;
    this.maxCatchupTicks = options.maxCatchupTicks ?? 5;
  }

  start(nowMs: number) {
    this.lastTimeMs = nowMs;
  }

  reset() {
    this.serverTick = null;
    this.tick = 0;
    this.accumulatorMs = 0;
    this.lastTimeMs = 0;
  }

  onServerTick(tick: number) {
    this.serverTick = this.serverTick === null ? tick : Math.max(this.serverTick, tick);
  }

  update(nowMs: number): number {
    const deltaMs = nowMs - this.lastTimeMs;
    this.lastTimeMs = nowMs;
    this.accumulatorMs += deltaMs;

    let steps = Math.floor(this.accumulatorMs / this.tickMs);
    this.accumulatorMs -= steps * this.tickMs;

    if (this.serverTick !== null) {
      const targetTick = this.serverTick + this.leadTicks;
      const predictedTick = this.tick + steps;
      const drift = targetTick - predictedTick;

      if (drift > 0) {
        steps += Math.min(this.maxCatchupTicks, drift);
      } else if (drift < 0) {
        steps = Math.max(0, steps + drift);
      }
    }

    return steps;
  }

  consumeStep(): number {
    this.tick += 1;
    return this.tick;
  }

  getTick(): number {
    return this.tick;
  }
}
