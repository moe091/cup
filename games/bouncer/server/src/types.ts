type Brand<K, T> = K & { __brand: T };

export type SocketId = Brand<string, 'SocketId'>;
export type PlayerId = Brand<string, 'PlayerId'>;

export type PlayerSession = {
  socketId: SocketId;
  playerId: PlayerId;
  displayName: string;
  ready: boolean;
};

export type Broadcast = (name: string, payload: unknown) => void;

export const asPlayerId = (s: string) => s as PlayerId;
export const asSocketId = (s: string) => s as SocketId;
