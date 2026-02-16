export type MatchJoinInfo = {
  role: 'creator' | 'player';
  displayName: string;
};

export type ScoreGoal = 20 | 30 | 50 | 100 | 'NEVER';

export type MatchPhase =
  | 'WAITING'
  | 'IN_PROGRESS_QUEUED'
  | 'COUNTDOWN'
  | 'IN_PROGRESS'
  | 'ROUND_END'
  | 'PAUSED';

export type MatchStatus = {
  matchId: string;
  phase: MatchPhase;
  minPlayers: number;
  scoreGoal: ScoreGoal;
  scoreGoalLocked: boolean;
  players: Array<{ playerId: string; displayName: string; ready: boolean; role: string; points: number }>;
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

export type PlayerStateUpdate = {
  seq: number;
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

export type PlayerSpawn = {
  playerId: string;
  x: number;
  y: number;
};

export type InitializePlayersPayload = {
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
  waitingAtMs: number;
  scoreGoal: ScoreGoal;
  winners: string[];
  players: RoundResultPlayer[];
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
  LevelListItem,
} from './level.js';

export const scaleFactor = 100; //pixels per planck.js unit(meter). Const because this needs to be consistent between client and server - nobody can change it anywhere except here
export const toWorld = (pixels: number) => pixels / scaleFactor;
export const toPixels = (meters: number) => meters * scaleFactor;
