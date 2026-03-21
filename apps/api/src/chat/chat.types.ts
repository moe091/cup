import type { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import type {
  ChatReactionSetAck,
  ChatReactionSetPayload,
  ChatReactionUpdate,
  ChatRealtimeMessage,
  ChatSendAck,
  ChatSendPayload,
} from '@cup/shared-types';
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
  authorDisplayName?: string;
  room?: string;
};

export type ServerToClientEvents = {
  'chat:error': (payload: { code: 'UNAUTHORIZED'; message: string }) => void;
  'chat:join:ack': (payload: { ok: boolean; channelId?: string; error?: string }) => void;
  'chat:leave:ack': (payload: { ok: boolean; channelId?: string; error?: string }) => void;
  'chat:send:ack': (payload: ChatSendAck) => void;
  'chat:reaction:set:ack': (payload: ChatReactionSetAck) => void;
  'chat:message': (payload: ChatRealtimeMessage) => void;
  'chat:reaction:update': (payload: ChatReactionUpdate) => void;
};
export type ClientToServerEvents = {
  'chat:join': (payload: { channelId: string }) => void;
  'chat:leave': (payload: { channelId: string }) => void;
  'chat:send': (payload: ChatSendPayload) => void;
  'chat:reaction:set': (payload: ChatReactionSetPayload) => void;
};
export type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, ChatSocketData>;

export type ChannelHistoryQueryRaw = {
  limit?: string;
  beforeCreatedAt?: string;
  beforeId?: string;
};

export type ChannelHistoryQueryParsed = {
  limit: number;
  beforeCreatedAt?: Date;
  beforeId?: string;
};
