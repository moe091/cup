import { Socket } from 'socket.io';
import type {
  MatchPhase,
  MatchCountdown,
  TurnTickPayload,
  RoundStartPayload,
  StartingGuessResult,
  OpponentStartingGuessUpdate,
  GuessResult,
  OpponentGuessUpdate,
  BoardClaimedUpdate,
  GuessRejectedPayload,
  UpdateSettingsPayload,
} from '@cup/spellduel-shared';
import { Match, asPlayerId, asSocketId } from './match.js';
import type { PlayerId, SocketId } from './match.js';
import { checkGuess } from './wordChecker.js';
import { isValidGuess, pickRandomWords } from './wordList.js';

type Broadcast = (event: string, payload: unknown) => void;
type BroadcastExcept = (socketId: string, event: string, payload: unknown) => void;

const COUNTDOWN_SECONDS = 3;

export class MatchStateMachine {
  private match: Match;
  private phase: MatchPhase = 'PRE_MATCH';
  private currentTurn = 0;
  private turnTimerHandle: ReturnType<typeof setTimeout> | null = null;
  private countdownHandle: ReturnType<typeof setTimeout> | null = null;

  constructor(
    public readonly matchId: string,
    private readonly broadcast: Broadcast,
    private readonly broadcastExcept: BroadcastExcept,
    private readonly onEnd: () => void,
  ) {
    this.match = new Match(matchId);
  }

  getPhase(): MatchPhase {
    return this.phase;
  }

  isEmpty(): boolean {
    return this.match.isEmpty();
  }

  destroy() {
    this.clearTimers();
  }

  // ---- Connection lifecycle ---- //

  onJoin(socket: Socket) {
    const playerId = asPlayerId(socket.id);
    const displayName = socket.data.displayName as string;
    const role = socket.data.role as 'creator' | 'player';

    this.match.addPlayer(playerId, asSocketId(socket.id), displayName, role);
    socket.emit('match_joined', { role, displayName });
    this.broadcastStatus();
  }

  onLeave(socket: Socket) {
    const playerId = socket.data.playerId as PlayerId | undefined;
    if (!playerId) return;

    if (this.match.isLeader(playerId)) {
      this.clearTimers();
      this.broadcast('host_left', {});
      this.onEnd();
      return;
    }

    this.match.removePlayer(playerId);

    if (this.match.isEmpty()) {
      this.clearTimers();
      this.onEnd();
      return;
    }

    // If this player leaving completes the turn or closes all boards, react.
    if (this.phase === 'IN_PROGRESS') {
      this.maybeEndTurnEarly();
      this.maybeEndRound();
    }

    this.broadcastStatus();
  }

  // ---- Lobby events ---- //

  onSetReady(socket: Socket, data: unknown) {
    if (this.phase !== 'PRE_MATCH') return;
    const playerId = socket.data.playerId as PlayerId;
    if (this.match.isLeader(playerId)) return;
    const ready = typeof data === 'object' && data !== null && (data as { ready?: unknown }).ready === true;
    this.match.setReady(playerId, ready);
    this.broadcastStatus();
  }

  onUpdateSettings(socket: Socket, data: unknown) {
    const playerId = socket.data.playerId as PlayerId;
    if (this.phase !== 'PRE_MATCH' || !this.match.isLeader(playerId) || this.match.isSettingsLocked()) return;
    if (!data || typeof data !== 'object') return;

    const raw = data as UpdateSettingsPayload;
    const patch: Partial<{ boardCount: 3 | 5; rounds: 1 | 3 | 5 | 10; turnDurationSec: 0 | 30 | 60 | 90 }> = {};
    if (Match.isValidBoardCount(raw.boardCount)) patch.boardCount = raw.boardCount;
    if (Match.isValidRoundCount(raw.rounds)) patch.rounds = raw.rounds;
    if (Match.isValidTurnDuration(raw.turnDurationSec)) patch.turnDurationSec = raw.turnDurationSec;

    this.match.updateSettings(patch);
    this.broadcastStatus();
  }

