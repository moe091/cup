import { Socket } from 'socket.io';
import type {
  MatchStatus,
  MatchPhase,
  MatchCountdown,
  LevelDefinition,
  LevelListItem,
  InitializePlayersPayload,
  PlayerStateUpdate,
  RemotePlayerStateUpdate,
  FinishOrderUpdate,
  RoundResultsUpdate,
  RoundResultPlayer,
  RoundEndReason,
  ScoreGoal,
  MatchResultsUpdate,
  MatchResultPlayer,
} from '@cup/bouncer-shared';
import type { PlayerId, SocketId, PlayerSession, Broadcast, BroadcastExcept } from './types.js';
import { loadLevelDef } from './api/helpers.js';

const FINISH_TIMEOUT_MS = 30_000;

export class Match {
  private players = new Map<PlayerId, PlayerSession>();
  private pointsByPlayer = new Map<PlayerId, number>();
  private winsByPlayer = new Map<PlayerId, number>();
  private phase: MatchPhase = 'WAITING';
  private minPlayers = 1;
  private countdownSeconds = 1;
  private awaitingAcks = new Set<PlayerId>();
  private afterAcks: (() => void) | null = null;
  private levelDef: LevelDefinition | null = null;
  private levelSelection: LevelListItem | null = null;
  private finishedPlayerIds: PlayerId[] = [];
  private finishTimesMs = new Map<PlayerId, number>();
  private firstFinisherAtMs: number | null = null;
  private roundStartAtMs: number | null = null;
  private finishTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private scoreGoal: ScoreGoal = 30;
  private scoreGoalLocked = false;
  private hasStartedFirstRound = false;
  private roundsPlayed = 0;

  constructor(
    public matchId: string,
    private broadcast: Broadcast,
    private broadcastExcept: BroadcastExcept,
  ) {}

  private addPlayer(playerId: PlayerId, socketId: SocketId, displayName: string, role: string) {
    this.players.set(playerId, { playerId, socketId, displayName, role, ready: false });
    if (!this.pointsByPlayer.has(playerId)) {
      this.pointsByPlayer.set(playerId, 0);
    }
    if (!this.winsByPlayer.has(playerId)) {
      this.winsByPlayer.set(playerId, 0);
    }
  }

  private async loadLevel(): Promise<LevelDefinition | null> {
    if (!this.levelSelection) {
      console.error('[Match.loadLevel] loadLevel called with no levelSelection');
      return null;
    }

    this.levelDef = await loadLevelDef(this.levelSelection.id);
    return this.levelDef;
  }

  private startGame() {
    this.roundStartAtMs = Date.now();
    this.broadcast('start_match', {});
  }

  private startCountdown() {
    let countdownTimer = this.countdownSeconds;

    const countdownSecond = () => {
      if (countdownTimer <= 0) {
        this.startGame();
      } else {
        this.broadcast('countdown', { secondsLeft: countdownTimer } as MatchCountdown);
        countdownTimer--;
        setTimeout(() => countdownSecond(), 1000);
      }
    };

    countdownSecond();
  }

  private assignSpawns(level: LevelDefinition): InitializePlayersPayload {
    const spawnPoints = level.objects.filter((obj) => obj.type === 'spawnPoint');
    const playerIds = Array.from(this.players.keys());
    const spawns = playerIds.map((playerId, idx) => {
      const spawn = spawnPoints[idx] ?? spawnPoints[0];
      const x = spawn?.x ?? 0;
      const y = spawn?.y ?? 0;
      return { playerId, x, y };
    });

    return { spawns };
  }

  private pointsForPlace(place: number): number {
    if (place === 1) return 10;
    if (place === 2) return 7;
    if (place === 3) return 5;
    if (place === 4) return 3;
    return 1;
  }

  private getGoalThreshold(): number | null {
    if (this.scoreGoal === 'NEVER') {
      return null;
    }
    return this.scoreGoal;
  }

  private finalRoundPlaceFor(playerId: PlayerId, roundResults: RoundResultPlayer[]): number | null {
    return roundResults.find((result) => result.playerId === playerId)?.finishPlace ?? null;
  }

