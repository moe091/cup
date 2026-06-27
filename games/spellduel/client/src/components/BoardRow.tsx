import type { LetterResult, LetterState } from '@cup/spellduel-shared';

const STATE_COLORS: Record<LetterState, string> = {
  correct: '#538d4e',
  present: '#b59f3b',
  absent: '#3a3a3c',
};

type Props = {
  result: LetterResult[] | null;
  pendingLetters?: string; // letters being typed into this row; if provided, overrides empty-row rendering
  showLetters?: boolean;   // false for opponent mini-rows
  isCurrent?: boolean;     // highlight the row as the next guess slot
};

export function BoardRow({ result, pendingLetters, showLetters = true, isCurrent = false }: Props) {
  const size = showLetters ? 44 : 14;

  return (
    <div style={{ display: 'flex', gap: showLetters ? '4px' : '2px' }}>
      {Array.from({ length: 5 }, (_, i) => {
        const cell = result?.[i];
        const pending = pendingLetters !== undefined ? (pendingLetters[i] ?? '') : undefined;

        let bg: string;
        let border: string;
        let displayLetter: string | null = null;

        if (cell) {
          // Submitted — show color
          bg = STATE_COLORS[cell.state];
          border = 'none';
          displayLetter = cell.letter;
        } else if (pending !== undefined) {
          // Being typed — show letter with filled border, empty slots with accent border
          bg = 'transparent';
          border = pending ? '2px solid var(--text)' : '2px solid var(--accent)';
          displayLetter = pending.toUpperCase() || null;
        } else {
          // Empty slot
          bg = 'transparent';
          border = isCurrent ? '2px solid var(--accent)' : '2px solid var(--line)';
          displayLetter = null;
        }

        return (
          <div
            key={i}
            style={{
              width: size,
              height: size,
              background: bg,
              border,
              borderRadius: showLetters ? '4px' : '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: showLetters ? '18px' : '0',
              fontWeight: 700,
              color: '#fff',
              textTransform: 'uppercase' as const,
              fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
          >
            {showLetters ? displayLetter : null}
          </div>
        );
      })}
    </div>
  );
}
