import { useState, useRef, useEffect } from 'react';
import type { ClientBoardState } from '../SpellDuelApp.js';

type Props = {
  boards: ClientBoardState[];
  selectedBoardIndex: number;
  submitted: boolean;
  externalError?: string | null;
  onSubmit: (word: string, boardIndex: number) => void;
};

export function TurnInput({ boards, selectedBoardIndex, submitted, externalError, onSubmit }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!submitted) {
      setValue('');
      setError('');
      inputRef.current?.focus();
    }
  }, [submitted]);

  const selectedBoard = boards[selectedBoardIndex];
  const canGuess = selectedBoard?.status === 'active';

  function handleSubmit() {
    if (!canGuess) {
      setError('Select an active board first.');
      return;
    }
    const word = value.trim().toLowerCase();
    if (word.length !== 5) {
      setError('Word must be exactly 5 letters.');
      return;
    }
    if (!/^[a-z]+$/.test(word)) {
      setError('Letters only.');
      return;
    }
    setError('');
    onSubmit(word, selectedBoardIndex);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSubmit();
  }

  if (submitted) {
    return (
      <div style={s.root}>
        <p style={s.waiting}>Guess submitted — waiting for others…</p>
      </div>
    );
  }

  return (
    <div style={s.root}>
      <div style={s.label}>
        Guessing on <span style={s.boardLabel}>Board {selectedBoardIndex + 1}</span>
        {!canGuess && <span style={s.inactive}> (board inactive — click another)</span>}
      </div>
      <div style={s.row}>
        <input
          ref={inputRef}
          style={s.input}
          type="text"
          maxLength={5}
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^a-zA-Z]/g, ''))}
          onKeyDown={handleKey}
          placeholder="5-letter word"
          autoComplete="off"
          autoCapitalize="none"
          disabled={!canGuess}
        />
        <button style={canGuess ? s.btn : s.btnDisabled} onClick={handleSubmit} disabled={!canGuess}>
          Submit
        </button>
      </div>
      {(error || externalError) && <p style={s.error}>{error || externalError}</p>}
    </div>
  );
}

const s = {
  root: {
    background: 'var(--panel)',
    border: '1px solid var(--line)',
    borderRadius: '12px',
    padding: '14px 18px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  } as React.CSSProperties,
  label: { fontSize: '13px', color: 'var(--muted)' } as React.CSSProperties,
  boardLabel: { color: 'var(--accent)', fontWeight: 600 } as React.CSSProperties,
  inactive: { color: '#e05c5c' } as React.CSSProperties,
  row: { display: 'flex', gap: '8px' } as React.CSSProperties,
  input: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid var(--line)',
    background: 'var(--panel-strong)',
    color: 'var(--text)',
    fontSize: '16px',
    fontFamily: 'monospace',
    letterSpacing: '0.2em',
    textTransform: 'uppercase' as const,
    outline: 'none',
    width: '130px',
  } as React.CSSProperties,
  btn: {
    padding: '8px 18px', borderRadius: '999px', border: '1px solid var(--accent)',
    background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
  } as React.CSSProperties,
  btnDisabled: {
    padding: '8px 18px', borderRadius: '999px', border: '1px solid var(--line)',
    background: 'transparent', color: 'var(--muted)', fontSize: '14px', cursor: 'not-allowed',
  } as React.CSSProperties,
  waiting: { color: 'var(--muted)', fontSize: '13px', margin: 0 } as React.CSSProperties,
  error: { color: '#e05c5c', fontSize: '12px', margin: 0 } as React.CSSProperties,
} as const;
