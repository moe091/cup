import { Socket } from 'socket.io';
import type {
  MatchPhase,
  MatchCountdown,
  RoundStartingPayload,
  LevelDefinition,
  LevelListItem,
  PlayerStateUpdate,
  RemotePlayerStateUpdate,
  FinishOrderUpdate,
  RoundResultsUpdate,
  RoundEndReason,
  CheckpointReached,
} from '@cup/bouncer-shared';
import type { PlayerId, Broadcast, BroadcastExcept } from './types.js';
import { asPlayerId, asSocketId } from './types.js';
import { Match } from './match.js';
import { loadLevelDef } from './api/helpers.js';

const FINISH_TIMEOUT_MS = 120_000;
const COUNTDOWN_SECONDS = 3;
// Max time to wait for clients to report their level is built before starting the
// countdown anyway. Prevents a slow/missing client from stalling the match.
const ROUND_READY_TIMEOUT_MS = 4_000;

/**
 * Owns all flow/transition logic for a match. The leader's client is the only
 * driver of transitions (start / next round / new match); everything else is
 * the server reacting to events and broadcasting the new phase to all clients.
 *
 * Phases: PRE_MATCH -> COUNTDOWN -> IN_PROGRESS -> POST_ROUND -> (COUNTDOWN | POST_MATCH)
 *         POST_MATCH -> PRE_MATCH (leader starts a new match)
 *
 * The single "go" signal for clients is the IN_PROGRESS status broadcast — it
 * reaches everyone together, so all balls start at the same time and the
 * countdown can never be skipped.
 */
export class MatchStateMachine {
  private match: Match;
  private phase: MatchPhase = 'PRE_MATCH';

  // Per-round runtime state (only meaningful during COUNTDOWN / IN_PROGRESS).
  private finishedPlayerIds: PlayerId[] = [];
  private finishTimesMs = new Map<PlayerId, number>();
  private firstFinisherAtMs: number | null = null;
  private roundStartAtMs: number | null = null;
  // playerId -> (checkpoint index -> client-reported reach time, ms). First
  // report per checkpoint wins. Recorded for future split-time / scoreboard use.
  private checkpointTimesMs = new Map<PlayerId, Map<number, number>>();
  // playerId -> hazard death count this round (for a future round-end scoreboard).
  private deathsByPlayer = new Map<PlayerId, number>();
  private finishTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private countdownHandle: ReturnType<typeof setTimeout> | null = null;

  // Pre-fetched level for the current selection, so the COUNTDOWN transition is
  // instant instead of blocking on an API fetch.
  private cachedLevel: { id: string; def: LevelDefinition } | null = null;

  // Round-ready gate (COUNTDOWN): clients report when their level is built; the
  // 3-2-1 countdown only begins once everyone is ready (or the timeout fires).
  private readyPlayerIds = new Set<PlayerId>();
  private roundReadyTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private roundCountdownStarted = false;

  constructor(
    public matchId: string,
    private broadcast: Broadcast,
    private broadcastExcept: BroadcastExcept,
    private onEnd: () => void,
  ) {
    this.match = new Match(matchId);
  }

  getPhase(): MatchPhase {
    return this.phase;
  }

  isEmpty(): boolean {
    return this.match.isEmpty();
  }

  // ---------------- Public event handlers ---------------- \\

  /** Caller (main.ts) must ensure phase === 'PRE_MATCH' before calling. */
  onJoin(socket: Socket) {
    socket.data.playerId = socket.id;
    const playerId = asPlayerId(socket.id);
    const displayName = socket.data.displayName as string;
    const role = socket.data.role as string;

    this.match.addPlayer(playerId, asSocketId(socket.id), displayName, role);

    socket.emit('match_joined', { role, displayName });

    const levelSelection = this.match.getLevelSelection();
    if (levelSelection) {
      socket.emit('set_level', levelSelection);
    }

    this.broadcastStatus();
  }

  onLeave(socket: Socket) {
    const playerId = socket.data.playerId as PlayerId | undefined;
    if (!playerId) {
      return;
    }

    // No leader means nobody can drive the match — end it for everyone.
    if (this.match.isLeader(playerId)) {
      this.clearTimers();
      this.broadcast('host_left', {});
      this.onEnd();
      return;
    }

    this.match.removePlayer(playerId);
    this.finishedPlayerIds = this.finishedPlayerIds.filter((id) => id !== playerId);
    this.finishTimesMs.delete(playerId);

    if (this.match.isEmpty()) {
      this.clearTimers();
      this.onEnd();
      return;
    }

    if (this.phase === 'IN_PROGRESS') {
      this.maybeEndRoundIfAllFinished();
    } else if (this.phase === 'COUNTDOWN') {
      // A player leaving may make the remaining players all-ready.
      this.readyPlayerIds.delete(playerId);
      this.maybeStartCountdownIfAllReady();
    }

    this.broadcastStatus();
  }

