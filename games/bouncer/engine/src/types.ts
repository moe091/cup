export type Ball = {
    id: string;
    x: number;
    y: number;
    xVel?: number;
    yVel?: number;
}

export type Point = {
    x: number;
    y: number;
}

export type WorldState = {
    balls: Array<Ball>;
}

export type Snapshot = {
  tick: number;
  state: WorldState;
}