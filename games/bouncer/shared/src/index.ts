export type MatchJoinInfo = {
  role: 'creator' | 'player';
  displayName: string;
};

export type MatchPhase = 'WAITING' | 'IN_PROGRESS_QUEUED' | 'COUNTDOWN' | 'IN_PROGRESS' | 'PAUSED';

export type MatchStatus = {
  matchId: string;
  phase: MatchPhase;
  minPlayers: number;
  players: Array<{ playerId: string; displayName: string; ready: boolean; role: string }>;
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
    angularVel: number;
  }>;
};

export type Ball = {
  id: string;
  x: number;
  y: number;
  xVel?: number;
  yVel?: number;
};

export type BallState = {
  id: string;
  x: number;
  y: number;
  xVel: number;
  yVel: number;
  angle: number;
  angularVel: number;
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

export type TickedInput = {
  tick: number;
  input: InputState;
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

export const TICK_RATE = 30;
export const TICK_MS = 1000 / TICK_RATE;
