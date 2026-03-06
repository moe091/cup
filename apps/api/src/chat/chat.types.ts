import type { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
export type { ChatTokenResponse, JoinLeaveAck } from '@cup/shared-types';


export type ChatTokenClaims = jwt.JwtPayload & {
  sub: string;
  ver: number;
};

export type JoinChannelPayload = {
  channelId: string;
};

export type ChatSocketData = {
  userId?: string;
};

export type ServerToClientEvents = {
  'chat:error': (payload: { code: 'UNAUTHORIZED'; message: string }) => void;
  'chat:join:ack': (payload: { ok: boolean; channelId?: string; error?: string }) => void;
  'chat:leave:ack': (payload: { ok: boolean; channelId?: string; error?: string }) => void;
};
export type ClientToServerEvents = {
  'chat:join': (payload: { channelId: string }) => void;
  'chat:leave': (payload: { channelId: string }) => void;
};
export type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, ChatSocketData>;