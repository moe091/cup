import { Engine } from '@cup/bouncer-engine';
import type { BallState, InputState, LevelDefinition, PlayerInputState, TickSnapshot } from '@cup/bouncer-shared';
import { TickManager } from './TickManager';
import type { InputSampler } from '../misc/InputSampler';

type SnapshotCallback = (snapshot: TickSnapshot) => void;

type PredictedState = {
  tick: number;
  localBall: BallState | null;
};

const ZERO_INPUT: InputState = { move: 0, jumpPressed: false, jumpHeld: false };

export class Prediction {
  private engine: Engine;
  private tickManager: TickManager;
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private localPlayerId: string;
  private inputSampler: InputSampler | null = null;
  private sendInput: ((tick: number, input: InputState) => void) | null = null;
  private inputHistory: Map<number, InputState> = new Map();
  private predictedHistory: Map<number, PredictedState> = new Map();
  private maxHistoryTicks: number;
  private debugLogs = false;
  private reconcilePositionThresholdPx = 3;
  private maxRollbackTicks = 60;

  constructor(
    localPlayerId: string,
    tickRate: number,
    private snapshotCallback: SnapshotCallback = () => {},
  ) {
    this.localPlayerId = localPlayerId;
    this.engine = new Engine(1 / tickRate, () => {});
    this.tickManager = new TickManager({ tickRate });
    this.maxHistoryTicks = tickRate;
  }

  loadLevel(level: LevelDefinition) {
    this.engine.loadLevel(level);
  }

  spawnPlayer(playerId: string) {
    this.engine.spawnPlayer(playerId);
  }

  setInputSampler(inputSampler: InputSampler) {
    this.inputSampler = inputSampler;
  }

  setSendInput(callback: (tick: number, input: InputState) => void) {
    this.sendInput = callback;
  }

  onServerSnapshot(snapshot: TickSnapshot) {
    this.tickManager.onServerTick(snapshot.tick);
    // this.reconcileFromSnapshot(snapshot);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.tickManager.start(performance.now());
    this.timer = setInterval(() => this.update(), 8);
  }

  startFromTickZero() {
    this.reset();
    this.start();
  }

  stop() {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  reset() {
    this.tickManager.reset();
    this.inputHistory.clear();
    this.predictedHistory.clear();
  }

  update() {
    if (!this.running) return;
    const now = performance.now();
    const steps = this.tickManager.update(now);
    for (let i = 0; i < steps; i++) {
      this.stepOnce();
    }
  }

  getSnapshot(): TickSnapshot {
    return this.engine.getSnapshot();
  }

  getLocalBallState(): BallState | null {
    return this.engine.getBallState(this.localPlayerId);
  }

  setLocalBallState(state: BallState) {
    this.engine.setBallState(state);
  }

  getPredictedHistory(): Map<number, PredictedState> {
    return this.predictedHistory;
  }

  setDebugLogs(enabled: boolean) {
    this.debugLogs = enabled;
  }

  private stepOnce() {
    const tick = this.tickManager.consumeStep();
    const input = this.inputSampler?.consumeTickInput() ?? ZERO_INPUT;
    this.sendInput?.(tick, input);

    this.inputHistory.set(tick, input);
    this.pruneHistory();
    this.applyInputForTick(tick, input, true);
  }

  private applyInputForTick(tick: number, input: InputState, emitSnapshot: boolean) {
    const payload: PlayerInputState = {
      playerId: this.localPlayerId,
      move: input.move,
      jumpPressed: input.jumpPressed,
      jumpHeld: input.jumpHeld,
    };
    this.engine.step([payload]);

    const localBall = this.engine.getBallState(this.localPlayerId);
    if (localBall && this.debugLogs) {
      console.log(
        `[CSP-C] t=${tick} in(m=${input.move},jp=${Number(input.jumpPressed)},jh=${Number(input.jumpHeld)}) ` +
          `p=(${localBall.x.toFixed(2)},${localBall.y.toFixed(2)}) ` +
          `v=(${localBall.xVel.toFixed(2)},${localBall.yVel.toFixed(2)}) ` +
          `a=${localBall.angle.toFixed(4)} av=${localBall.angularVel.toFixed(4)}`,
      );
    }

    this.predictedHistory.set(tick, { tick, localBall });
    if (emitSnapshot) {
      this.snapshotCallback(this.engine.getSnapshot());
    }
  }

  private reconcileFromSnapshot(snapshot: TickSnapshot) {
    const snapshotTick = snapshot.tick;
    const currentTick = this.tickManager.getTick();
    if (snapshotTick > currentTick) return;
    if (currentTick - snapshotTick > this.maxRollbackTicks) return;

    const serverBall = snapshot.balls.find((ball) => ball.id === this.localPlayerId);
    if (!serverBall) return;

    const predictedAtSnapshotTick = this.predictedHistory.get(snapshotTick)?.localBall;
    if (!predictedAtSnapshotTick) return;

    const positionError = Math.hypot(
      predictedAtSnapshotTick.x - serverBall.x,
      predictedAtSnapshotTick.y - serverBall.y,
    );

    if (positionError <= this.reconcilePositionThresholdPx) {
      return;
    }

    this.engine.setBallState({
      id: serverBall.id,
      x: serverBall.x,
      y: serverBall.y,
      xVel: serverBall.xVel,
      yVel: serverBall.yVel,
      angle: serverBall.angle,
      angularVel: serverBall.angularVel,
    });

    for (let tick = snapshotTick + 1; tick <= currentTick; tick++) {
      const input = this.inputHistory.get(tick) ?? ZERO_INPUT;
      this.applyInputForTick(tick, input, false);
    }

    if (this.debugLogs) {
      console.log(
        `[CSP-C-RECON] at=${snapshotTick} err=${positionError.toFixed(2)} replay=${currentTick - snapshotTick}`,
      );
    }
  }

  private pruneHistory() {
    const minTick = this.tickManager.getTick() - this.maxHistoryTicks;
    this.inputHistory.forEach((_value, tick) => {
      if (tick < minTick) this.inputHistory.delete(tick);
    });
    this.predictedHistory.forEach((_value, tick) => {
      if (tick < minTick) this.predictedHistory.delete(tick);
    });
  }
}
