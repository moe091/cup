import Phaser from 'phaser';
import type { RemotePlayerStateUpdate } from '@cup/bouncer-shared';

export type SampleMode = 'interp' | 'extrap' | 'single';

export type SmoothedState = {
  x: number;
  y: number;
  angle: number;
  // Which branch produced this sample + how many snapshots were buffered, for
  // diagnostics. 'extrap'/'single' indicate the interpolation buffer underran.
  mode: SampleMode;
  bufferDepth: number;
};

const MAX_SNAPSHOTS_PER_PLAYER = 64;

// How fast the per-player clock offset is allowed to drift upward toward the
// observed latency. It snaps DOWN instantly to any new minimum (best estimate
// of the latency floor) and drifts up slowly so it can recover if the floor
// genuinely rises (clock drift / route change) without chasing jitter spikes.
const OFFSET_DRIFT_ALPHA = 0.01;

type BufferedSnapshot = RemotePlayerStateUpdate & {
  receivedAtMs: number;
};

/**
 * Buffers remote snapshots and produces a smoothed sample for rendering.
 *
 * Interpolation runs on the SENDER's timeline (`tMs`), not local arrival time.
 * The spacing between a sender's `tMs` values is its true, jitter-free snapshot
 * cadence, so each interpolation segment has a uniform duration and the ball
 * replays each fixed distance over a fixed time → constant velocity, no jitter.
 *
 * Cross-machine clock sync is NOT required. We map the sender's clock onto ours
 * with a per-player `offset` estimated from `(receivedAtMs - tMs)`, tracked
 * toward its minimum (the latency floor). A constant error in `offset` only
 * shifts where the playback cursor sits (the effective interpolation delay); it
 * cannot distort snapshot spacing, so it cannot reintroduce velocity jitter.
 */
export class RemoteSmoother {
  private snapshotsByPlayer = new Map<string, BufferedSnapshot[]>();
  private latestSeqByPlayer = new Map<string, number>();
  // local→sender clock offset: localTime ≈ tMs + offset.
  private offsetByPlayer = new Map<string, number>();

  addSnapshot(snapshot: RemotePlayerStateUpdate) {
    const lastSeq = this.latestSeqByPlayer.get(snapshot.playerId);
    if (typeof lastSeq === 'number' && snapshot.seq <= lastSeq) {
      return;
    }

    this.latestSeqByPlayer.set(snapshot.playerId, snapshot.seq);

    const receivedAtMs = performance.now();
    this.updateOffset(snapshot.playerId, receivedAtMs - snapshot.tMs);

    const snapshots = this.snapshotsByPlayer.get(snapshot.playerId) ?? [];
    snapshots.push({ ...snapshot, receivedAtMs });
    // Ordered by source time. Equivalent to seq order since tMs is monotonic per
    // sender; sorting keeps us correct if anything ever arrives out of order.
    snapshots.sort((a, b) => a.tMs - b.tMs);

    if (snapshots.length > MAX_SNAPSHOTS_PER_PLAYER) {
      snapshots.splice(0, snapshots.length - MAX_SNAPSHOTS_PER_PLAYER);
    }

    this.snapshotsByPlayer.set(snapshot.playerId, snapshots);
  }

  sample(playerId: string, renderTimeMs: number, extrapolationCapMs: number): SmoothedState | null {
    const snapshots = this.snapshotsByPlayer.get(playerId);
    if (!snapshots || snapshots.length === 0) {
      return null;
    }

    if (snapshots.length === 1) {
      const only = snapshots[0];
      return { x: only.x, y: only.y, angle: only.angle, mode: 'single', bufferDepth: 1 };
    }

    // Convert the render cursor (local timeline) onto the sender's timeline so we
    // can locate it among the snapshots by their jitter-free `tMs` spacing.
    const offset = this.offsetByPlayer.get(playerId) ?? 0;
    const targetTms = renderTimeMs - offset;

    const olderIdx = this.findSnapshotIndexAtOrBefore(snapshots, targetTms);
    if (olderIdx >= 0 && olderIdx < snapshots.length - 1) {
      const a = snapshots[olderIdx];
      const b = snapshots[olderIdx + 1];
      const spanMs = Math.max(1, b.tMs - a.tMs);
      const t = Phaser.Math.Clamp((targetTms - a.tMs) / spanMs, 0, 1);
      return {
        x: Phaser.Math.Linear(a.x, b.x, t),
        y: Phaser.Math.Linear(a.y, b.y, t),
        angle: Phaser.Math.Linear(a.angle, b.angle, t),
        mode: 'interp',
        bufferDepth: snapshots.length,
      };
    }

    const latest = snapshots[snapshots.length - 1];
    const dtMs = Math.min(extrapolationCapMs, Math.max(0, targetTms - latest.tMs));
    const dtSeconds = dtMs / 1000;
    return {
      // Extrapolate both axes along last-known velocity. Y is included even
      // though it can briefly sink a landing ball below the floor before it
      // corrects — that only happens if the buffer underruns at the same instant
      // as a landing (rare), and is preferable to freezing mid-jump.
      x: latest.x + latest.xVel * dtSeconds,
      y: latest.y + latest.yVel * dtSeconds,
      angle: latest.angle,
      mode: 'extrap',
      bufferDepth: snapshots.length,
    };
  }

  getPlayerIds(): string[] {
    return Array.from(this.snapshotsByPlayer.keys());
  }

  clearPlayer(playerId: string) {
    this.snapshotsByPlayer.delete(playerId);
    this.latestSeqByPlayer.delete(playerId);
    this.offsetByPlayer.delete(playerId);
  }

  clearAll() {
    this.snapshotsByPlayer.clear();
    this.latestSeqByPlayer.clear();
    this.offsetByPlayer.clear();
  }

  private updateOffset(playerId: string, rawOffset: number) {
    const cur = this.offsetByPlayer.get(playerId);
    if (cur === undefined || rawOffset < cur) {
      this.offsetByPlayer.set(playerId, rawOffset);
      return;
    }
    this.offsetByPlayer.set(playerId, cur + (rawOffset - cur) * OFFSET_DRIFT_ALPHA);
  }

  private findSnapshotIndexAtOrBefore(snapshots: BufferedSnapshot[], targetTms: number): number {
    let low = 0;
    let high = snapshots.length - 1;
    let answer = -1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (snapshots[mid].tMs <= targetTms) {
        answer = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return answer;
  }
}
