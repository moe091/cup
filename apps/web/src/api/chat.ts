import { io, type Socket } from 'socket.io-client';
import type { ChannelHistoryResponseDto, ChatTokenResponse } from '@cup/shared-types';
import { buildCsrfHeaders } from './csrf';

export type ChatConnection = {
  socket: Socket;
  joinChannel: (channelId: string) => void;
  leaveChannel: (channelId: string) => void;
};

//TODO:: handle token expirations
export async function fetchChatToken(): Promise<ChatTokenResponse> {
  const response = await fetch('/api/chat/token', {
    method: 'POST',
    credentials: 'include',
    headers: await buildCsrfHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch chat token: ${response.status}`);
  }

  return (await response.json()) as ChatTokenResponse;
}

export function createChatSocket(token: string): Socket {
  return io('http://localhost:3000/chat', {
    auth: { token },
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });
}

export async function connectToChat(): Promise<ChatConnection> {
  const chatToken = await fetchChatToken();
  const socket = createChatSocket(chatToken.token);

  return {
    socket,
    joinChannel: (channelId: string) => joinChannel(socket, channelId),
    leaveChannel: (channelId: string) => leaveChannel(socket, channelId),
  };
}

export function joinChannel(socket: Socket, channelId: string): void {
  socket.emit('chat:join', { channelId });
}
export function leaveChannel(socket: Socket, channelId: string): void {
  socket.emit('chat:leave', { channelId });
}

type ChannelHistoryParams = {
  limit?: number;
  beforeCreatedAt?: string;
  beforeId?: string;
}
export async function fetchChannelHistory(channelId: string, params: ChannelHistoryParams): Promise<ChannelHistoryResponseDto> {
  const { limit = 25, beforeCreatedAt, beforeId } = params;

  if ((beforeCreatedAt && !beforeId) || (!beforeCreatedAt && beforeId)) {
    throw new Error("beforeCreatedAt and beforeId must be provided together(either both or neither).");
  }

  const query = new URLSearchParams({
    limit: String(limit),
  });

  if (beforeCreatedAt && beforeId) {
    query.set("beforeCreatedAt", beforeCreatedAt);
    query.set("beforeId", beforeId);
  }

  const response = await fetch(
    `/api/chat/channels/${encodeURIComponent(channelId)}/messages?${query.toString()}`,
    { credentials: "include", cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch channel message history: ${response.status}`);
  }
  return (await response.json()) as ChannelHistoryResponseDto;
}
