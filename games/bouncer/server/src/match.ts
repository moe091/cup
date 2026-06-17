import type {
  MatchStatus,
  MatchPhase,
  LevelDefinition,
  LevelListItem,
  PlayerSpawn,
  RoundResultPlayer,
  ScoreGoal,
  MatchResultsUpdate,
  MatchResultPlayer,
} from '@cup/bouncer-shared';
import type { PlayerId, SocketId, PlayerSession } from './types.js';

/**
 * Slim data + scoring object for a single match/lobby.
 *
 * This class owns NO flow logic: no phase, no broadcasting, no timers. It is a
 * pure container of player/score/level data plus the scoring math. All flow and
 * transitions live in MatchStateMachine, which reads/mutates this via methods.
 */
export class Match {
  private players = new Map<PlayerId, PlayerSession>();
  private pointsByPlayer = new Map<PlayerId, number>();
  private winsByPlayer = new Map<PlayerId, number>();
  private minPlayers = 1;
  private levelSelection: LevelListItem | null = null;
  private scoreGoal: ScoreGoal = 30;
  private scoreGoalLocked = false;
  private hasStartedFirstRound = false;
  private roundsPlayed = 0;

  constructor(public matchId: string) {}

  // ---------------- Player data ---------------- \\

  addPlayer(playerId: PlayerId, socketId: SocketId, displayName: string, role: string) {
    this.players.set(playerId, { playerId, socketId, displayName, role, ready: false });
    if (!this.pointsByPlayer.has(playerId)) {
      this.pointsByPlayer.set(playerId, 0);
    }
    if (!this.winsByPlayer.has(playerId)) {
      this.winsByPlayer.set(playerId, 0);
    }
  }

  removePlayer(playerId: PlayerId) {
    this.players.delete(playerId);
    this.pointsByPlayer.delete(playerId);
    this.winsByPlayer.delete(playerId);
  }

  getPlayer(playerId: PlayerId): PlayerSession | undefined {
    return this.players.get(playerId);
  }

  getPlayers(): PlayerSession[] {
    return Array.from(this.players.values());
  }

  getPlayerIds(): PlayerId[] {
    return Array.from(this.players.keys());
  }

  size(): number {
    return this.players.size;
  }

  isEmpty(): boolean {
    return this.players.size === 0;
  }

  isLeader(playerId: PlayerId): boolean {
    return this.players.get(playerId)?.role === 'creator';
  }

  // ---------------- Ready state ---------------- \\

  setReady(playerId: PlayerId, ready: boolean) {
    const player = this.players.get(playerId);
    if (player) {
      player.ready = ready;
    }
  }

  setAllReady(ready: boolean) {
    this.players.forEach((player) => {
      player.ready = ready;
    });
  }

  allNonLeadersReady(): boolean {
    for (const player of this.players.values()) {
      if (player.role === 'creator') {
        continue;
      }
      if (!player.ready) {
        return false;
      }
    }
    return true;
  }

  // ---------------- Level / score goal ---------------- \\

  setLevelSelection(level: LevelListItem) {
    this.levelSelection = level;
  }

  getLevelSelection(): LevelListItem | null {
    return this.levelSelection;
  }

  getScoreGoal(): ScoreGoal {
    return this.scoreGoal;
  }

  isScoreGoalLocked(): boolean {
    return this.scoreGoalLocked;
  }

  setScoreGoal(goal: ScoreGoal) {
    this.scoreGoal = goal;
  }

  /** Called when the first round of a match begins: locks the score goal + level for the match. */
  markFirstRoundStarted() {
    if (!this.hasStartedFirstRound) {
      this.hasStartedFirstRound = true;
      this.scoreGoalLocked = true;
    }
  }

  // ---------------- Spawns ---------------- \\

  assignSpawns(level: LevelDefinition): PlayerSpawn[] {
    const spawnPoints = level.objects.filter((obj) => obj.type === 'spawnPoint');
    const playerIds = this.getPlayerIds();
    return playerIds.map((playerId, idx) => {
      const spawn = spawnPoints[idx] ?? spawnPoints[0];
      return { playerId, x: spawn?.x ?? 0, y: spawn?.y ?? 0 };
    });
  }

  // ---------------- Scoring ---------------- \\

  private pointsForPlace(place: number): number {
    if (place === 1) return 10;
    if (place === 2) return 7;
    if (place === 3) return 5;
    if (place === 4) return 3;
    return 1;
  }

  private getGoalThreshold(): number | null {
    return this.scoreGoal === 'NEVER' ? null : this.scoreGoal;
  }

