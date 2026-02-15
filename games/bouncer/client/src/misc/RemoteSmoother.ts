import Phaser from 'phaser';
import type { RemotePlayerStateUpdate } from '@cup/bouncer-shared';

export type SmoothedState = {
  x: number;
  y: number;
  angle: number;
};

const MAX_SNAPSHOTS_PER_PLAYER = 64;

type BufferedSnapshot = RemotePlayerStateUpdate & {
  receivedAtMs: number;
};

export class RemoteSmoother {
  private snapshotsByPlayer = new Map<string, BufferedSnapshot[]>();
  private latestSeqByPlayer = new Map<string, number>();

  addSnapshot(snapshot: RemotePlayerStateUpdate) {
    const lastSeq = this.latestSeqByPlayer.get(snapshot.playerId);
    if (typeof lastSeq === 'number' && snapshot.seq <= lastSeq) {
      return;
    }

    this.latestSeqByPlayer.set(snapshot.playerId, snapshot.seq);

    const snapshots = this.snapshotsByPlayer.get(snapshot.playerId) ?? [];
    snapshots.push({
      ...snapshot,
      receivedAtMs: performance.now(),
    });
    snapshots.sort((a, b) => a.receivedAtMs - b.receivedAtMs);

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
      return { x: only.x, y: only.y, angle: only.angle };
    }

    const olderIdx = this.findSnapshotIndexAtOrBefore(snapshots, renderTimeMs);
    if (olderIdx >= 0 && olderIdx < snapshots.length - 1) {
      const a = snapshots[olderIdx];
      const b = snapshots[olderIdx + 1];
      const spanMs = Math.max(1, b.receivedAtMs - a.receivedAtMs);
      const t = Phaser.Math.Clamp((renderTimeMs - a.receivedAtMs) / spanMs, 0, 1);
      return {
        x: Phaser.Math.Linear(a.x, b.x, t),
        y: Phaser.Math.Linear(a.y, b.y, t),
        angle: Phaser.Math.Linear(a.angle, b.angle, t),
      };
    }

    const latest = snapshots[snapshots.length - 1];
    const dtMs = Math.min(extrapolationCapMs, Math.max(0, renderTimeMs - latest.receivedAtMs));
    const dtSeconds = dtMs / 1000;
    return {
      x: latest.x + latest.xVel * dtSeconds,
      y: latest.y,
      angle: latest.angle,
    };
  }

  getPlayerIds(): string[] {
    return Array.from(this.snapshotsByPlayer.keys());
  }

  clearPlayer(playerId: string) {
    this.snapshotsByPlayer.delete(playerId);
    this.latestSeqByPlayer.delete(playerId);
  }

  clearAll() {
    this.snapshotsByPlayer.clear();
    this.latestSeqByPlayer.clear();
  }

  private findSnapshotIndexAtOrBefore(snapshots: BufferedSnapshot[], targetTimeMs: number): number {
    let low = 0;
    let high = snapshots.length - 1;
    let answer = -1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (snapshots[mid].receivedAtMs <= targetTimeMs) {
        answer = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return answer;
  }
}
