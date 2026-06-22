import type { LevelDefinition } from './level.js';

export type MatchJoinInfo = {
  role: 'creator' | 'player';
  displayName: string;
};

export type ScoreGoal = 20 | 30 | 50 | 100 | 'NEVER';

export type MatchPhase = 'PRE_MATCH' | 'COUNTDOWN' | 'IN_PROGRESS' | 'POST_ROUND' | 'POST_MATCH';

export type MatchStatus = {
  matchId: string;
  phase: MatchPhase;
  minPlayers: number;
  scoreGoal: ScoreGoal;
  scoreGoalLocked: boolean;
  players: Array<{ playerId: string; displayName: string; ready: boolean; role: string; points: number; wins: number }>;
};

export type MatchCountdown = {
  secondsLeft: number;
};

export type TickSnapshot = {
  tick: number;
  balls: Array<{
    id: string; //corresponds to playerId
    x: number;
    y: number;
    angle: number;
    xVel: number;
    yVel: number;
  }>;
};

// Transient one-shot effects that happened on the tick this packet was sent,
// packed as a bitmask so remote clients can play the matching VFX.
export const PLAYER_EVENT = {
  DOUBLE_JUMP: 1,
  DASH: 2,
  DIED: 4,
} as const;

export type PlayerStateUpdate = {
  seq: number;
  events?: number; // PLAYER_EVENT bitmask (0/absent = none)
  // Sender's own performance.now() at sample time. Used by remote clients to
  // interpolate on a jitter-free source timeline (the *spacing* between a
  // sender's tMs values is its true snapshot cadence). Cross-machine clock
  // skew is irrelevant — only the relative spacing is used. See RemoteSmoother.
  tMs: number;
  x: number;
  y: number;
  angle: number;
  xVel: number;
  yVel: number;
};

export type RemotePlayerStateUpdate = PlayerStateUpdate & {
  playerId: string;
  serverTimeMs: number;
};

// Sent client -> server when the local player first crosses a checkpoint.
// index = creation-order checkpoint index; timeMs = elapsed since round start.
export type CheckpointReached = {
  index: number;
  timeMs: number;
};

export type PlayerSpawn = {
  playerId: string;
  x: number;
  y: number;
};

export type InitializePlayersPayload = {
  spawns: PlayerSpawn[];
};

// Sent once on COUNTDOWN entry: bundles the level + per-player spawns atomically.
export type RoundStartingPayload = {
  level: LevelDefinition;
  spawns: PlayerSpawn[];
};

export type FinishOrderUpdate = {
  finishedPlayerIds: string[];
};

export type RoundResultPlayer = {
  playerId: string;
  displayName: string;
  finishPlace: number | null;
  finishTimeMs: number | null;
  pointsEarned: number;
  totalPoints: number;
  dnf: boolean;
};

export type RoundEndReason = 'all_finished' | 'finish_timeout';

export type RoundResultsUpdate = {
  reason: RoundEndReason;
  firstFinisherAtMs: number | null;
  roundEndedAtMs: number;
  scoreGoal: ScoreGoal;
  winners: string[];
  players: RoundResultPlayer[];
};

export type MatchResultPlayer = {
  playerId: string;
  displayName: string;
  totalPoints: number;
  rank: number;
  finalRoundPlace: number | null;
};

export type MatchResultsUpdate = {
  scoreGoal: Exclude<ScoreGoal, 'NEVER'>;
  winners: string[];
  roundsPlayed: number;
  players: MatchResultPlayer[];
};

export type Ball = {
  id: string;
  x: number;
  y: number;
  xVel?: number;
  yVel?: number;
};

export type LegacyDragInputVector = {
  x: number;
  y: number;
};

export type LegacyPlayerInputVector = {
  playerId: string;
  x: number;
  y: number;
};

export type InputState = {
  move: -1 | 0 | 1;
  jumpPressed: boolean;
  jumpHeld: boolean;
  // Dash: dashPressed is true only on the tick a dash begins; dashX is the A/D
  // direction at that moment (0 = stall). Optional so non-producing call sites
  // (e.g. the dormant server input path) can omit them.
  dashPressed?: boolean;
  dashX?: -1 | 0 | 1;
};

export type PlayerInputState = InputState & {
  playerId: string;
};

export type {
  LevelDefinition,
  LevelResponse,
  LevelObject,
  PlatformDef,
  SpawnPointDef,
  PolygonDef,
  GoalDef,
  CheckpointDef,
  HazardDef,
  LevelListItem,
} from './level.js';

export { resolveHazardBody, coerceHazardCatalog, DEFAULT_BODY_SCALE } from './hazards.js';
export type { HazardBody, HazardCatalogEntry, HazardCatalog, ResolvedHazardBody } from './hazards.js';

export const scaleFactor = 100; //pixels per planck.js unit(meter). Const because this needs to be consistent between client and server - nobody can change it anywhere except here
export const toWorld = (pixels: number) => pixels / scaleFactor;
export const toPixels = (meters: number) => meters * scaleFactor;
