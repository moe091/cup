import { io, type Socket } from 'socket.io-client';
import type { ChannelHistoryResponseDto, ChatTokenResponse } from '@cup/shared-types';
import { buildCsrfHeaders } from './csrf';

export type ChatConnection = {
  socket: Socket;
  joinChannel: (channelId: string) => void;
  leaveChannel: (channelId: string) => void;
  addDisconnectListener: (listener: (reason: string) => void) => void;
  removeDisconnectListener: (listener: (reason: string) => void) => void;
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

export function createChatSocket(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io('http://localhost:3000/chat', {
      auth: { token },
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    let settled = false;
    const connectionTimeout = setTimeout(() => {
      settle(new Error("Chat connection timed out"));
    }, 5000);
    const onConnect = () => {
      settle();
    };
    const onError = (error: Error) => {
      settle(error);
    }

    const settle = (error?: Error) => { //called when connection either succeeds or fails.
      if (settled) return; //prevent double-calling
      settled = true;

      if (error) socket.disconnect(); //force disconnect if any error occurred for safe cleanup. Remove all listeners and timeout no matter what
      socket.off('connect', onConnect);
      socket.off('connect_error', onError);
      clearTimeout(connectionTimeout);

      error ? reject(error) : resolve(socket); //Reject if there was an error, resolve socket if not.
    }

    socket.once('connect', onConnect);  
    socket.once('connect_error', onError);
  });
}

export async function connectToChat(): Promise<ChatConnection> { //TODO:: shuold probably rename to getChatConnection at this point
  const chatToken = await fetchChatToken();
  const socket = await createChatSocket(chatToken.token);
  const disconnectListeners: ((reason: string) => void)[] = [];

  socket.on('disconnect', (reason: string) => {
    console.warn("Chat socket disconnect");
    disconnectListeners.forEach(listener => listener(reason));
  });

  const addDisconnectListener = (listener: (reason: string) => void) => {
    disconnectListeners.push(listener)
  }

  const removeDisconnectListener = (listener: (reason: string) => void) => {
    const index = disconnectListeners.indexOf(listener);
    if (index > -1) {
      disconnectListeners.splice(index, 1);
    }
  }

  return {
    socket,
    joinChannel: (channelId: string) => joinChannel(socket, channelId),
    leaveChannel: (channelId: string) => leaveChannel(socket, channelId),
    addDisconnectListener,
    removeDisconnectListener,
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
  const res = (await response.json()) as ChannelHistoryResponseDto;
  res.messages.reverse();
  return res;
}
