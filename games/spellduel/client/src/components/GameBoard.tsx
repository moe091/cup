import type { PlayerStatus, LetterResult } from '@cup/spellduel-shared';
import type { ClientBoardState, OpponentBoardRows } from '../SpellDuelApp.js';
import { BoardRow } from './BoardRow.js';

type Props = {
  boardIndex: number;
  board: ClientBoardState;
  opponents: PlayerStatus[];
  opponentRows: Map<string, OpponentBoardRows>;
  maxGuesses: number;
  isSelected: boolean;
  pendingWord?: string; // letters currently being typed into this board's next row
  onClick: () => void;
};

export function GameBoard({ boardIndex, board, opponents, opponentRows, maxGuesses, isSelected, pendingWord, onClick }: Props) {
  const isClaimed = board.status === 'claimed_by_other' || board.status === 'solved_by_me';
  const isExhausted = board.status === 'exhausted';
  const isActive = board.status === 'active';

  const borderColor = isSelected ? 'var(--accent)' : isClaimed ? '#538d4e' : isExhausted ? '#3a3a3c' : 'var(--line)';

  return (
    <div
      onClick={isActive ? onClick : undefined}
      style={{
        border: `2px solid ${borderColor}`,
        borderRadius: '12px',
        padding: '12px',
        background: 'var(--panel)',
        cursor: isActive ? 'pointer' : 'default',
        position: 'relative',
        transition: 'border-color 0.15s',
        minWidth: '220px',
        flexShrink: 0,
      }}
    >
      {/* Board header */}
      <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
        Board {boardIndex + 1}
        {isSelected && <span style={{ color: 'var(--accent)', marginLeft: '6px' }}>← selected</span>}
      </div>

      {/* Opponent mini-rows — one row-group per opponent */}
      {opponents.map((opp) => {
        const rows: LetterResult[][] = opponentRows.get(opp.playerId)?.[boardIndex] ?? [];
        return (
          <div key={opp.playerId} style={{ marginBottom: '6px' }}>
            <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '2px' }}>{opp.displayName}</div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '2px' }}>
              {rows.map((row, i) => (
                <BoardRow key={i} result={row} showLetters={false} />
              ))}
              {rows.length === 0 && (
                <div style={{ display: 'flex', gap: '2px' }}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} style={{ width: 14, height: 14, border: '1px solid var(--line)', borderRadius: '2px' }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Separator */}
      {opponents.length > 0 && <div style={{ borderTop: '1px solid var(--line)', margin: '8px 0' }} />}

      {/* My guess rows */}
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '4px' }}>
        {Array.from({ length: maxGuesses }, (_, i) => {
          const isCurrentRow = isActive && i === board.guessCount;
          return (
            <BoardRow
              key={i}
              result={board.rows[i]}
              showLetters={true}
              isCurrent={isCurrentRow && pendingWord === undefined}
              pendingLetters={isCurrentRow && pendingWord !== undefined ? pendingWord : undefined}
            />
          );
        })}
      </div>

      {/* Claimed / exhausted overlay */}
      {isClaimed && board.claim && (
        <div style={overlayStyle}>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>
            {board.status === 'solved_by_me' ? 'You got it!' : `Claimed by ${board.claim.displayName}`}
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '0.2em', color: '#fff' }}>
            {board.claim.word}
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>
            {board.claim.guessCount} {board.claim.guessCount === 1 ? 'guess' : 'guesses'} · +{board.claim.pointsEarned.toFixed(2)} pts
          </div>
        </div>
      )}
      {isExhausted && (
        <div style={{ ...overlayStyle, background: 'rgba(20,20,20,0.82)' }}>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Board locked — {maxGuesses}/{maxGuesses} guesses used</div>
          {board.revealedWord && (
            <div style={{ marginTop: '8px', textAlign: 'center' as const }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginBottom: '4px' }}>The word was</div>
              <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '0.2em', color: '#fff' }}>
                {board.revealedWord.toUpperCase()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: '10px',
  background: 'rgba(10,25,10,0.88)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: '16px',
};