  private compareFinalRoundPlaceAsc(a: number | null, b: number | null): number {
    const aVal = a ?? Number.POSITIVE_INFINITY;
    const bVal = b ?? Number.POSITIVE_INFINITY;
    return aVal - bVal;
  }

  /**
   * Computes round results from the finish order, accumulates points into each
   * player's running total, and increments roundsPlayed. Returns the per-player
   * results plus the winner(s), if the score goal was reached this round.
   */
  computeRoundResults(
    finishedPlayerIds: PlayerId[],
    finishTimesMs: Map<PlayerId, number>,
  ): { roundResults: RoundResultPlayer[]; winners: PlayerId[] } {
    const playersInOrder = this.getPlayers();
    const finishedSet = new Set(finishedPlayerIds);
    const finishers = finishedPlayerIds
      .map((playerId) => this.players.get(playerId))
      .filter(Boolean) as PlayerSession[];
    const dnfs = playersInOrder.filter((p) => !finishedSet.has(p.playerId));
    const ordered = [...finishers, ...dnfs];

    const roundResults: RoundResultPlayer[] = ordered.map((player, idx) => {
      const isDnf = !finishedSet.has(player.playerId);
      const finishPlace = isDnf ? null : idx + 1;
      const pointsEarned = isDnf ? 0 : this.pointsForPlace(idx + 1);
      const nextPoints = (this.pointsByPlayer.get(player.playerId) ?? 0) + pointsEarned;
      this.pointsByPlayer.set(player.playerId, nextPoints);

      return {
        playerId: player.playerId,
        displayName: player.displayName,
        finishPlace,
        finishTimeMs: finishTimesMs.get(player.playerId) ?? null,
        pointsEarned,
        totalPoints: nextPoints,
        dnf: isDnf,
      };
    });

    this.roundsPlayed += 1;

    let winners: PlayerId[] = [];
    const goalThreshold = this.getGoalThreshold();
    if (goalThreshold !== null) {
      const contenders = roundResults.filter((result) => result.totalPoints >= goalThreshold);
      if (contenders.length > 0) {
        contenders.sort((a, b) => {
          if (b.totalPoints !== a.totalPoints) {
            return b.totalPoints - a.totalPoints;
          }
          return this.compareFinalRoundPlaceAsc(a.finishPlace, b.finishPlace);
        });
        winners = [contenders[0].playerId as PlayerId];
      }
    }

    return { roundResults, winners };
  }

  buildMatchResults(roundResults: RoundResultPlayer[], winners: PlayerId[]): MatchResultsUpdate | null {
    if (this.scoreGoal === 'NEVER') {
      return null;
    }

    const finalRoundPlaceFor = (playerId: PlayerId): number | null =>
      roundResults.find((result) => result.playerId === playerId)?.finishPlace ?? null;

    const standings: MatchResultPlayer[] = this.getPlayers().map((player) => ({
      playerId: player.playerId,
      displayName: player.displayName,
      totalPoints: this.pointsByPlayer.get(player.playerId) ?? 0,
      rank: 0,
      finalRoundPlace: finalRoundPlaceFor(player.playerId),
    }));

    standings.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      return this.compareFinalRoundPlaceAsc(a.finalRoundPlace, b.finalRoundPlace);
    });

    standings.forEach((player, idx) => {
      player.rank = idx + 1;
    });

    return {
      scoreGoal: this.scoreGoal,
      winners,
      roundsPlayed: this.roundsPlayed,
      players: standings,
    };
  }

  recordWins(winners: PlayerId[]) {
    winners.forEach((winnerId) => {
      this.winsByPlayer.set(winnerId, (this.winsByPlayer.get(winnerId) ?? 0) + 1);
    });
  }

  /** Resets points, ready flags, and match-level locks so a fresh match can begin. */
  resetForNewMatch() {
    this.pointsByPlayer.forEach((_, playerId) => this.pointsByPlayer.set(playerId, 0));
    this.setAllReady(false);
    this.scoreGoalLocked = false;
    this.hasStartedFirstRound = false;
    this.roundsPlayed = 0;
  }

  // ---------------- Status snapshot ---------------- \\

  buildStatus(phase: MatchPhase): MatchStatus {
    return {
      matchId: this.matchId,
      phase,
      minPlayers: this.minPlayers,
      scoreGoal: this.scoreGoal,
      scoreGoalLocked: this.scoreGoalLocked,
      players: this.getPlayers().map((player) => ({
        playerId: player.playerId,
        displayName: player.displayName,
        ready: player.ready,
        role: player.role,
        points: this.pointsByPlayer.get(player.playerId) ?? 0,
        wins: this.winsByPlayer.get(player.playerId) ?? 0,
      })),
    };
  }
}
