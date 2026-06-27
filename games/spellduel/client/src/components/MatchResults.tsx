import type { MatchResultsPayload } from '@cup/spellduel-shared';

type Props = {
  results: MatchResultsPayload;
  isLeader: boolean;
  myPlayerId: string;
  onNewMatch: () => void;
};

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32']; // gold, silver, bronze

export function MatchResults({ results, isLeader, myPlayerId, onNewMatch }: Props) {
  return (
    <div style={s.root}>
      <h2 style={s.title}>Match Over!</h2>
      <p style={s.subtitle}>Final Standings</p>

      <div style={s.playerList}>
        {results.players.map((p) => {
          const medalColor = MEDAL_COLORS[p.rank - 1];
          const isMe = p.playerId === myPlayerId;
          return (
            <div key={p.playerId} style={{ ...s.playerRow, background: isMe ? 'var(--panel-strong)' : 'var(--panel)', border: `1px solid ${isMe ? 'var(--accent)' : 'var(--line)'}` }}>
              {/* Medal / rank circle */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: medalColor ?? 'var(--panel-strong)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: medalColor ? '#000' : 'var(--muted)',
                fontWeight: 700, fontSize: '13px', flexShrink: 0,
              }}>
                {p.rank}
              </div>
              <span style={s.name}>
                {p.displayName}
                {isMe && <span style={s.youBadge}>you</span>}
              </span>
              <span style={s.score}>{p.totalPoints.toFixed(2)} pts</span>
            </div>
          );
        })}
      </div>

      <div style={s.actions}>
        {isLeader ? (
          <button style={s.btn} onClick={onNewMatch}>Play Again</button>
        ) : (
          <p style={s.waiting}>Waiting for the host…</p>
        )}
      </div>
    </div>
  );
}

const s = {
  root: { padding: '24px', maxWidth: '480px', margin: '0 auto', color: 'var(--text)', fontFamily: 'inherit' } as React.CSSProperties,
  title: { fontSize: '26px', fontWeight: 700, marginBottom: '4px' } as React.CSSProperties,
  subtitle: { fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' } as React.CSSProperties,
  playerList: { display: 'flex', flexDirection: 'column' as const, gap: '10px', marginBottom: '24px' } as React.CSSProperties,
  playerRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px' } as React.CSSProperties,
  name: { flex: 1, fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' } as React.CSSProperties,
  youBadge: { fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'var(--accent)', color: '#000', fontWeight: 700 } as React.CSSProperties,
  score: { fontSize: '16px', fontWeight: 700, color: '#538d4e' } as React.CSSProperties,
  actions: { display: 'flex', gap: '12px' } as React.CSSProperties,
  btn: { padding: '10px 24px', borderRadius: '999px', border: '1px solid var(--accent)', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: '14px', cursor: 'pointer' } as React.CSSProperties,
  waiting: { color: 'var(--muted)', fontSize: '14px' } as React.CSSProperties,
} as const;