  onStartMatch(socket: Socket) {
    const playerId = socket.data.playerId as PlayerId;
    if (this.phase !== 'PRE_MATCH' || !this.match.isLeader(playerId)) return;
    if (!this.match.allNonLeadersReady()) return;
    this.toCountdown();
  }

  onNextRound(socket: Socket) {
    const playerId = socket.data.playerId as PlayerId;
    if (this.phase !== 'POST_ROUND' || !this.match.isLeader(playerId)) return;
    this.toCountdown();
  }

  onNewMatch(socket: Socket) {
    const playerId = socket.data.playerId as PlayerId;
    if (this.phase !== 'POST_MATCH' || !this.match.isLeader(playerId)) return;
    this.match.resetForNewMatch();
    this.toPreMatch();
  }

  // ---- Gameplay events ---- //

  onSubmitStartingGuess(socket: Socket, data: unknown) {
    if (this.phase !== 'IN_PROGRESS' || this.currentTurn !== 1) {
      console.log(`[SpellDuel ${this.matchId}] submit_starting_guess ignored: phase=${this.phase} turn=${this.currentTurn}`);
      return;
    }
    const playerId = socket.data.playerId as PlayerId;

    const word = this.extractWord(data);
    if (!word) {
      console.log(`[SpellDuel ${this.matchId}] submit_starting_guess rejected: bad_format data=${JSON.stringify(data)}`);
      const rejected: GuessRejectedPayload = { boardIndex: -1, reason: 'invalid_word' };
      socket.emit('guess_rejected', rejected);
      return;
    }

    if (this.match.hasSubmittedThisTurn(playerId)) {
      console.log(`[SpellDuel ${this.matchId}] submit_starting_guess rejected: already_guessed_this_turn player=${playerId}`);
      const rejected: GuessRejectedPayload = { boardIndex: -1, reason: 'already_guessed_this_turn' };
      socket.emit('guess_rejected', rejected);
      return;
    }

    if (!isValidGuess(word)) {
      console.log(`[SpellDuel ${this.matchId}] submit_starting_guess rejected: invalid_word "${word}"`);
      const rejected: GuessRejectedPayload = { boardIndex: -1, reason: 'invalid_word' };
      socket.emit('guess_rejected', rejected);
      return;
    }
    console.log(`[SpellDuel ${this.matchId}] submit_starting_guess accepted: "${word}" turn=${this.currentTurn}`);

    // Apply the guess to every board this player still has access to.
    const settings = this.match.getSettings();
    const boardResults: StartingGuessResult['boardResults'] = [];
    const opponentBoardResults: OpponentStartingGuessUpdate['boardResults'] = [];

    for (let boardIndex = 0; boardIndex < settings.boardCount; boardIndex++) {
      if (!this.match.isBoardEligible(playerId, boardIndex)) {
        // Include a placeholder row of 'absent' for boards already closed.
        continue;
      }

      const answer = this.match.getBoardWord(boardIndex);
      const result = checkGuess(word, answer);
      const solved = result.every((r) => r.state === 'correct');

      const pbs = this.match.recordGuess(playerId, boardIndex, solved);

      let pointsEarned: number | undefined;
      if (solved) {
        const pts = Match.computePoints(pbs.guessCount);
        const claimed = this.match.claimBoard(playerId, boardIndex, pts);
        if (claimed) {
          pointsEarned = pts;
          const claimedUpdate: BoardClaimedUpdate = {
            boardIndex,
            playerId,
            displayName: this.match.getPlayer(playerId)!.displayName,
            word: answer,
            guessCount: pbs.guessCount,
            pointsEarned: pts,
          };
          this.broadcast('board_claimed', claimedUpdate);
        }
      }

      boardResults.push({ boardIndex, result, solved, pointsEarned });
      opponentBoardResults.push({ boardIndex, result });
    }

    this.match.markSubmitted(playerId);

    const guessResult: StartingGuessResult = { boardResults };
    socket.emit('starting_guess_result', guessResult);

    const opponentUpdate: OpponentStartingGuessUpdate = { playerId, boardResults: opponentBoardResults };
    this.broadcastExcept(socket.id, 'opponent_starting_guess', opponentUpdate);

    this.maybeEndTurnEarly();
    this.maybeEndRound();
  }

