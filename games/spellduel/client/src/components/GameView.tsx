import { useState, useEffect, useRef } from 'react';
import type { PlayerStatus } from '@cup/spellduel-shared';
import type { ClientBoardState, OpponentBoardRows } from '../SpellDuelApp.js';
import { GameBoard } from './GameBoard.js';
import { StartingGuessInput } from './StartingGuessInput.js';
import { Timer } from './Timer.js';

type Props = {
  turnNumber: number;
  turnDurationMs: number;
  maxGuesses: number;
  roundNumber: number;
  totalRounds: number;
  boards: ClientBoardState[];
  opponents: PlayerStatus[];
  opponentRows: Map<string, OpponentBoardRows>;
  guessRejectedCount: number;
  guessRejectedReason: string | null;
  endCountdown: number | null;
  endWinnerName: string | null;
  isMatchEnd: boolean;
  onSubmitStartingGuess: (word: string) => void;
  onSubmitGuess: (word: string, boardIndex: number) => void;
};

function rejectionMessage(reason: string): string {
  if (reason === 'invalid_word') return 'Not in word list.';
  if (reason === 'board_not_active') return 'That board is no longer active.';
  if (reason === 'already_guessed_this_turn') return 'Already guessed this turn.';
  return 'Guess rejected.';
}

export function GameView({
  turnNumber,
  turnDurationMs,
  maxGuesses,
  roundNumber,
  totalRounds,
  boards,
  opponents,
  opponentRows,
  guessRejectedCount,
  guessRejectedReason,
  endCountdown,
  endWinnerName,
  isMatchEnd,
  onSubmitStartingGuess,
  onSubmitGuess,
}: Props) {
  const [selectedBoard, setSelectedBoard] = useState(0);
  const [startingSubmitted, setStartingSubmitted] = useState(false);
  const [inputBlocked, setInputBlocked] = useState(false);
  const [currentInput, setCurrentInput] = useState('');
  const [rejectionError, setRejectionError] = useState<string | null>(null);

  // Stable refs so the keydown handler always sees fresh values without re-registering.
  const selectedBoardRef = useRef(selectedBoard);
  selectedBoardRef.current = selectedBoard;
  const inputBlockedRef = useRef(inputBlocked);
  inputBlockedRef.current = inputBlocked;
  const currentInputRef = useRef(currentInput);
  currentInputRef.current = currentInput;
  const boardsRef = useRef(boards);
  boardsRef.current = boards;
  const onSubmitGuessRef = useRef(onSubmitGuess);
  onSubmitGuessRef.current = onSubmitGuess;

  // Reset submission state at the start of each new turn.
  useEffect(() => {
    setInputBlocked(false);
    setCurrentInput('');
    if (turnNumber > 1) setStartingSubmitted(false);
    setRejectionError(null);
  }, [turnNumber]);

  // When the server rejects a guess, unblock input and show why.
  useEffect(() => {
    if (guessRejectedCount === 0) return;
    setInputBlocked(false);
    setCurrentInput('');
    setStartingSubmitted(false);
    setRejectionError(guessRejectedReason ? rejectionMessage(guessRejectedReason) : 'Guess rejected.');
  }, [guessRejectedCount, guessRejectedReason]);

  // Auto-select the first active board when boards change.
  useEffect(() => {
    if (boards[selectedBoard]?.status !== 'active') {
      const firstActive = boards.findIndex((b) => b.status === 'active');
      if (firstActive >= 0) setSelectedBoard(firstActive);
    }
  }, [boards, selectedBoard]);

  // Global keyboard handler — letters go into the selected board's next row.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't steal keystrokes from native input/textarea elements (e.g. StartingGuessInput).
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (inputBlockedRef.current) return;
      const board = boardsRef.current[selectedBoardRef.current];
      if (!board || board.status !== 'active') return;

      if (e.key === 'Backspace') {
        e.preventDefault();
        setCurrentInput((prev) => prev.slice(0, -1));
        setRejectionError(null);
      } else if (e.key === 'Enter') {
        const word = currentInputRef.current;
        if (word.length === 5) {
          setInputBlocked(true);
          setCurrentInput('');
          setRejectionError(null);
          onSubmitGuessRef.current(word, selectedBoardRef.current);
        }
      } else if (/^[a-zA-Z]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setCurrentInput((prev) => (prev.length < 5 ? prev + e.key.toLowerCase() : prev));
        setRejectionError(null);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  // All mutable values are read via refs; [] is intentional so the listener registers once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleStartingGuess(word: string) {
    setStartingSubmitted(true);
    onSubmitStartingGuess(word);
  }

  function handleBoardSubmit() {
    const word = currentInput;
    if (word.length !== 5) return;
    setInputBlocked(true);
    setCurrentInput('');
    setRejectionError(null);
    onSubmitGuess(word, selectedBoard);
  }

  const isStartingTurn = turnNumber === 1;
  const isEnding = endCountdown !== null;
  const hasEligibleBoards = boards.some((b) => b.status === 'active');
  const selectedBoardState = boards[selectedBoard];
  const canSubmit = !inputBlocked && selectedBoardState?.status === 'active' && currentInput.length === 5;

  return (
    <div style={s.root}>
      {/* End-of-round / end-of-match banner */}
      {isEnding && endWinnerName && (
        <div style={s.endBanner}>
          <span style={s.endBannerTitle}>
            {endWinnerName} {isMatchEnd ? 'wins the match!' : 'wins the round!'}
          </span>
          <span style={s.endBannerCountdown}>Moving on in {endCountdown}s…</span>
        </div>
      )}

      {/* Header */}
      {!isEnding && (
        <div style={s.header}>
          <span style={s.roundInfo}>Round {roundNumber} / {totalRounds}</span>
          <span style={s.turnInfo}>Turn {turnNumber}</span>
        </div>
      )}

      {/* Timer */}
      {!isEnding && (
        <div style={s.timerWrap}>
          {turnDurationMs === 0 ? (
            <div style={s.unlimitedTimer}>Untimed</div>
          ) : (
            <Timer turnNumber={turnNumber} turnDurationMs={turnDurationMs} />
          )}
        </div>
      )}

      {/* Starting guess input (turn 1 only) */}
      {isStartingTurn && !isEnding && (
        <StartingGuessInput
          onSubmit={handleStartingGuess}
          submitted={startingSubmitted}
          externalError={rejectionError}
        />
      )}

      {/* Board grid */}
      <div style={s.boardGrid}>
        {boards.map((board, i) => (
          <GameBoard
            key={i}
            boardIndex={i}
            board={board}
            opponents={opponents}
            opponentRows={opponentRows}
            maxGuesses={maxGuesses}
            isSelected={!isStartingTurn && !isEnding && selectedBoard === i}
            pendingWord={!isStartingTurn && selectedBoard === i && !inputBlocked && currentInput.length > 0 ? currentInput : undefined}
            onClick={() => { if (!isEnding) setSelectedBoard(i); }}
          />
        ))}
      </div>

      {/* Turn 2+ status bar: board selection hint + submit button + error */}
      {!isStartingTurn && !isEnding && (
        <div style={s.statusBar}>
          {hasEligibleBoards ? (
            <>
              <span style={s.statusText}>
                {inputBlocked
                  ? `Waiting for next turn…`
                  : selectedBoardState?.status === 'active'
                    ? `Board ${selectedBoard + 1} — type a word, Enter to submit`
                    : `Click an active board to guess`}
              </span>
              {!inputBlocked && selectedBoardState?.status === 'active' && (
                <button
                  style={canSubmit ? s.submitBtn : s.submitBtnDisabled}
                  onClick={handleBoardSubmit}
                  disabled={!canSubmit}
                >
                  Submit
                </button>
              )}
            </>
          ) : (
            <span style={s.statusText}>All your boards are closed — waiting for round to end…</span>
          )}
          {rejectionError && <span style={s.errorText}>{rejectionError}</span>}
        </div>
      )}
    </div>
  );
}

