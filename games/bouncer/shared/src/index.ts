export type MatchPhase = 'WAITING' | 'IN_PROGRESS' | 'PAUSED';

export type MatchStatus = {
  matchId: string;
  phase: MatchPhase;
  minPlayers: number;
  players: Array<{ playerId: string; displayName: string; ready: boolean }>;
};

export type MatchCountdown = {
  secondsLeft: number;
}

export type TickSnapshot = {
  tick: number;
  balls: Array<{
    id: string; //corresponds to playerId
    x: number;
    y: number;
    angle: number;
  }>;
}

export type Ball = {
    id: string;
    x: number;
    y: number;
    xVel?: number;
    yVel?: number;
}

export type InputVector = {
  x: number;
  y: number;
}

export type PlayerInputVector = {
    playerId: string;
    x: number;
    y: number;
};

export type { LevelDefinition, LevelObject, PlatformDef, SpawnPointDef } from './level.js';
export { loadLevel } from './level.js';


export const scaleFactor = 100; //pixels per planck.js unit(meter). Const because this needs to be consistent between client and server - nobody can change it anywhere except here
export const toWorld = (pixels: number) => pixels / scaleFactor;
export const toPixels = (meters: number) => meters * scaleFactor;
