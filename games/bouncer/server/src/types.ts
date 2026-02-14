type Brand<K, T> = K & { __brand: T };

export type SocketId = Brand<string, 'SocketId'>;
export type PlayerId = Brand<string, 'PlayerId'>;

export type PlayerSession = {
  socketId: SocketId;
  playerId: PlayerId;
  displayName: string;
  role: string;
  ready: boolean;
};

export type Player = {
    playerId: PlayerId;
    isFinished: boolean;
    session: PlayerSession;
};

export type Broadcast = (name: string, payload: unknown) => void;
export type BroadcastExcept = (socketId: string, name: string, payload: unknown) => void;

export const asPlayerId = (s: string) => s as PlayerId;
export const asSocketId = (s: string) => s as SocketId;


