import type { RoundResultsPayload } from '@cup/spellduel-shared';

type Props = {
  results: RoundResultsPayload;
  isLeader: boolean;
  myPlayerId: string;
  onNextRound: () => void;
};

export function RoundResults({ results, isLeader, myPlayerId, onNextRound }: Props) {
  return (
    <div style={s.root}>
      <h2 style={s.title}>Round {results.roundNumber} Results</h2>

      {/* Board summary */}
      <div style={s.section}>
        <h3 style={s.sectionLabel}>Boards</h3>
        <div style={s.boardList}>
          {results.boards.map((b) => (
            <div key={b.boardIndex} style={s.boardRow}>
              <span style={s.boardWord}>{b.word.toUpperCase()}</span>
              <span style={s.boardClaim}>
                {b.claimedByDisplayName
                  ? `Solved by ${b.claimedByDisplayName} in ${b.claimedAtGuessCount} guess${b.claimedAtGuessCount === 1 ? '' : 'es'} · +${b.pointsAwarded.toFixed(2)} pts`
                  : 'Unsolved'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Player scores */}
      <div style={s.section}>
        <h3 style={s.sectionLabel}>Scores</h3>
        <div style={s.playerList}>
          {[...results.players]
            .sort((a, b) => b.totalPoints - a.totalPoints)
            .map((p, i) => (
              <div key={p.playerId} style={{ ...s.playerRow, background: p.playerId === myPlayerId ? 'var(--panel-strong)' : 'transparent' }}>
                <span style={s.rank}>#{i + 1}</span>
                <span style={s.name}>{p.displayName}{p.playerId === myPlayerId && ' (you)'}</span>
                <span style={s.pts}>
                  +{p.roundPoints.toFixed(2)} this round
                  <span style={s.total}> · {p.totalPoints.toFixed(2)} total</span>
                </span>
              </div>
            ))}
        </div>
      </div>

      {isLeader ? (
        <button style={s.btn} onClick={onNextRound}>Next Round →</button>
      ) : (
        <p style={s.waiting}>Waiting for the host to start the next round…</p>
      )}
    </div>
  );
}

const s = {
  root: { padding: '24px', maxWidth: '560px', margin: '0 auto', color: 'var(--text)', fontFamily: 'inherit' } as React.CSSProperties,
  title: { fontSize: '22px', fontWeight: 700, marginBottom: '20px' } as React.CSSProperties,
  section: { marginBottom: '20px' } as React.CSSProperties,
  sectionLabel: { fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: '10px' } as React.CSSProperties,
  boardList: { display: 'flex', flexDirection: 'column' as const, gap: '8px' } as React.CSSProperties,
  boardRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid var(--line)', borderRadius: '8px' } as React.CSSProperties,
  boardWord: { fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.15em', fontSize: '15px' } as React.CSSProperties,
  boardClaim: { fontSize: '12px', color: 'var(--muted)' } as React.CSSProperties,
  playerList: { display: 'flex', flexDirection: 'column' as const, gap: '6px' } as React.CSSProperties,
  playerRow: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', border: '1px solid var(--line)', borderRadius: '8px' } as React.CSSProperties,
  rank: { fontSize: '14px', fontWeight: 700, minWidth: '24px' } as React.CSSProperties,
  name: { flex: 1, fontSize: '14px' } as React.CSSProperties,
  pts: { fontSize: '13px', color: '#538d4e', fontWeight: 600 } as React.CSSProperties,
  total: { color: 'var(--muted)', fontWeight: 400 } as React.CSSProperties,
  btn: { padding: '10px 24px', borderRadius: '999px', border: '1px solid var(--accent)', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: '14px', cursor: 'pointer' } as React.CSSProperties,
  waiting: { color: 'var(--muted)', fontSize: '14px' } as React.CSSProperties,
} as const;
