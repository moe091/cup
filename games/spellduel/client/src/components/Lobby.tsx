import type { PlayerStatus, MatchSettings, UpdateSettingsPayload, BoardCount, RoundCount, TurnDurationSec } from '@cup/spellduel-shared';

type Props = {
  players: PlayerStatus[];
  settings: MatchSettings;
  settingsLocked: boolean;
  isLeader: boolean;
  myPlayerId: string;
  onSetReady: (ready: boolean) => void;
  onStartMatch: () => void;
  onUpdateSettings: (patch: UpdateSettingsPayload) => void;
};

const BOARD_COUNT_OPTIONS: BoardCount[] = [3, 5];
const ROUND_OPTIONS: RoundCount[] = [1, 3, 5, 10];
const DURATION_OPTIONS: TurnDurationSec[] = [30, 60, 90, 0];

export function Lobby({ players, settings, settingsLocked, isLeader, myPlayerId, onSetReady, onStartMatch, onUpdateSettings }: Props) {
  const me = players.find((p) => p.playerId === myPlayerId);
  const allNonLeadersReady = players.filter((p) => p.role !== 'creator').every((p) => p.ready);
  const canStart = isLeader && allNonLeadersReady;

  return (
    <div style={s.root}>
      <h2 style={s.title}>SpellDuel — Lobby</h2>

      {/* Match settings */}
      <div style={s.section}>
        <h3 style={s.sectionTitle}>Match Settings</h3>
        <div style={s.settingsGrid}>
          <SettingRow
            label="Boards"
            options={BOARD_COUNT_OPTIONS}
            current={settings.boardCount}
            locked={settingsLocked || !isLeader}
            onChange={(v) => onUpdateSettings({ boardCount: v as BoardCount })}
            format={(v) => String(v)}
          />
          <SettingRow
            label="Rounds"
            options={ROUND_OPTIONS}
            current={settings.rounds}
            locked={settingsLocked || !isLeader}
            onChange={(v) => onUpdateSettings({ rounds: v as RoundCount })}
            format={(v) => String(v)}
          />
          <SettingRow
            label="Seconds per guess"
            options={DURATION_OPTIONS}
            current={settings.turnDurationSec}
            locked={settingsLocked || !isLeader}
            onChange={(v) => onUpdateSettings({ turnDurationSec: v as TurnDurationSec })}
            format={(v) => (v === 0 ? 'Untimed' : `${v}s`)}
          />
        </div>
        {settingsLocked && <p style={s.lockedNote}>Settings locked for this match</p>}
      </div>

      {/* Player list */}
      <div style={s.section}>
        <h3 style={s.sectionTitle}>Players</h3>
        <div style={s.playerList}>
          {players.map((p) => (
            <div key={p.playerId} style={s.playerRow}>
              <span style={s.playerName}>
                {p.displayName}
                {p.role === 'creator' && <span style={s.badge}>host</span>}
                {p.playerId === myPlayerId && <span style={s.badgeYou}>you</span>}
              </span>
              <span style={{ ...s.readyDot, background: p.role === 'creator' || p.ready ? '#538d4e' : '#3a3a3c' }} />
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={s.actions}>
        {isLeader ? (
          <button style={canStart ? s.btnPrimary : s.btnDisabled} onClick={onStartMatch} disabled={!canStart}>
            {allNonLeadersReady || players.length === 1 ? 'Start Match' : 'Waiting for players…'}
          </button>
        ) : (
          <button
            style={me?.ready ? s.btnSecondary : s.btnPrimary}
            onClick={() => onSetReady(!me?.ready)}
          >
            {me?.ready ? 'Not Ready' : 'Ready'}
          </button>
        )}
      </div>
    </div>
  );
}

function SettingRow<T extends number>({
  label,
  options,
  current,
  locked,
  onChange,
  format,
}: {
  label: string;
  options: T[];
  current: T;
  locked: boolean;
  onChange: (v: T) => void;
  format: (v: T) => string;
}) {
  return (
    <div style={s.settingRow}>
      <span style={s.settingLabel}>{label}</span>
      <div style={s.optionGroup}>
        {options.map((v) => (
          <button
            key={v}
            style={v === current ? s.optionActive : locked ? s.optionLocked : s.option}
            onClick={() => !locked && onChange(v)}
            disabled={locked}
          >
            {format(v)}
          </button>
        ))}
      </div>
    </div>
  );
}

const s = {
  root: {
    padding: '24px',
    maxWidth: '560px',
    margin: '0 auto',
    color: 'var(--text)',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  title: { fontSize: '24px', marginBottom: '24px', fontWeight: 700 } as React.CSSProperties,
  section: { marginBottom: '24px' } as React.CSSProperties,
  sectionTitle: { fontSize: '12px', textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--muted)', marginBottom: '12px' } as React.CSSProperties,
  settingsGrid: { display: 'flex', flexDirection: 'column' as const, gap: '10px' } as React.CSSProperties,
  settingRow: { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' as const } as React.CSSProperties,
  settingLabel: { minWidth: '140px', fontSize: '14px', color: 'var(--text)' } as React.CSSProperties,
  optionGroup: { display: 'flex', gap: '6px' } as React.CSSProperties,
  option: {
    padding: '4px 12px', borderRadius: '999px', border: '1px solid var(--line)',
    background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: '13px',
  } as React.CSSProperties,
  optionActive: {
    padding: '4px 12px', borderRadius: '999px', border: '1px solid var(--accent)',
    background: 'var(--accent)', color: '#000', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
  } as React.CSSProperties,
  optionLocked: {
    padding: '4px 12px', borderRadius: '999px', border: '1px solid var(--line)',
    background: 'transparent', color: 'var(--line)', cursor: 'default', fontSize: '13px',
  } as React.CSSProperties,
  lockedNote: { fontSize: '12px', color: 'var(--muted)', marginTop: '8px' } as React.CSSProperties,
  playerList: { display: 'flex', flexDirection: 'column' as const, gap: '8px' } as React.CSSProperties,
  playerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid var(--line)', borderRadius: '8px' } as React.CSSProperties,
  playerName: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' } as React.CSSProperties,
  badge: { fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'var(--panel-strong)', color: 'var(--muted)', letterSpacing: '0.05em' } as React.CSSProperties,
  badgeYou: { fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'var(--accent)', color: '#000', letterSpacing: '0.05em' } as React.CSSProperties,
  readyDot: { width: '10px', height: '10px', borderRadius: '50%' } as React.CSSProperties,
  actions: { display: 'flex', gap: '12px', marginTop: '8px' } as React.CSSProperties,
  btnPrimary: {
    padding: '10px 24px', borderRadius: '999px', border: '1px solid var(--accent)',
    background: 'var(--accent)', color: '#000', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
  } as React.CSSProperties,
  btnSecondary: {
    padding: '10px 24px', borderRadius: '999px', border: '1px solid var(--line)',
    background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: '14px',
  } as React.CSSProperties,
  btnDisabled: {
    padding: '10px 24px', borderRadius: '999px', border: '1px solid var(--line)',
    background: 'transparent', color: 'var(--muted)', cursor: 'not-allowed', fontSize: '14px',
  } as React.CSSProperties,
} as const;
