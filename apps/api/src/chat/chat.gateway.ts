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

@WebSocketGateway({
  namespace: '/chat',
  cors: { //TODO:: DEPLOY:: update .env with correct domains/origins for CORS when deploying
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
  handleConnection(socket: ChatSocket) {
    const token = socket.handshake.auth?.token;
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
      socket.data.userId = decoded.sub;
    } catch {
      socket.disconnect();
    }
  }

  @SubscribeMessage('chat:join')
  handleJoin(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: unknown) {
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
    const roomName = `channel:${channelId}`;
    socket.join(roomName);
    socket.emit('chat:join:ack', { ok: true, channelId });
  }

  @SubscribeMessage('chat:leave')
  handleLeave(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: unknown) {
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
    socket.leave(roomName);
    socket.emit('chat:leave:ack', { ok: true, channelId });
  }

  handleDisconnect(_socket: ChatSocket) {}

}