  onSetReady(socket: Socket, data: { ready: boolean }) {
    if (this.phase !== 'PRE_MATCH') {
      return;
    }
    const playerId = socket.data.playerId as PlayerId;
    if (this.match.isLeader(playerId)) {
      return;
    }
    this.match.setReady(playerId, !!data?.ready);
    this.broadcastStatus();
  }

  onStartMatch(socket: Socket) {
    const playerId = socket.data.playerId as PlayerId;
    if (this.phase !== 'PRE_MATCH' || !this.match.isLeader(playerId)) {
      return;
    }
    if (!this.match.allNonLeadersReady()) {
      return;
    }
    void this.toCountdown();
  }

  onNextRound(socket: Socket) {
    const playerId = socket.data.playerId as PlayerId;
    if (this.phase !== 'POST_ROUND' || !this.match.isLeader(playerId)) {
      return;
    }
    void this.toCountdown();
  }

  onNewMatch(socket: Socket) {
    const playerId = socket.data.playerId as PlayerId;
    if (this.phase !== 'POST_MATCH' || !this.match.isLeader(playerId)) {
      return;
    }
    this.match.resetForNewMatch();
    this.toPreMatch();
  }

  /**
   * Instant solo restart (press R): wipes match/round state and drops straight
   * back into the countdown for the same level — reloading it so future timed
   * elements (moving platforms, etc.) restart from a fresh round clock. Only
   * allowed in a 1-player match and while a round is active/finished (not the
   * pre-match lobby).
   */
  onRestartMatch(socket: Socket) {
    const playerId = socket.data.playerId as PlayerId;
    if (!this.match.getPlayer(playerId)) {
      return;
    }
    if (this.match.size() !== 1 || this.phase === 'PRE_MATCH') {
      return;
    }
    console.log('[restart] solo restart requested');
    this.match.resetForNewMatch();
    void this.toCountdown();
  }

  /** A client reports its level is built and it's ready for the countdown. */
  onRoundReady(socket: Socket) {
    if (this.phase !== 'COUNTDOWN') {
      return;
    }
    const playerId = socket.data.playerId as PlayerId;
    if (!this.match.getPlayer(playerId)) {
      return;
    }
    this.readyPlayerIds.add(playerId);
    this.maybeStartCountdownIfAllReady();
  }

  onUpdateLevelSelection(socket: Socket, level: LevelListItem) {
    const playerId = socket.data.playerId as PlayerId;
    if (this.phase !== 'PRE_MATCH' || !this.match.isLeader(playerId)) {
      return;
    }
    this.match.setLevelSelection(level);
    this.broadcast('set_level', level);
    // Warm the cache so starting the match doesn't block on the API fetch.
    void this.prefetchLevel(level.id);
  }

  private async prefetchLevel(id: string): Promise<void> {
    if (this.cachedLevel?.id === id) {
      return;
    }
    try {
      const def = await loadLevelDef(id);
      this.cachedLevel = { id, def };
    } catch (err) {
      console.error('[MatchStateMachine.prefetchLevel] Failed to prefetch level', err);
    }
  }

  onUpdateScoreGoal(socket: Socket, data: unknown) {
    const playerId = socket.data.playerId as PlayerId;
    if (this.phase !== 'PRE_MATCH' || !this.match.isLeader(playerId) || this.match.isScoreGoalLocked()) {
      return;
    }
    if (!data || typeof data !== 'object') {
      return;
    }
    const candidate = (data as { scoreGoal?: unknown }).scoreGoal;
    if (candidate === 20 || candidate === 30 || candidate === 50 || candidate === 100 || candidate === 'NEVER') {
      this.match.setScoreGoal(candidate);
      this.broadcastStatus();
    }
  }

