export type MatchPhase = 'WAITING' | 'IN_PROGRESS' | 'COUNTDOWN';

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