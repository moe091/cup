import type {
  BoardCount,
  MatchSettings,
  MatchPhase,
  MatchStatus,
  PlayerStatus,
  RoundCount,
  TurnDurationSec,
  BoardRoundResult,
  PlayerRoundResult,
  RoundResultsPayload,
  PlayerMatchResult,
  MatchResultsPayload,
} from '@cup/spellduel-shared';

export type PlayerId = string & { readonly __brand: 'PlayerId' };
export type SocketId = string & { readonly __brand: 'SocketId' };

export function asPlayerId(s: string): PlayerId {
  return s as PlayerId;
}
export function asSocketId(s: string): SocketId {
  return s as SocketId;
}

type PlayerSession = {
  playerId: PlayerId;
  socketId: SocketId;
  displayName: string;
  role: 'creator' | 'player';
  ready: boolean;
};

// Per-player state for a single board within a round.
export type PlayerBoardState = {
  guessCount: number; // 0–7
  solved: boolean;
};

// Server-side board descriptor for the current round.
export type RoundBoard = {
  boardIndex: number;
  word: string;
  claimedBy: PlayerId | null;
  claimedByDisplayName: string | null;
  claimedAtGuessCount: number | null;
  pointsAwarded: number;
};

const DEFAULT_MAX_GUESSES = 8;
const UNLIMITED_MAX_GUESSES = 6;

/**
 * Pure data container for a single match/lobby.
 * No timers, no I/O, no broadcasts — only state and math.
 * MatchStateMachine reads and mutates this via its public methods.
 */
export class Match {
  private players = new Map<PlayerId, PlayerSession>();
  private totalPointsByPlayer = new Map<PlayerId, number>();
  private settings: MatchSettings = { boardCount: 3, rounds: 1, turnDurationSec: 30 };
  private settingsLocked = false;
  private hasStartedFirstRound = false;
  private roundsPlayed = 0;

  // Set at the start of each round.
  private currentBoards: RoundBoard[] = [];
  // playerId → boardIndex → PlayerBoardState
  private playerBoardStates = new Map<PlayerId, PlayerBoardState[]>();
  // playerId → has submitted a guess this turn
  private submittedThisTurn = new Set<PlayerId>();

  constructor(public readonly matchId: string) {}

  // ---- Player management ---- //

  addPlayer(playerId: PlayerId, socketId: SocketId, displayName: string, role: 'creator' | 'player') {
    this.players.set(playerId, { playerId, socketId, displayName, role, ready: false });
    if (!this.totalPointsByPlayer.has(playerId)) {
      this.totalPointsByPlayer.set(playerId, 0);
    }
  }

