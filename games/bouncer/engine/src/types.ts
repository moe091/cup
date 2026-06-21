export type Ball = {
  id: string;
  x: number;
  y: number;
  xVel?: number;
  yVel?: number;
};

export type Point = {
  x: number;
  y: number;
};

export type FinishListener = (playerId: string) => void;

export type CheckpointListener = (playerId: string, checkpointIndex: number) => void;

export type HazardListener = (playerId: string) => void;