  onSubmitGuess(socket: Socket, data: unknown) {
    if (this.phase !== 'IN_PROGRESS' || this.currentTurn < 2) {
      console.log(`[SpellDuel ${this.matchId}] submit_guess ignored: phase=${this.phase} turn=${this.currentTurn}`);
      return;
    }
    const playerId = socket.data.playerId as PlayerId;

    if (this.match.hasSubmittedThisTurn(playerId)) {
      console.log(`[SpellDuel ${this.matchId}] submit_guess rejected: already_guessed_this_turn turn=${this.currentTurn}`);
      const rejected: GuessRejectedPayload = { boardIndex: -1, reason: 'already_guessed_this_turn' };
      socket.emit('guess_rejected', rejected);
      return;
    }

    const parsed = this.parseGuessSubmission(data);
    if (!parsed) {
      console.log(`[SpellDuel ${this.matchId}] submit_guess rejected: parse_failed data=${JSON.stringify(data)} turn=${this.currentTurn}`);
      const rejected: GuessRejectedPayload = { boardIndex: -1, reason: 'invalid_word' };
      socket.emit('guess_rejected', rejected);
      return;
    }

    const { word, boardIndex } = parsed;

    if (!this.match.isBoardEligible(playerId, boardIndex)) {
      console.log(`[SpellDuel ${this.matchId}] submit_guess rejected: board_not_active board=${boardIndex} turn=${this.currentTurn}`);
      const rejected: GuessRejectedPayload = { boardIndex, reason: 'board_not_active' };
      socket.emit('guess_rejected', rejected);
      return;
    }

    if (!isValidGuess(word)) {
      console.log(`[SpellDuel ${this.matchId}] submit_guess rejected: invalid_word "${word}" board=${boardIndex} turn=${this.currentTurn}`);
      const rejected: GuessRejectedPayload = { boardIndex, reason: 'invalid_word' };
      socket.emit('guess_rejected', rejected);
      return;
    }

    console.log(`[SpellDuel ${this.matchId}] submit_guess accepted: "${word}" board=${boardIndex} turn=${this.currentTurn}`);

    const answer = this.match.getBoardWord(boardIndex);
    const result = checkGuess(word, answer);
    const solved = result.every((r) => r.state === 'correct');

    const pbs = this.match.recordGuess(playerId, boardIndex, solved);
    this.match.markSubmitted(playerId);

    let pointsEarned: number | undefined;
    if (solved) {
      const pts = Match.computePoints(pbs.guessCount);
      const claimed = this.match.claimBoard(playerId, boardIndex, pts);
      if (claimed) {
        pointsEarned = pts;
        const claimedUpdate: BoardClaimedUpdate = {
          boardIndex,
          playerId,
          displayName: this.match.getPlayer(playerId)!.displayName,
          word: answer,
          guessCount: pbs.guessCount,
          pointsEarned: pts,
        };
        this.broadcast('board_claimed', claimedUpdate);
      }
    }

    const exhausted = !solved && pbs.guessCount >= this.match.getMaxGuesses();
    const guessResult: GuessResult = {
      boardIndex,
      result,
      guessCount: pbs.guessCount,
      solved,
      pointsEarned,
      revealedWord: exhausted ? this.match.getBoardWord(boardIndex) : undefined,
    };
    socket.emit('guess_result', guessResult);

    const opponentUpdate: OpponentGuessUpdate = { playerId, boardIndex, result };
    this.broadcastExcept(socket.id, 'opponent_guess', opponentUpdate);

    console.log(`[SpellDuel ${this.matchId}] allEligibleSubmitted=${this.match.allEligiblePlayersSubmitted()} after turn=${this.currentTurn} guess`);
    this.maybeEndTurnEarly();
    this.maybeEndRound();
  }

  // ---- Phase transitions ---- //

  private toPreMatch() {
    this.phase = 'PRE_MATCH';
    this.currentTurn = 0;
    this.broadcastStatus();
  }

