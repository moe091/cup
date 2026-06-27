import { useEffect, useReducer, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import type {
  MatchPhase,
  MatchSettings,
  PlayerStatus,
  MatchCountdown,
  RoundStartPayload,
  TurnTickPayload,
  StartingGuessResult,
  OpponentStartingGuessUpdate,
  GuessResult,
  OpponentGuessUpdate,
  BoardClaimedUpdate,
  RoundResultsPayload,
  MatchResultsPayload,
  LetterResult,
  BoardCount,
  GuessRejectedPayload,
} from '@cup/spellduel-shared';
import { Lobby } from './components/Lobby.js';
import { GameView } from './components/GameView.js';
import { RoundResults } from './components/RoundResults.js';
import { MatchResults } from './components/MatchResults.js';

// ---- Client-side board state ---- //

export type BoardStatus = 'active' | 'solved_by_me' | 'claimed_by_other' | 'exhausted';

export type ClientBoardState = {
  rows: Array<LetterResult[] | null>; // 8 slots, null = not yet guessed
  guessCount: number;
  status: BoardStatus;
  revealedWord?: string; // set when the player exhausts their guesses without solving
  claim?: {
    playerId: string;
    displayName: string;
    word: string;
    guessCount: number;
    pointsEarned: number;
  };
};

export type OpponentBoardRows = LetterResult[][][]; // [boardIndex][rowIndex]

// ---- App state + reducer ---- //

type AppState = {
  phase: MatchPhase;
  myPlayerId: string;
  myRole: 'creator' | 'player' | null;
  myDisplayName: string;
  players: PlayerStatus[];
  settings: MatchSettings;
  settingsLocked: boolean;
  countdownSeconds: number | null;
  roundNumber: number;
  totalRounds: number;
  turnNumber: number;
  turnDurationMs: number;
  boards: ClientBoardState[];
  // opponentId → per-board rows
  opponentRows: Map<string, OpponentBoardRows>;
  roundResults: RoundResultsPayload | null;
  matchResults: MatchResultsPayload | null;
  // increments on each rejection so GameView effects can react to each one
  guessRejectedCount: number;
  guessRejectedReason: string | null;
  // 5-second hold on the game board after a round/match ends
  endOfRoundCountdown: number | null;
  pendingPhaseAfterDelay: 'POST_ROUND' | 'POST_MATCH' | null;
  blockingMessage: string | null;
};

type Action =
  | { type: 'MATCH_JOINED'; role: 'creator' | 'player'; displayName: string; myPlayerId: string }
  | { type: 'MATCH_STATUS'; phase: MatchPhase; players: PlayerStatus[]; settings: MatchSettings; settingsLocked: boolean }
  | { type: 'COUNTDOWN'; seconds: number }
  | { type: 'ROUND_START'; payload: RoundStartPayload }
  | { type: 'TURN_TICK'; payload: TurnTickPayload }
  | { type: 'STARTING_GUESS_RESULT'; payload: StartingGuessResult }
  | { type: 'OPPONENT_STARTING_GUESS'; payload: OpponentStartingGuessUpdate }
  | { type: 'GUESS_RESULT'; payload: GuessResult }
  | { type: 'OPPONENT_GUESS'; payload: OpponentGuessUpdate }
  | { type: 'BOARD_CLAIMED'; payload: BoardClaimedUpdate }
  | { type: 'ROUND_RESULTS'; payload: RoundResultsPayload }
  | { type: 'MATCH_RESULTS'; payload: MatchResultsPayload }
  | { type: 'GUESS_REJECTED'; reason: string }
  | { type: 'TICK_END_DELAY' }
  | { type: 'COMMIT_END_DELAY' }
  | { type: 'BLOCKING_MESSAGE'; message: string };

function makeEmptyBoards(count: BoardCount, maxGuesses: number): ClientBoardState[] {
  return Array.from({ length: count }, () => ({
    rows: Array(maxGuesses).fill(null),
    guessCount: 0,
    status: 'active' as BoardStatus,
  }));
}

function initialState(myPlayerId: string): AppState {
  return {
    phase: 'PRE_MATCH',
    myPlayerId,
    myRole: null,
    myDisplayName: '',
    players: [],
    settings: { boardCount: 3, rounds: 1, turnDurationSec: 30 },
    settingsLocked: false,
    countdownSeconds: null,
    roundNumber: 1,
    totalRounds: 1,
    turnNumber: 0,
    turnDurationMs: 30000,
    boards: [],
    opponentRows: new Map(),
    roundResults: null,
    matchResults: null,
    guessRejectedCount: 0,
    guessRejectedReason: null,
    endOfRoundCountdown: null,
    pendingPhaseAfterDelay: null,
    blockingMessage: null,
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'MATCH_JOINED':
      return { ...state, myRole: action.role, myDisplayName: action.displayName };

    case 'MATCH_STATUS': {
      const baseUpdate = { players: action.players, settings: action.settings, settingsLocked: action.settingsLocked };
      // If we're already counting down, don't reset the delay on any new status broadcast.
      if (state.pendingPhaseAfterDelay !== null) return { ...state, ...baseUpdate };
      // Intercept round/match-end transition from IN_PROGRESS — hold for 5 seconds.
      if ((action.phase === 'POST_ROUND' || action.phase === 'POST_MATCH') && state.phase === 'IN_PROGRESS') {
        return { ...state, ...baseUpdate, pendingPhaseAfterDelay: action.phase, endOfRoundCountdown: 5 };
      }
      return { ...state, ...baseUpdate, phase: action.phase };
    }

    case 'COUNTDOWN':
      return { ...state, countdownSeconds: action.seconds };

    case 'ROUND_START': {
      const { roundNumber, totalRounds, boardCount, turnDurationMs } = action.payload;
      const maxGuesses = turnDurationMs === 0 ? 6 : 8;
      return {
        ...state,
        roundNumber,
        totalRounds,
        turnDurationMs,
        boards: makeEmptyBoards(boardCount, maxGuesses),
        opponentRows: new Map(),
        roundResults: null,
        countdownSeconds: null,
      };
    }

    case 'TURN_TICK':
      return {
        ...state,
        turnNumber: action.payload.turnNumber,
        turnDurationMs: action.payload.turnDurationMs,
      };

    case 'STARTING_GUESS_RESULT': {
      const maxGuesses = state.turnDurationMs === 0 ? 5 : 8;
      const boards = state.boards.map((b) => ({ ...b, rows: [...b.rows] }));
      for (const { boardIndex, result, solved, pointsEarned } of action.payload.boardResults) {
        const board = boards[boardIndex];
        if (!board) continue;
        board.rows[board.guessCount] = result;
        board.guessCount += 1;
        if (solved) {
          board.status = 'solved_by_me';
          board.claim = {
            playerId: state.myPlayerId,
            displayName: state.myDisplayName,
            word: result.map((r) => r.letter).join('').toUpperCase(),
            guessCount: board.guessCount,
            pointsEarned: pointsEarned ?? 0,
          };
        } else if (board.guessCount >= maxGuesses) {
          board.status = 'exhausted';
        }
      }
      return { ...state, boards };
    }

    case 'OPPONENT_STARTING_GUESS': {
      const { playerId, boardResults } = action.payload;
      const opponentRows = new Map(state.opponentRows);
      const existingRows = opponentRows.get(playerId) ?? Array.from({ length: state.boards.length }, () => []);
      const updatedRows = existingRows.map((r) => [...r]);
      for (const { boardIndex, result } of boardResults) {
        if (updatedRows[boardIndex]) {
          updatedRows[boardIndex] = [...updatedRows[boardIndex], result];
        }
      }
      opponentRows.set(playerId, updatedRows);
      return { ...state, opponentRows };
    }

    case 'GUESS_RESULT': {
      const { boardIndex, result, guessCount, solved, pointsEarned, revealedWord } = action.payload;
      const maxGuesses = state.turnDurationMs === 0 ? 5 : 8;
      const boards = state.boards.map((b) => ({ ...b, rows: [...b.rows] }));
      const board = boards[boardIndex];
      if (!board) return state;
      board.rows[guessCount - 1] = result;
      board.guessCount = guessCount;
      if (solved) {
        board.status = 'solved_by_me';
        board.claim = {
          playerId: state.myPlayerId,
          displayName: state.myDisplayName,
          word: result.map((r) => r.letter).join('').toUpperCase(),
          guessCount,
          pointsEarned: pointsEarned ?? 0,
        };
      } else if (guessCount >= maxGuesses) {
        board.status = 'exhausted';
        board.revealedWord = revealedWord;
      }
      return { ...state, boards };
    }

    case 'OPPONENT_GUESS': {
      const { playerId, boardIndex, result } = action.payload;
      const opponentRows = new Map(state.opponentRows);
      const existingRows = opponentRows.get(playerId) ?? Array.from({ length: state.boards.length }, () => []);
      const updatedRows = existingRows.map((r) => [...r]);
      if (updatedRows[boardIndex]) {
        updatedRows[boardIndex] = [...updatedRows[boardIndex], result];
      }
      opponentRows.set(playerId, updatedRows);
      return { ...state, opponentRows };
    }

    case 'BOARD_CLAIMED': {
      const { boardIndex, playerId, displayName, word, guessCount, pointsEarned } = action.payload;
      const boards = state.boards.map((b) => ({ ...b, rows: [...b.rows] }));
      const board = boards[boardIndex];
      if (!board) return state;
      // Only mark claimed_by_other if we didn't solve it ourselves.
      if (board.status !== 'solved_by_me') {
        board.status = 'claimed_by_other';
        board.claim = { playerId, displayName, word, guessCount, pointsEarned };
      }
      return { ...state, boards };
    }

    case 'ROUND_RESULTS':
      return { ...state, roundResults: action.payload };

    case 'MATCH_RESULTS':
      return { ...state, matchResults: action.payload };

    case 'GUESS_REJECTED':
      return {
        ...state,
        guessRejectedCount: state.guessRejectedCount + 1,
        guessRejectedReason: action.reason,
      };

    case 'TICK_END_DELAY':
      return {
        ...state,
        endOfRoundCountdown: state.endOfRoundCountdown !== null ? state.endOfRoundCountdown - 1 : null,
      };

    case 'COMMIT_END_DELAY':
      return {
        ...state,
        phase: state.pendingPhaseAfterDelay ?? state.phase,
        pendingPhaseAfterDelay: null,
        endOfRoundCountdown: null,
      };

    case 'BLOCKING_MESSAGE':
      return { ...state, blockingMessage: action.message };

    default:
      return state;
  }
}

// ---- Component ---- //

type Props = { socket: Socket };

export function SpellDuelApp({ socket }: Props) {
  const [state, dispatch] = useReducer(reducer, socket.id ?? '', initialState);

  // Wire up socket events.
  useEffect(() => {
    socket.on('match_joined', (data) =>
      dispatch({ type: 'MATCH_JOINED', role: data.role, displayName: data.displayName, myPlayerId: socket.id ?? '' }),
    );
    socket.on('match_status', (data) =>
      dispatch({
        type: 'MATCH_STATUS',
        phase: data.phase,
        players: data.players,
        settings: data.settings,
        settingsLocked: data.settingsLocked,
      }),
    );
    socket.on('countdown', (data: MatchCountdown) => dispatch({ type: 'COUNTDOWN', seconds: data.secondsLeft }));
    socket.on('round_start', (data: RoundStartPayload) => dispatch({ type: 'ROUND_START', payload: data }));
    socket.on('turn_tick', (data: TurnTickPayload) => dispatch({ type: 'TURN_TICK', payload: data }));
    socket.on('starting_guess_result', (data: StartingGuessResult) =>
      dispatch({ type: 'STARTING_GUESS_RESULT', payload: data }),
    );
    socket.on('opponent_starting_guess', (data: OpponentStartingGuessUpdate) =>
      dispatch({ type: 'OPPONENT_STARTING_GUESS', payload: data }),
    );
    socket.on('guess_result', (data: GuessResult) => dispatch({ type: 'GUESS_RESULT', payload: data }));
    socket.on('opponent_guess', (data: OpponentGuessUpdate) => dispatch({ type: 'OPPONENT_GUESS', payload: data }));
    socket.on('board_claimed', (data: BoardClaimedUpdate) => dispatch({ type: 'BOARD_CLAIMED', payload: data }));
    socket.on('round_results', (data: RoundResultsPayload) => dispatch({ type: 'ROUND_RESULTS', payload: data }));
    socket.on('match_results', (data: MatchResultsPayload) => dispatch({ type: 'MATCH_RESULTS', payload: data }));
    socket.on('guess_rejected', (data: GuessRejectedPayload) =>
      dispatch({ type: 'GUESS_REJECTED', reason: data.reason }),
    );
    socket.on('host_left', () => dispatch({ type: 'BLOCKING_MESSAGE', message: 'The host left the match.' }));
    socket.on('join_error', (data: { reason?: string }) => {
      const message =
        data?.reason === 'match_in_progress' ? 'This match is already in progress.' : 'Unable to join match.';
      dispatch({ type: 'BLOCKING_MESSAGE', message });
    });

    return () => {
      socket.removeAllListeners();
    };
  }, [socket]);

  // Drive the 5-second hold after round/match ends.
  useEffect(() => {
    if (state.endOfRoundCountdown === null) return;
    if (state.endOfRoundCountdown <= 0) {
      dispatch({ type: 'COMMIT_END_DELAY' });
      return;
    }
    const t = setTimeout(() => dispatch({ type: 'TICK_END_DELAY' }), 1000);
    return () => clearTimeout(t);
  }, [state.endOfRoundCountdown]);

  const emit = useCallback((event: string, data?: unknown) => socket.emit(event, data), [socket]);

  const isLeader = state.myRole === 'creator';

  // Compute winner name for the end-of-round banner.
  function getEndBannerWinner(): string {
    if (state.pendingPhaseAfterDelay === 'POST_MATCH' && state.matchResults) {
      return state.matchResults.players.find((p) => p.rank === 1)?.displayName ?? '';
    }
    if (state.roundResults) {
      return state.roundResults.players.reduce(
        (best, p) => (p.roundPoints > best.roundPoints ? p : best),
        state.roundResults.players[0],
      )?.displayName ?? '';
    }
    return '';
  }

  if (state.blockingMessage) {
    return (
      <div style={styles.blocking}>
        <p style={styles.blockingText}>{state.blockingMessage}</p>
      </div>
    );
  }

  if (state.phase === 'PRE_MATCH') {
    return (
      <Lobby
        players={state.players}
        settings={state.settings}
        settingsLocked={state.settingsLocked}
        isLeader={isLeader}
        onSetReady={(ready) => emit('set_ready', { ready })}
        onStartMatch={() => emit('start_match')}
        onUpdateSettings={(patch) => emit('update_settings', patch)}
        myPlayerId={state.myPlayerId}
      />
    );
  }

  if (state.phase === 'COUNTDOWN') {
    return (
      <div style={styles.centeredOverlay}>
        <p style={styles.roundLabel}>Round {state.roundNumber} of {state.totalRounds}</p>
        <p style={styles.countdownText}>
          {state.countdownSeconds !== null ? state.countdownSeconds : '…'}
        </p>
        <p style={styles.hint}>Get ready to enter your starting word…</p>
      </div>
    );
  }

  if (state.phase === 'IN_PROGRESS') {
    const opponents = state.players.filter((p) => p.playerId !== state.myPlayerId);
    const maxGuesses = state.turnDurationMs === 0 ? 5 : 8;
    return (
      <GameView
        turnNumber={state.turnNumber}
        turnDurationMs={state.turnDurationMs}
        maxGuesses={maxGuesses}
        roundNumber={state.roundNumber}
        totalRounds={state.totalRounds}
        boards={state.boards}
        opponents={opponents}
        opponentRows={state.opponentRows}
        guessRejectedCount={state.guessRejectedCount}
        guessRejectedReason={state.guessRejectedReason}
        endCountdown={state.endOfRoundCountdown}
        endWinnerName={state.endOfRoundCountdown !== null ? getEndBannerWinner() : null}
        isMatchEnd={state.pendingPhaseAfterDelay === 'POST_MATCH'}
        onSubmitStartingGuess={(word) => emit('submit_starting_guess', { word })}
        onSubmitGuess={(word, boardIndex) => emit('submit_guess', { word, boardIndex })}
      />
    );
  }

  if (state.phase === 'POST_ROUND' && state.roundResults) {
    return (
      <RoundResults
        results={state.roundResults}
        isLeader={isLeader}
        onNextRound={() => emit('next_round')}
        myPlayerId={state.myPlayerId}
      />
    );
  }

  if (state.phase === 'POST_MATCH' && state.matchResults) {
    return (
      <MatchResults
        results={state.matchResults}
        isLeader={isLeader}
        onNewMatch={() => emit('new_match')}
        myPlayerId={state.myPlayerId}
      />
    );
  }

  return (
    <div style={styles.centeredOverlay}>
      <p style={styles.hint}>Connecting…</p>
    </div>
  );
}

const styles = {
  blocking: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    minHeight: '300px',
  } as React.CSSProperties,
  blockingText: {
    color: 'var(--text)',
    fontSize: '20px',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  centeredOverlay: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    minHeight: '300px',
    padding: '24px',
  } as React.CSSProperties,
  roundLabel: {
    color: 'var(--muted)',
    fontSize: '14px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,
  countdownText: {
    color: 'var(--accent)',
    fontSize: '72px',
    fontWeight: 'bold',
    lineHeight: '1',
  } as React.CSSProperties,
  hint: {
    color: 'var(--muted)',
    fontSize: '14px',
  } as React.CSSProperties,
} as const;
