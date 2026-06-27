import { useState, useRef, useEffect } from 'react';

type Props = {
  onSubmit: (word: string) => void;
  submitted: boolean;
  externalError?: string | null;
};

export function StartingGuessInput({ onSubmit, submitted, externalError }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!submitted) inputRef.current?.focus();
  }, [submitted]);

  function handleSubmit() {
    const word = value.trim().toLowerCase();
    if (word.length !== 5) {
      setError('Word must be exactly 5 letters.');
      return;
    }
    if (!/^[a-z]+$/.test(word)) {
      setError('Letters only, no numbers or symbols.');
      return;
    }
    setError('');
    onSubmit(word);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSubmit();
  }

  if (submitted) {
    return (
      <div style={s.root}>
        <p style={s.banner}>Starting word submitted — waiting for others…</p>
      </div>
    );
  }

  return (
    <div style={s.root}>
      <p style={s.banner}>Enter your starting word (applied to all boards):</p>
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
        />
        <button style={s.btn} onClick={handleSubmit}>
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
    padding: '16px 20px',
    marginBottom: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  } as React.CSSProperties,
  banner: { color: 'var(--text)', fontSize: '14px', margin: 0 } as React.CSSProperties,
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
    padding: '8px 18px',
    borderRadius: '999px',
    border: '1px solid var(--accent)',
    background: 'var(--accent)',
    color: '#000',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
  } as React.CSSProperties,
  error: { color: '#e05c5c', fontSize: '12px', margin: 0 } as React.CSSProperties,
} as const;
