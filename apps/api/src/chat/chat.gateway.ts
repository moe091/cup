import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { ChatTokenClaims, JoinChannelPayload, ChatSocket } from './chat.types';
import jwt from 'jsonwebtoken';
import { ChatService } from './chat.service';
import { ChatRealtimeMessage, ChatSendPayload } from '@cup/shared-types';

const MAX_MESSAGE_LENGTH = 4000; //TODO:: add to configs once created

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    //TODO:: DEPLOY:: update .env with correct domains/origins for CORS when deploying
    origin: (origin, callback) => {
      const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed'), false);
    },
    credentials: true,
    methods: ['GET', 'POST'],
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly chatService: ChatService) {}

  async handleConnection(socket: ChatSocket) {
    const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
    if (typeof token !== 'string' || token.trim().length === 0) {
      socket.disconnect();
      return;
    }

    const secret = process.env.CHAT_TOKEN_SECRET;
    if (!secret) {
      console.warn("[ChatGateway::handleConnection] CHAT_TOKEN_SECRET Not defined, can't authorize connections!");
      socket.disconnect();
      return;
    }

    try {
      const decoded = jwt.verify(token, secret, {
        audience: 'chat',
        issuer: 'cup-api',
      }) as ChatTokenClaims;
      if (typeof decoded.sub !== 'string' || decoded.sub.length === 0) {
        socket.disconnect();
        return;
      }

      const userId = decoded.sub;
      const authorDisplayName = await this.chatService.resolveAuthorDisplayName(userId);

      if (!authorDisplayName) {
        socket.disconnect();
        return;
      }

      socket.data.userId = userId;
      socket.data.authorDisplayName = authorDisplayName;
    } catch {
      socket.disconnect();
    }
  }

  @SubscribeMessage('chat:join')
  async handleJoin(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: unknown) {
    const userId = socket.data?.userId;
    if (typeof userId !== 'string' || userId.length === 0) {
      socket.emit('chat:error', { code: 'UNAUTHORIZED', message: 'Unauthorized socket' });
      socket.disconnect();
      return;
    }
    const payload = body as Partial<JoinChannelPayload>;
    if (typeof payload.channelId !== 'string' || payload.channelId.trim().length === 0) {
      socket.emit('chat:join:ack', { ok: false, error: 'Invalid channelId' });
      return;
    }
    const channelId = payload.channelId.trim();

    try {
      await this.chatService.assertCanViewChannel(channelId, userId);
    } catch {
      socket.emit('chat:join:ack', { ok: false, channelId, error: 'Not allowed to join this channel' });
      return;
    }

    const roomName = `channel:${channelId}`;
    await socket.join(roomName);
    socket.data.room = roomName;
    socket.emit('chat:join:ack', { ok: true, channelId });
  }

  @SubscribeMessage('chat:leave')
  async handleLeave(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: unknown) {
    const userId = socket.data?.userId;
    if (typeof userId !== 'string' || userId.length === 0) {
      socket.emit('chat:error', { code: 'UNAUTHORIZED', message: 'Unauthorized socket' });
      socket.disconnect();
      return;
    }
    const payload = body as Partial<JoinChannelPayload>;
    if (typeof payload.channelId !== 'string' || payload.channelId.trim().length === 0) {
      socket.emit('chat:leave:ack', { ok: false, error: 'Invalid channelId' });
      return;
    }
    const channelId = payload.channelId.trim();
    const roomName = `channel:${channelId}`;
    await socket.leave(roomName);
    if (socket.data.room === roomName) {
      socket.data.room = undefined;
    }
    socket.emit('chat:leave:ack', { ok: true, channelId });
  }

  @SubscribeMessage('chat:send')
  async handleSend(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: unknown) {
    const userId = socket.data.userId;
    const authorDisplayName = socket.data.authorDisplayName;

    const payload = body as Partial<ChatSendPayload>;
    const clientMessageId = payload.clientMessageId;
    const trimmedChannelId = typeof payload.channelId === 'string' ? payload.channelId.trim() : '';
    const trimmedBody = typeof payload.body === 'string' ? payload.body.trim() : '';
    const roomName = `channel:${trimmedChannelId}`;

    if (!authorDisplayName || !userId) {
      socket.emit('chat:send:ack', { ok: false, clientMessageId, error: 'User has invalid displayName or userId' });
      return;
    }

    if (!trimmedChannelId || roomName !== socket.data.room) {
      socket.emit('chat:send:ack', { ok: false, clientMessageId, error: 'Invalid channelId' });
      return;
    }

    if (!trimmedBody) {
      socket.emit('chat:send:ack', { ok: false, clientMessageId, error: 'Message body is required' });
      return;
    }

    if (trimmedBody.length > MAX_MESSAGE_LENGTH) {
      socket.emit('chat:send:ack', { ok: false, clientMessageId, error: 'Message is too long' });
      return;
    }

    if (!socket.rooms.has(roomName)) {
      socket.emit('chat:send:ack', { ok: false, clientMessageId, error: 'Not connected to channel room' });
      return;
    }

    try {
      const created = await this.chatService.createMessage({
        channelId: trimmedChannelId,
        authorUserId: userId,
        body: trimmedBody,
      });

      const realtimeMessage: ChatRealtimeMessage = {
        id: created.id,
        channelId: created.channelId,
        authorUserId: created.authorUserId,
        authorDisplayName,
        body: created.body,
        createdAt: created.createdAt.toISOString(),
      };

      socket.nsp.to(roomName).emit('chat:message', realtimeMessage);
      socket.emit('chat:send:ack', {
        ok: true,
        clientMessageId,
      });
    } catch {
      socket.emit('chat:send:ack', {
        ok: false,
        clientMessageId,
        error: 'Failed to send message',
      });
    }
  }

  handleDisconnect() {}
}
