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