  private compareFinalRoundPlaceAsc(a: number | null, b: number | null): number {
    const aVal = a ?? Number.POSITIVE_INFINITY;
    const bVal = b ?? Number.POSITIVE_INFINITY;
    return aVal - bVal;
  }

  private buildMatchResults(roundResults: RoundResultPlayer[], winners: PlayerId[]): MatchResultsUpdate | null {
    if (this.scoreGoal === 'NEVER') {
      return null;
    }

    const standings: MatchResultPlayer[] = Array.from(this.players.values()).map((player) => {
      const finalRoundPlace = this.finalRoundPlaceFor(player.playerId, roundResults);
      return {
        playerId: player.playerId,
        displayName: player.displayName,
        totalPoints: this.pointsByPlayer.get(player.playerId) ?? 0,
        rank: 0,
        finalRoundPlace,
      };
    });

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

  private resetForNewMatch() {
    this.resetPointsOnly();
    this.players.forEach((player) => {
      player.ready = false;
    });
    this.scoreGoalLocked = false;
    this.hasStartedFirstRound = false;
    this.roundsPlayed = 0;
  }

  private resetPointsOnly() {
    this.pointsByPlayer.forEach((_, playerId) => {
      this.pointsByPlayer.set(playerId, 0);
    });
  }

  private setAllPlayersReady(ready: boolean) {
    this.players.forEach((player) => {
      player.ready = ready;
    });
  }

  private areAllNonCreatorPlayersReady(): boolean {
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

  private resetRoundState() {
    this.finishedPlayerIds = [];
    this.finishTimesMs.clear();
    this.firstFinisherAtMs = null;
    this.roundStartAtMs = null;
    if (this.finishTimeoutHandle) {
      clearTimeout(this.finishTimeoutHandle);
      this.finishTimeoutHandle = null;
    }
  }

  private maybeEndRoundIfAllFinished() {
    const totalPlayers = this.players.size;
    if (totalPlayers === 0) {
      return;
    }
    if (this.finishedPlayerIds.length >= totalPlayers) {
      this.endRound('all_finished');
    }
  }

  private endRound(reason: RoundEndReason) {
    if (this.phase !== 'IN_PROGRESS') {
      return;
    }

    if (this.finishTimeoutHandle) {
      clearTimeout(this.finishTimeoutHandle);
      this.finishTimeoutHandle = null;
    }

    const playersInOrder = Array.from(this.players.values());
    const finishedSet = new Set(this.finishedPlayerIds);
    const finishers = this.finishedPlayerIds.map((playerId) => this.players.get(playerId)).filter(Boolean) as PlayerSession[];
    const dnfs = playersInOrder.filter((p) => !finishedSet.has(p.playerId));
    const ordered = [...finishers, ...dnfs];

    const roundResults: RoundResultPlayer[] = ordered.map((player, idx) => {
      const isDnf = !finishedSet.has(player.playerId);
      const finishPlace = isDnf ? null : idx + 1;
      const pointsEarned = isDnf ? 0 : this.pointsForPlace(finishPlace);
      const nextPoints = (this.pointsByPlayer.get(player.playerId) ?? 0) + pointsEarned;
      this.pointsByPlayer.set(player.playerId, nextPoints);

      return {
        playerId: player.playerId,
        displayName: player.displayName,
        finishPlace,
        finishTimeMs: this.finishTimesMs.get(player.playerId) ?? null,
        pointsEarned,
        totalPoints: nextPoints,
        dnf: isDnf,
      };
    });

    this.roundsPlayed += 1;

    const goalThreshold = this.getGoalThreshold();
    let winners: PlayerId[] = [];
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

    if (winners.length > 0 && this.scoreGoal !== 'NEVER') {
      this.setPhase('MATCH_END');
      const matchResults = this.buildMatchResults(roundResults, winners);
      if (matchResults) {
        this.broadcast('match_results', matchResults);
      }

      winners.forEach((winnerId) => {
        const nextWins = (this.winsByPlayer.get(winnerId) ?? 0) + 1;
        this.winsByPlayer.set(winnerId, nextWins);
      });

      this.resetForNewMatch();
      this.broadcastStatus();
    } else {
      this.setAllPlayersReady(false);
      this.setPhase('ROUND_END');

      const resultsUpdate: RoundResultsUpdate = {
        reason,
        firstFinisherAtMs: this.firstFinisherAtMs,
        roundEndedAtMs: Date.now(),
        scoreGoal: this.scoreGoal,
        winners,
        players: roundResults,
      };
      this.broadcast('round_results', resultsUpdate);
    }

    this.finishedPlayerIds = [];
    this.finishTimesMs.clear();
    this.firstFinisherAtMs = null;
    this.roundStartAtMs = null;
  }

  broadcastStatus() {
    const status: MatchStatus = {
      matchId: this.matchId,
      phase: this.phase,
      minPlayers: this.minPlayers,
      scoreGoal: this.scoreGoal,
      scoreGoalLocked: this.scoreGoalLocked,
      players: Array.from(this.players.values()).map((player) => ({
        playerId: player.playerId,
        displayName: player.displayName,
        ready: player.ready,
        role: player.role,
        points: this.pointsByPlayer.get(player.playerId) ?? 0,
        wins: this.winsByPlayer.get(player.playerId) ?? 0,
      })),
    };

    this.broadcast('match_status', status);
  }

  onJoin(socket: Socket) {
    socket.data.playerId = socket.id as PlayerId;
    const playerId = socket.data.playerId as PlayerId;
    const displayName = socket.data.displayName as string;
    const role = socket.data.role as string;

    this.addPlayer(playerId, socket.id as SocketId, displayName, role);

    socket.emit('match_joined', { role, displayName });

    if (this.levelSelection) {
      socket.emit('set_level', this.levelSelection);
    }

    setTimeout(() => this.broadcastStatus(), 1000);
  }

  getPhase() {
    return this.phase;
  }

  setPhase(val: MatchPhase) {
    if ((this.phase === 'WAITING' || this.phase === 'ROUND_END' || this.phase === 'MATCH_END') && val === 'IN_PROGRESS') {
      this.phase = 'IN_PROGRESS_QUEUED';
      this.awaitingAcks.clear();
      this.setAllPlayersReady(false);

      if (!this.hasStartedFirstRound) {
        this.hasStartedFirstRound = true;
        this.scoreGoalLocked = true;
      }

      this.players.forEach((player) => {
        this.awaitingAcks.add(player.playerId);
      });
      this.afterAcks = () => {
        void this.startGameplay();
      };
      this.broadcastStatus();
      return;
    }

    this.phase = val;
    this.broadcastStatus();
  }

  async startGameplay() {
    this.resetRoundState();
    this.setPhase('IN_PROGRESS');

    const level = await this.loadLevel();
    if (!level) {
      console.error('[Match.startGameplay] Failed to load level');
      this.setPhase('WAITING');
      this.broadcastStatus();
      return;
    }

    this.broadcast('load_level', level);
    this.broadcast('initialize_players', this.assignSpawns(level));
    this.startCountdown();
  }

  onClientReady(socket: Socket) {
    this.awaitingAcks.delete(socket.data.playerId as PlayerId);

    if (this.awaitingAcks.size === 0 && this.afterAcks) {
      const afterAcks = this.afterAcks;
      this.afterAcks = null;
      afterAcks();
    }
  }

  onSetReady(socket: Socket, data: { ready: boolean }) {
    const playerId = socket.data.playerId as PlayerId;
    const player = this.players.get(playerId);
    if (!player) {
      return;
    }

    if (this.phase === 'ROUND_END') {
      if (socket.data.role === 'creator') {
        if (data.ready && this.areAllNonCreatorPlayersReady()) {
          this.setPhase('IN_PROGRESS');
        } else {
          this.broadcastStatus();
        }
        return;
      }

      player.ready = data.ready;
      this.broadcastStatus();
      return;
    }

    if (socket.data.role === 'creator') {
      if (this.phase === 'MATCH_END') {
        this.resetForNewMatch();
      }

      if (this.phase === 'WAITING' || this.phase === 'ROUND_END' || this.phase === 'MATCH_END') {
        this.setPhase('IN_PROGRESS');
      }
      return;
    }

    player.ready = data.ready;

    this.broadcastStatus();
  }

  onUpdateLevelSelection(socket: Socket, level: LevelListItem) {
    console.log(`${socket.data.role}-${socket.data.displayName} updated level selection to: ${level.name}`);
    this.levelSelection = level;
    this.broadcast('set_level', level);
  }

  onUpdateScoreGoal(socket: Socket, data: unknown) {
    if (socket.data.role !== 'creator') {
      return;
    }
    if (this.scoreGoalLocked || (this.phase !== 'WAITING' && this.phase !== 'MATCH_END')) {
      return;
    }

    if (!data || typeof data !== 'object') {
      return;
    }

    const candidate = (data as { scoreGoal?: unknown }).scoreGoal;
    if (candidate === 20 || candidate === 30 || candidate === 50 || candidate === 100 || candidate === 'NEVER') {
      this.scoreGoal = candidate;
      this.broadcastStatus();
    }
  }

  onPlayerState(socket: Socket, data: unknown) {
    if (this.phase !== 'IN_PROGRESS') {
      return;
    }

    const parsed = this.parsePlayerStateUpdate(data);
    if (!parsed) {
      return;
    }

    const payload: RemotePlayerStateUpdate = {
      playerId: socket.data.playerId as PlayerId,
      serverTimeMs: Date.now(),
      ...parsed,
    };

    this.broadcastExcept(socket.id, 'remote_player_state', payload);
  }

  onPlayerFinished(socket: Socket) {
    if (this.phase !== 'IN_PROGRESS') {
      return;
    }

    const playerId = socket.data.playerId as PlayerId;
    if (!this.players.has(playerId)) {
      return;
    }
    if (this.finishedPlayerIds.includes(playerId)) {
      return;
    }

    const now = Date.now();
    if (!this.firstFinisherAtMs) {
      this.firstFinisherAtMs = now;
      this.finishTimeoutHandle = setTimeout(() => {
        this.endRound('finish_timeout');
      }, FINISH_TIMEOUT_MS);
    }

    const finishTimeMs = this.roundStartAtMs ? Math.max(0, now - this.roundStartAtMs) : 0;
    this.finishTimesMs.set(playerId, finishTimeMs);
    this.finishedPlayerIds.push(playerId);

    const finishUpdate: FinishOrderUpdate = {
      finishedPlayerIds: [...this.finishedPlayerIds],
    };
    this.broadcast('finish_order_update', finishUpdate);

    this.maybeEndRoundIfAllFinished();
  }

  onLeave(socket: Socket) {
    const playerId = socket.data.playerId as PlayerId | undefined;
    if (playerId) {
      this.players.delete(playerId);
      this.pointsByPlayer.delete(playerId);
      this.winsByPlayer.delete(playerId);
      this.awaitingAcks.delete(playerId);
      this.finishedPlayerIds = this.finishedPlayerIds.filter((id) => id !== playerId);
      this.finishTimesMs.delete(playerId);
    }

    if (this.phase === 'IN_PROGRESS') {
      this.maybeEndRoundIfAllFinished();
    }

    this.broadcastStatus();
  }

  isEmpty() {
    return this.players.size === 0;
  }

  destroy() {
    this.awaitingAcks.clear();
    this.afterAcks = null;
    this.pointsByPlayer.clear();
    this.winsByPlayer.clear();
    this.resetRoundState();
  }

  private parsePlayerStateUpdate(data: unknown): PlayerStateUpdate | null {
    if (!data || typeof data !== 'object') {
      return null;
    }

    const candidate = data as Partial<PlayerStateUpdate>;
    if (!this.isFiniteNumber(candidate.seq)) return null;
    if (!this.isFiniteNumber(candidate.x)) return null;
    if (!this.isFiniteNumber(candidate.y)) return null;
    if (!this.isFiniteNumber(candidate.angle)) return null;
    if (!this.isFiniteNumber(candidate.xVel)) return null;
    if (!this.isFiniteNumber(candidate.yVel)) return null;

    return {
      seq: candidate.seq,
      x: candidate.x,
      y: candidate.y,
      angle: candidate.angle,
      xVel: candidate.xVel,
      yVel: candidate.yVel,
    };
  }

  private isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }
}