const s = {
  root: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    fontFamily: 'inherit',
    color: 'var(--text)',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '13px',
    color: 'var(--muted)',
  } as React.CSSProperties,
  roundInfo: {} as React.CSSProperties,
  turnInfo: { fontWeight: 600, color: 'var(--text)' } as React.CSSProperties,
  timerWrap: { position: 'relative' as const, marginBottom: '20px' } as React.CSSProperties,
  unlimitedTimer: { fontSize: '13px', color: 'var(--muted)', textAlign: 'center' as const } as React.CSSProperties,
  boardGrid: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
  } as React.CSSProperties,
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 16px',
    background: 'var(--panel)',
    border: '1px solid var(--line)',
    borderRadius: '10px',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  statusText: {
    fontSize: '13px',
    color: 'var(--muted)',
    flex: 1,
  } as React.CSSProperties,
  errorText: {
    fontSize: '12px',
    color: '#e05c5c',
  } as React.CSSProperties,
  submitBtn: {
    padding: '6px 16px',
    borderRadius: '999px',
    border: '1px solid var(--accent)',
    background: 'var(--accent)',
    color: '#000',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
  } as React.CSSProperties,
  submitBtnDisabled: {
    padding: '6px 16px',
    borderRadius: '999px',
    border: '1px solid var(--line)',
    background: 'transparent',
    color: 'var(--muted)',
    fontSize: '13px',
    cursor: 'not-allowed',
  } as React.CSSProperties,
  endBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    background: 'var(--panel)',
    border: '1px solid var(--accent)',
    borderRadius: '10px',
    gap: '16px',
  } as React.CSSProperties,
  endBannerTitle: {
    color: 'var(--accent)',
    fontWeight: 700,
    fontSize: '18px',
  } as React.CSSProperties,
  endBannerCountdown: {
    color: 'var(--muted)',
    fontSize: '13px',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
} as const;