  removePlayer(playerId: PlayerId) {
    this.players.delete(playerId);
    this.totalPointsByPlayer.delete(playerId);
    this.playerBoardStates.delete(playerId);
    this.submittedThisTurn.delete(playerId);
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

  // ---- Ready state ---- //

  setReady(playerId: PlayerId, ready: boolean) {
    const p = this.players.get(playerId);
    if (p) p.ready = ready;
  }

  setAllReady(ready: boolean) {
    this.players.forEach((p) => {
      p.ready = ready;
    });
  }

  allNonLeadersReady(): boolean {
    for (const p of this.players.values()) {
      if (p.role !== 'creator' && !p.ready) return false;
    }
    return true;
  }

  // ---- Settings ---- //

  getSettings(): MatchSettings {
    return { ...this.settings };
  }

  isSettingsLocked(): boolean {
    return this.settingsLocked;
  }

  updateSettings(patch: Partial<MatchSettings>) {
    if (this.settingsLocked) return;
    if (patch.boardCount !== undefined) this.settings.boardCount = patch.boardCount;
    if (patch.rounds !== undefined) this.settings.rounds = patch.rounds;
    if (patch.turnDurationSec !== undefined) this.settings.turnDurationSec = patch.turnDurationSec;
  }

  // ---- Round initialisation ---- //

  startRound(words: string[]) {
    if (!this.hasStartedFirstRound) {
      this.hasStartedFirstRound = true;
      this.settingsLocked = true;
    }

    this.currentBoards = words.map((word, boardIndex) => ({
      boardIndex,
      word,
      claimedBy: null,
      claimedByDisplayName: null,
      claimedAtGuessCount: null,
      pointsAwarded: 0,
    }));

    // Initialise per-player board states for all players currently in the match.
    this.playerBoardStates.clear();
    for (const playerId of this.players.keys()) {
      this.playerBoardStates.set(
        playerId,
        words.map(() => ({ guessCount: 0, solved: false })),
      );
    }

    this.submittedThisTurn.clear();
  }

  // ---- Turn tracking ---- //

  resetTurn() {
    this.submittedThisTurn.clear();
  }

  markSubmitted(playerId: PlayerId) {
    this.submittedThisTurn.add(playerId);
  }

  hasSubmittedThisTurn(playerId: PlayerId): boolean {
    return this.submittedThisTurn.has(playerId);
  }

  /** True when every player has either submitted this turn or has no eligible boards left. */
  allEligiblePlayersSubmitted(): boolean {
    for (const playerId of this.players.keys()) {
      if (!this.submittedThisTurn.has(playerId) && this.hasEligibleBoards(playerId)) {
        return false;
      }
    }
    return true;
  }

  // ---- Board eligibility ---- //

  getMaxGuesses(): number {
    return this.settings.turnDurationSec === 0 ? UNLIMITED_MAX_GUESSES : DEFAULT_MAX_GUESSES;
  }

  /** A player may guess on a board if it is unclaimed and they have guesses left on it. */
  isBoardEligible(playerId: PlayerId, boardIndex: number): boolean {
    const board = this.currentBoards[boardIndex];
    if (!board || board.claimedBy !== null) return false;
    const pbs = this.playerBoardStates.get(playerId)?.[boardIndex];
    if (!pbs) return false;
    return pbs.guessCount < this.getMaxGuesses() && !pbs.solved;
  }

  hasEligibleBoards(playerId: PlayerId): boolean {
    return this.currentBoards.some((_, i) => this.isBoardEligible(playerId, i));
  }

  getBoardWord(boardIndex: number): string {
    return this.currentBoards[boardIndex]?.word ?? '';
  }

  /** All boards are globally closed when every board is either claimed or every
   *  player has exhausted their personal guess limit on it. */
  allBoardsClosed(): boolean {
    return this.currentBoards.every((board, i) => {
      if (board.claimedBy !== null) return true;
      for (const playerId of this.players.keys()) {
        if (this.isBoardEligible(playerId, i)) return false;
      }
      return true;
    });
  }

  // ---- Guess recording ---- //

  /** Records a guess on a specific board for a player and returns the updated state. */
  recordGuess(playerId: PlayerId, boardIndex: number, solved: boolean): PlayerBoardState {
    const pbs = this.playerBoardStates.get(playerId)![boardIndex];
    pbs.guessCount += 1;
    if (solved) pbs.solved = true;
    return { ...pbs };
  }

  /** Claims a board for a player (they solved it). Returns false if already claimed. */
  claimBoard(playerId: PlayerId, boardIndex: number, pointsEarned: number): boolean {
    const board = this.currentBoards[boardIndex];
    if (!board || board.claimedBy !== null) return false;

    const player = this.players.get(playerId);
    if (!player) return false;

    const pbs = this.playerBoardStates.get(playerId)![boardIndex];

    board.claimedBy = playerId;
    board.claimedByDisplayName = player.displayName;
    board.claimedAtGuessCount = pbs.guessCount;
    board.pointsAwarded = pointsEarned;

    this.totalPointsByPlayer.set(playerId, (this.totalPointsByPlayer.get(playerId) ?? 0) + pointsEarned);
    return true;
  }

  // ---- Scoring ---- //

  /** Points for solving a board: 1 base + bonus for efficiency. */
  static computePoints(guessCount: number): number {
    if (guessCount === 1) return 2.0;
    if (guessCount === 2) return 1.75;
    if (guessCount === 3) return 1.5;
    if (guessCount === 4) return 1.2;
    return 1.0;
  }

  // ---- Round results ---- //

  finaliseRound(): { roundResults: RoundResultsPayload; isMatchOver: boolean } {
    this.roundsPlayed += 1;

    const boards: BoardRoundResult[] = this.currentBoards.map((b) => ({
      boardIndex: b.boardIndex,
      word: b.word,
      claimedBy: b.claimedBy,
      claimedByDisplayName: b.claimedByDisplayName,
      claimedAtGuessCount: b.claimedAtGuessCount,
      pointsAwarded: b.pointsAwarded,
    }));

    const players: PlayerRoundResult[] = this.getPlayers().map((p) => ({
      playerId: p.playerId,
      displayName: p.displayName,
      roundPoints: boards
        .filter((b) => b.claimedBy === p.playerId)
        .reduce((sum, b) => sum + b.pointsAwarded, 0),
      totalPoints: this.totalPointsByPlayer.get(p.playerId) ?? 0,
    }));

    return {
      roundResults: { roundNumber: this.roundsPlayed, boards, players },
      isMatchOver: this.roundsPlayed >= this.settings.rounds,
    };
  }

  buildMatchResults(): MatchResultsPayload {
    const standings: PlayerMatchResult[] = this.getPlayers()
      .map((p) => ({
        playerId: p.playerId,
        displayName: p.displayName,
        totalPoints: this.totalPointsByPlayer.get(p.playerId) ?? 0,
        rank: 0,
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    // Assign ranks (tied players share the lowest rank among them).
    let rank = 1;
    for (let i = 0; i < standings.length; i++) {
      if (i > 0 && standings[i].totalPoints < standings[i - 1].totalPoints) {
        rank = i + 1;
      }
      standings[i].rank = rank;
    }

    return { players: standings };
  }

  resetForNewMatch() {
    this.totalPointsByPlayer.forEach((_, id) => this.totalPointsByPlayer.set(id, 0));
    this.setAllReady(false);
    this.settingsLocked = false;
    this.hasStartedFirstRound = false;
    this.roundsPlayed = 0;
    this.currentBoards = [];
    this.playerBoardStates.clear();
    this.submittedThisTurn.clear();
  }

  getRoundsPlayed(): number {
    return this.roundsPlayed;
  }

  // ---- Status snapshot ---- //

  buildStatus(phase: MatchPhase): MatchStatus {
    return {
      matchId: this.matchId,
      phase,
      settings: this.getSettings(),
      settingsLocked: this.settingsLocked,
      players: this.getPlayers().map((p) => ({
        playerId: p.playerId,
        displayName: p.displayName,
        ready: p.ready,
        role: p.role,
        totalPoints: this.totalPointsByPlayer.get(p.playerId) ?? 0,
      })),
    };
  }

  // Expose validated setting values for use in the state machine.
  static isValidBoardCount(v: unknown): v is BoardCount {
    return v === 3 || v === 5;
  }
  static isValidRoundCount(v: unknown): v is RoundCount {
    return v === 1 || v === 3 || v === 5 || v === 10;
  }
  static isValidTurnDuration(v: unknown): v is TurnDurationSec {
    return v === 0 || v === 30 || v === 60 || v === 90;
  }
}