  private toCountdown() {
    this.clearTimers();
    this.phase = 'COUNTDOWN';
    this.broadcastStatus();

    const settings = this.match.getSettings();
    const words = pickRandomWords(settings.boardCount);
    this.match.startRound(words);

    const roundStartPayload: RoundStartPayload = {
      roundNumber: this.match.getRoundsPlayed() + 1,
      totalRounds: settings.rounds,
      boardCount: settings.boardCount,
      turnDurationMs: settings.turnDurationSec * 1000,
    };
    this.broadcast('round_start', roundStartPayload);

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
    this.broadcastStatus();
    this.startTurn(1);
  }

  private startTurn(turnNumber: number) {
    console.log(`[SpellDuel ${this.matchId}] Starting turn ${turnNumber}`);
    this.currentTurn = turnNumber;
    this.match.resetTurn();

    const { turnDurationSec } = this.match.getSettings();
    const turnDurationMs = turnDurationSec * 1000;

    const tick: TurnTickPayload = { turnNumber, turnDurationMs };
    this.broadcast('turn_tick', tick);

    if (turnDurationSec > 0) {
      this.turnTimerHandle = setTimeout(() => {
        this.turnTimerHandle = null;
        this.onTurnExpired();
      }, turnDurationMs);
    }
    // When turnDurationSec === 0 (unlimited), there is no turn timer — turns end only
    // when all eligible players have submitted or all boards are closed.
  }

  private onTurnExpired() {
    console.log(`[SpellDuel ${this.matchId}] Turn ${this.currentTurn} expired`);
    if (this.phase !== 'IN_PROGRESS') return;
    // Players who didn't submit simply miss this turn; no special action needed.
    if (this.maybeEndRound()) return;
    this.startTurn(this.currentTurn + 1);
  }

  private maybeEndTurnEarly() {
    if (this.phase !== 'IN_PROGRESS') return;
    if (!this.match.allEligiblePlayersSubmitted()) return;
    // Cancel the running timer and immediately start the next turn (or end round).
    if (this.turnTimerHandle !== null) {
      clearTimeout(this.turnTimerHandle);
      this.turnTimerHandle = null;
    }
    if (this.maybeEndRound()) return;
    this.startTurn(this.currentTurn + 1);
  }

  /** Returns true if the round ended. */
  private maybeEndRound(): boolean {
    if (this.phase !== 'IN_PROGRESS') return false;
    if (!this.match.allBoardsClosed()) return false;
    this.endRound();
    return true;
  }

  private endRound() {
    this.clearTimers();
    const { roundResults, isMatchOver } = this.match.finaliseRound();
    this.broadcast('round_results', roundResults);

    if (isMatchOver) {
      this.phase = 'POST_MATCH';
      this.broadcast('match_results', this.match.buildMatchResults());
    } else {
      this.phase = 'POST_ROUND';
    }
    this.broadcastStatus();
  }

  // ---- Helpers ---- //

  private broadcastStatus() {
    this.broadcast('match_status', this.match.buildStatus(this.phase));
  }

  private clearTimers() {
    if (this.turnTimerHandle !== null) {
      clearTimeout(this.turnTimerHandle);
      this.turnTimerHandle = null;
    }
    if (this.countdownHandle !== null) {
      clearTimeout(this.countdownHandle);
      this.countdownHandle = null;
    }
  }

  private extractWord(data: unknown): string | null {
    if (!data || typeof data !== 'object') return null;
    const word = (data as { word?: unknown }).word;
    if (typeof word !== 'string') return null;
    const trimmed = word.trim().toLowerCase();
    if (trimmed.length !== 5) return null;
    return trimmed;
  }

  private parseGuessSubmission(data: unknown): { word: string; boardIndex: number } | null {
    const word = this.extractWord(data);
    if (!word) return null;
    const boardIndex = (data as { boardIndex?: unknown }).boardIndex;
    if (typeof boardIndex !== 'number' || !Number.isFinite(boardIndex) || boardIndex < 0) return null;
    return { word, boardIndex };
  }
}
