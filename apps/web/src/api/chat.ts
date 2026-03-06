import { io, type Socket } from 'socket.io-client';
import type { ChatTokenResponse } from '@cup/shared-types';
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
