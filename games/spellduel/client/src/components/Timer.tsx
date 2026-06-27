import { useEffect, useState } from 'react';

type Props = {
  turnDurationMs: number;
  turnNumber: number; // resets the timer when it changes
};

export function Timer({ turnDurationMs, turnNumber }: Props) {
  const [msLeft, setMsLeft] = useState(turnDurationMs);

  useEffect(() => {
    setMsLeft(turnDurationMs);
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, turnDurationMs - elapsed);
      setMsLeft(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, [turnNumber, turnDurationMs]);

  const secs = Math.ceil(msLeft / 1000);
  const pct = msLeft / turnDurationMs;
  const urgent = pct < 0.25;

  return (
    <div style={s.root}>
      <div style={{ ...s.bar, background: urgent ? '#b59f3b' : 'var(--accent)', width: `${pct * 100}%` }} />
      <span style={{ ...s.label, color: urgent ? '#b59f3b' : 'var(--accent)' }}>{secs}s</span>
    </div>
  );
}

const s = {
  root: {
    position: 'relative' as const,
    height: '6px',
    background: 'var(--line)',
    borderRadius: '3px',
    overflow: 'hidden',
    width: '100%',
  } as React.CSSProperties,
  bar: {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.1s linear, background 0.3s',
  } as React.CSSProperties,
  label: {
    position: 'absolute' as const,
    right: '4px',
    top: '-18px',
    fontSize: '12px',
    fontWeight: 600,
  } as React.CSSProperties,
} as const;