  onPlayerState(socket: Socket, data: unknown) {
    // COUNTDOWN is allowed so a client's spawn-announce reaches peers and their
    // ball renders during the countdown (frozen until IN_PROGRESS).
    if (this.phase !== 'COUNTDOWN' && this.phase !== 'IN_PROGRESS') {
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
    if (!this.match.getPlayer(playerId) || this.finishedPlayerIds.includes(playerId)) {
      return;
    }

    const now = Date.now();
    if (!this.firstFinisherAtMs) {
      this.firstFinisherAtMs = now;
      this.finishTimeoutHandle = setTimeout(() => this.endRound('finish_timeout'), FINISH_TIMEOUT_MS);
    }

    this.finishTimesMs.set(playerId, this.roundStartAtMs ? Math.max(0, now - this.roundStartAtMs) : 0);
    this.finishedPlayerIds.push(playerId);

    const finishUpdate: FinishOrderUpdate = { finishedPlayerIds: [...this.finishedPlayerIds] };
    this.broadcast('finish_order_update', finishUpdate);

    this.maybeEndRoundIfAllFinished();
  }

  // Records a player's checkpoint reach time (first report per checkpoint wins).
  // Stored for future split-time / scoreboard features; no broadcast yet.
  onCheckpointReached(socket: Socket, data: unknown) {
    if (this.phase !== 'IN_PROGRESS') {
      return;
    }
    const playerId = socket.data.playerId as PlayerId;
    if (!this.match.getPlayer(playerId)) {
      return;
    }
    if (!data || typeof data !== 'object') {
      return;
    }
    const c = data as Partial<CheckpointReached>;
    if (!this.isFiniteNumber(c.index) || !this.isFiniteNumber(c.timeMs)) {
      return;
    }

    let perPlayer = this.checkpointTimesMs.get(playerId);
    if (!perPlayer) {
      perPlayer = new Map<number, number>();
      this.checkpointTimesMs.set(playerId, perPlayer);
    }
    if (perPlayer.has(c.index)) {
      return; // single-use: keep the first reported time
    }
    perPlayer.set(c.index, Math.max(0, c.timeMs));
    console.log(`[checkpoint] ${playerId} reached CP#${c.index} at ${Math.round(c.timeMs)}ms`);
  }

  // Records a hazard death (count per player this round) for a future scoreboard.
  onPlayerDied(socket: Socket) {
    if (this.phase !== 'IN_PROGRESS') {
      return;
    }
    const playerId = socket.data.playerId as PlayerId;
    if (!this.match.getPlayer(playerId)) {
      return;
    }
    const next = (this.deathsByPlayer.get(playerId) ?? 0) + 1;
    this.deathsByPlayer.set(playerId, next);
    console.log(`[death] ${playerId} died (round deaths: ${next})`);
  }

  destroy() {
    this.clearTimers();
  }

  // ---------------- Transitions ---------------- \\

  private toPreMatch() {
    this.phase = 'PRE_MATCH';
    this.resetRoundRuntime();
    this.broadcastStatus();
  }

  private async toCountdown() {
    this.clearTimers();
    this.match.markFirstRoundStarted();
    this.match.setAllReady(false);

    const selection = this.match.getLevelSelection();
    if (!selection) {
      console.error('[MatchStateMachine.toCountdown] No level selected');
      this.toPreMatch();
      return;
    }

    let level: LevelDefinition | null = this.cachedLevel?.id === selection.id ? this.cachedLevel.def : null;
    if (!level) {
      try {
        level = await loadLevelDef(selection.id);
        this.cachedLevel = { id: selection.id, def: level };
      } catch (err) {
        console.error('[MatchStateMachine.toCountdown] Failed to load level', err);
      }
    }
    if (!level) {
      this.toPreMatch();
      return;
    }

    this.resetRoundRuntime();
    this.phase = 'COUNTDOWN';

    const payload: RoundStartingPayload = { level, spawns: this.match.assignSpawns(level) };
    this.broadcast('round_starting', payload);
    this.broadcastStatus();

    // Wait for clients to build the level before counting down, so the 3-2-1 is
    // never eaten by scene-boot work. Falls back to a timeout if a client is slow.
    this.beginRoundReadyGate();
  }

  /** Starts the round-ready window: countdown begins when all are ready or on timeout. */
  private beginRoundReadyGate() {
    this.readyPlayerIds.clear();
    this.roundCountdownStarted = false;
    if (this.roundReadyTimeoutHandle) {
      clearTimeout(this.roundReadyTimeoutHandle);
    }
    this.roundReadyTimeoutHandle = setTimeout(() => {
      this.roundReadyTimeoutHandle = null;
      this.startCountdown();
    }, ROUND_READY_TIMEOUT_MS);
  }

  private maybeStartCountdownIfAllReady() {
    if (this.phase !== 'COUNTDOWN' || this.roundCountdownStarted) {
      return;
    }
    const total = this.match.size();
    if (total > 0 && this.readyPlayerIds.size >= total) {
      this.startCountdown();
    }
  }

  private startCountdown() {
    // Guard against the all-ready path and the timeout fallback both firing.
    if (this.phase !== 'COUNTDOWN' || this.roundCountdownStarted) {
      return;
    }
    this.roundCountdownStarted = true;
    if (this.roundReadyTimeoutHandle) {
      clearTimeout(this.roundReadyTimeoutHandle);
      this.roundReadyTimeoutHandle = null;
    }

    let secondsLeft = COUNTDOWN_SECONDS;
    const tick = () => {
      if (secondsLeft <= 0) {
        this.toInProgress();
        return;
      }
      this.broadcast('countdown', { secondsLeft } as MatchCountdown);
      secondsLeft--;
      this.countdownHandle = setTimeout(tick, 1000);
    };
    tick();
  }

  private toInProgress() {
    this.countdownHandle = null;
    this.phase = 'IN_PROGRESS';
    this.roundStartAtMs = Date.now();
    this.broadcastStatus();
  }

  private endRound(reason: RoundEndReason) {
    if (this.phase !== 'IN_PROGRESS') {
      return;
    }
    if (this.finishTimeoutHandle) {
      clearTimeout(this.finishTimeoutHandle);
      this.finishTimeoutHandle = null;
    }

    const { roundResults, winners } = this.match.computeRoundResults(this.finishedPlayerIds, this.finishTimesMs);

    if (winners.length > 0 && this.match.getScoreGoal() !== 'NEVER') {
      this.match.recordWins(winners);
      this.phase = 'POST_MATCH';
      const matchResults = this.match.buildMatchResults(roundResults, winners);
      if (matchResults) {
        this.broadcast('match_results', matchResults);
      }
      this.broadcastStatus();
      this.resetRoundRuntime();
      return;
    }

    this.phase = 'POST_ROUND';
    const update: RoundResultsUpdate = {
      reason,
      firstFinisherAtMs: this.firstFinisherAtMs,
      roundEndedAtMs: Date.now(),
      scoreGoal: this.match.getScoreGoal(),
      winners,
      players: roundResults,
    };
    this.broadcast('round_results', update);
    this.broadcastStatus();
    this.resetRoundRuntime();
  }

  // ---------------- Helpers ---------------- \\

  private maybeEndRoundIfAllFinished() {
    const total = this.match.size();
    if (total > 0 && this.finishedPlayerIds.length >= total) {
      this.endRound('all_finished');
    }
  }

  private broadcastStatus() {
    this.broadcast('match_status', this.match.buildStatus(this.phase));
  }

  private clearTimers() {
    if (this.finishTimeoutHandle) {
      clearTimeout(this.finishTimeoutHandle);
      this.finishTimeoutHandle = null;
    }
    if (this.countdownHandle) {
      clearTimeout(this.countdownHandle);
      this.countdownHandle = null;
    }
    if (this.roundReadyTimeoutHandle) {
      clearTimeout(this.roundReadyTimeoutHandle);
      this.roundReadyTimeoutHandle = null;
    }
  }

  private resetRoundRuntime() {
    this.finishedPlayerIds = [];
    this.finishTimesMs.clear();
    this.checkpointTimesMs.clear();
    this.deathsByPlayer.clear();
    this.firstFinisherAtMs = null;
    this.roundStartAtMs = null;
    if (this.finishTimeoutHandle) {
      clearTimeout(this.finishTimeoutHandle);
      this.finishTimeoutHandle = null;
    }
  }

  private parsePlayerStateUpdate(data: unknown): PlayerStateUpdate | null {
    if (!data || typeof data !== 'object') {
      return null;
    }
    const c = data as Partial<PlayerStateUpdate>;
    if (
      !this.isFiniteNumber(c.seq) ||
      !this.isFiniteNumber(c.tMs) ||
      !this.isFiniteNumber(c.x) ||
      !this.isFiniteNumber(c.y) ||
      !this.isFiniteNumber(c.angle) ||
      !this.isFiniteNumber(c.xVel) ||
      !this.isFiniteNumber(c.yVel)
    ) {
      return null;
    }
    const events = this.isFiniteNumber(c.events) ? c.events : 0;
    return { seq: c.seq, tMs: c.tMs, x: c.x, y: c.y, angle: c.angle, xVel: c.xVel, yVel: c.yVel, events };
  }

  private isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }
}
