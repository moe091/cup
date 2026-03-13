import { ChatGateway } from './chat.gateway';
import jwt from 'jsonwebtoken';

type ChatServiceMock = {
  assertCanViewChannel: jest.Mock;
  createMessage: jest.Mock;
  resolveAuthorDisplayName: jest.Mock;
};

type MockSocket = {
  data: {
    userId?: string;
    authorDisplayName?: string;
    room?: string;
  };
  emit: jest.Mock;
  disconnect: jest.Mock;
  join: jest.Mock<Promise<void>, [string]>;
  leave: jest.Mock<Promise<void>, [string]>;
  rooms: Set<string>;
  nsp: {
    to: jest.Mock;
  };
  handshake: {
    auth?: {
      token?: unknown;
    };
  };
};

function createMockSocket(): { socket: MockSocket; roomEmit: jest.Mock } {
  const roomEmit = jest.fn();

  const socket: MockSocket = {
    data: {},
    emit: jest.fn(),
    disconnect: jest.fn(),
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    rooms: new Set(['socket-id']),
    nsp: {
      to: jest.fn().mockReturnValue({ emit: roomEmit }),
    },
    handshake: {
      auth: {},
    },
  };

  return { socket, roomEmit };
}

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let chatServiceMock: ChatServiceMock;
  let originalChatTokenSecret: string | undefined;

  beforeEach(() => {
    originalChatTokenSecret = process.env.CHAT_TOKEN_SECRET;
    process.env.CHAT_TOKEN_SECRET = 'test-chat-secret';

    chatServiceMock = {
      assertCanViewChannel: jest.fn(),
      createMessage: jest.fn(),
      resolveAuthorDisplayName: jest.fn(),
    };

    gateway = new ChatGateway(chatServiceMock as never);
  });

  afterEach(() => {
    process.env.CHAT_TOKEN_SECRET = originalChatTokenSecret;
    jest.restoreAllMocks();
  });

  describe('handleConnection', () => {
    it('disconnects when token is missing', async () => {
      const { socket } = createMockSocket();

      await gateway.handleConnection(socket as never);

      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('disconnects when CHAT_TOKEN_SECRET is missing', async () => {
      const { socket } = createMockSocket();
      socket.handshake.auth = { token: 'token' };
      process.env.CHAT_TOKEN_SECRET = '';

      await gateway.handleConnection(socket as never);

      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('disconnects when token verification throws', async () => {
      const { socket } = createMockSocket();
      socket.handshake.auth = { token: 'token' };
      jest.spyOn(jwt, 'verify').mockImplementation(() => {
        throw new Error('invalid');
      });

      await gateway.handleConnection(socket as never);

      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('disconnects when resolved display name is missing', async () => {
      const { socket } = createMockSocket();
      socket.handshake.auth = { token: 'token' };
      jest.spyOn(jwt, 'verify').mockReturnValue({ sub: 'user-1' } as never);
      chatServiceMock.resolveAuthorDisplayName.mockResolvedValue(null);

      await gateway.handleConnection(socket as never);

      expect(chatServiceMock.resolveAuthorDisplayName).toHaveBeenCalledWith('user-1');
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('stores user metadata on socket data when auth succeeds', async () => {
      const { socket } = createMockSocket();
      socket.handshake.auth = { token: 'token' };
      jest.spyOn(jwt, 'verify').mockReturnValue({ sub: 'user-1' } as never);
      chatServiceMock.resolveAuthorDisplayName.mockResolvedValue('Jung');

      await gateway.handleConnection(socket as never);

      expect(socket.data.userId).toBe('user-1');
      expect(socket.data.authorDisplayName).toBe('Jung');
      expect(socket.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('handleJoin', () => {
    it('rejects unauthorized socket', async () => {
      const { socket } = createMockSocket();

      await gateway.handleJoin(socket as never, { channelId: 'abc' });

      expect(socket.emit).toHaveBeenCalledWith('chat:error', {
        code: 'UNAUTHORIZED',
        message: 'Unauthorized socket',
      });
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('rejects invalid channelId payload', async () => {
      const { socket } = createMockSocket();
      socket.data.userId = 'user-1';

      await gateway.handleJoin(socket as never, { channelId: '   ' });

      expect(socket.emit).toHaveBeenCalledWith('chat:join:ack', {
        ok: false,
        error: 'Invalid channelId',
      });
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('rejects join when access check fails', async () => {
      const { socket } = createMockSocket();
      socket.data.userId = 'user-1';
      chatServiceMock.assertCanViewChannel.mockRejectedValue(new Error('forbidden'));

      await gateway.handleJoin(socket as never, { channelId: 'seed-channel-private' });

      expect(chatServiceMock.assertCanViewChannel).toHaveBeenCalledWith('seed-channel-private', 'user-1');
      expect(socket.emit).toHaveBeenCalledWith('chat:join:ack', {
        ok: false,
        channelId: 'seed-channel-private',
        error: 'Not allowed to join this channel',
      });
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('joins room and sets socket room on success', async () => {
      const { socket } = createMockSocket();
      socket.data.userId = 'user-1';
      chatServiceMock.assertCanViewChannel.mockResolvedValue(undefined);

      await gateway.handleJoin(socket as never, { channelId: 'seed-channel-general' });

      expect(chatServiceMock.assertCanViewChannel).toHaveBeenCalledWith('seed-channel-general', 'user-1');
      expect(socket.join).toHaveBeenCalledWith('channel:seed-channel-general');
      expect(socket.data.room).toBe('channel:seed-channel-general');
      expect(socket.emit).toHaveBeenCalledWith('chat:join:ack', {
        ok: true,
        channelId: 'seed-channel-general',
      });
    });
  });

  describe('handleSend', () => {
    it('rejects send when user identity metadata is missing', async () => {
      const { socket } = createMockSocket();

      await gateway.handleSend(socket as never, {
        channelId: 'seed-channel-general',
        body: 'Hello',
      });

      expect(socket.emit).toHaveBeenCalledWith('chat:send:ack', {
        ok: false,
        clientMessageId: undefined,
        error: 'User has invalid displayName or userId',
      });
    });

    it('rejects send when payload channel does not match active room', async () => {
      const { socket } = createMockSocket();
      socket.data.userId = 'user-1';
      socket.data.authorDisplayName = 'Jung';
      socket.data.room = 'channel:seed-channel-1';

      await gateway.handleSend(socket as never, {
        channelId: 'seed-channel-2',
        body: 'Hello',
        clientMessageId: 'client-1',
      });

      expect(socket.emit).toHaveBeenCalledWith('chat:send:ack', {
        ok: false,
        clientMessageId: 'client-1',
        error: 'Invalid channelId',
      });
      expect(chatServiceMock.createMessage).not.toHaveBeenCalled();
    });

    it('rejects send when socket is not joined to target room', async () => {
      const { socket } = createMockSocket();
      socket.data.userId = 'user-1';
      socket.data.authorDisplayName = 'Jung';
      socket.data.room = 'channel:seed-channel-1';

      await gateway.handleSend(socket as never, {
        channelId: 'seed-channel-1',
        body: 'Hello',
        clientMessageId: 'client-1',
      });

      expect(socket.emit).toHaveBeenCalledWith('chat:send:ack', {
        ok: false,
        clientMessageId: 'client-1',
        error: 'Not connected to channel room',
      });
      expect(chatServiceMock.createMessage).not.toHaveBeenCalled();
    });

    it('creates message, broadcasts chat:message, and emits success ack', async () => {
      const { socket, roomEmit } = createMockSocket();
      socket.data.userId = 'seed-user-jung';
      socket.data.authorDisplayName = 'Jung';
      socket.data.room = 'channel:seed-channel-1';
      socket.rooms.add('channel:seed-channel-1');

      chatServiceMock.createMessage.mockResolvedValue({
        id: 'msg-1',
        channelId: 'seed-channel-1',
        authorUserId: 'seed-user-jung',
        body: 'Hello world',
        createdAt: new Date('2026-03-12T10:00:00.000Z'),
      });

      await gateway.handleSend(socket as never, {
        channelId: 'seed-channel-1',
        body: 'Hello world',
        clientMessageId: 'client-1',
      });

      expect(chatServiceMock.createMessage).toHaveBeenCalledWith({
        channelId: 'seed-channel-1',
        authorUserId: 'seed-user-jung',
        body: 'Hello world',
      });
      expect(socket.nsp.to).toHaveBeenCalledWith('channel:seed-channel-1');
      expect(roomEmit).toHaveBeenCalledWith('chat:message', {
        id: 'msg-1',
        channelId: 'seed-channel-1',
        authorUserId: 'seed-user-jung',
        authorDisplayName: 'Jung',
        body: 'Hello world',
        createdAt: '2026-03-12T10:00:00.000Z',
      });
      expect(socket.emit).toHaveBeenCalledWith('chat:send:ack', {
        ok: true,
        clientMessageId: 'client-1',
      });
    });

    it('emits failure ack when message creation fails', async () => {
      const { socket } = createMockSocket();
      socket.data.userId = 'seed-user-jung';
      socket.data.authorDisplayName = 'Jung';
      socket.data.room = 'channel:seed-channel-1';
      socket.rooms.add('channel:seed-channel-1');
      chatServiceMock.createMessage.mockRejectedValue(new Error('db fail'));

      await gateway.handleSend(socket as never, {
        channelId: 'seed-channel-1',
        body: 'Hello world',
        clientMessageId: 'client-1',
      });

      expect(socket.emit).toHaveBeenCalledWith('chat:send:ack', {
        ok: false,
        clientMessageId: 'client-1',
        error: 'Failed to send message',
      });
    });

    it('trims channelId and body before validating and persisting', async () => {
      const { socket } = createMockSocket();
      socket.data.userId = 'seed-user-jung';
      socket.data.authorDisplayName = 'Jung';
      socket.data.room = 'channel:seed-channel-1';
      socket.rooms.add('channel:seed-channel-1');
      chatServiceMock.createMessage.mockResolvedValue({
        id: 'msg-1',
        channelId: 'seed-channel-1',
        authorUserId: 'seed-user-jung',
        body: 'Hello world',
        createdAt: new Date('2026-03-12T10:00:00.000Z'),
      });

      await gateway.handleSend(socket as never, {
        channelId: '  seed-channel-1  ',
        body: '  Hello world  ',
        clientMessageId: 'client-1',
      });

      expect(chatServiceMock.createMessage).toHaveBeenCalledWith({
        channelId: 'seed-channel-1',
        authorUserId: 'seed-user-jung',
        body: 'Hello world',
      });
    });

    it('rejects whitespace-only body', async () => {
      const { socket } = createMockSocket();
      socket.data.userId = 'seed-user-jung';
      socket.data.authorDisplayName = 'Jung';
      socket.data.room = 'channel:seed-channel-1';

      await gateway.handleSend(socket as never, {
        channelId: 'seed-channel-1',
        body: '   ',
        clientMessageId: 'client-1',
      });

      expect(socket.emit).toHaveBeenCalledWith('chat:send:ack', {
        ok: false,
        clientMessageId: 'client-1',
        error: 'Message body is required',
      });
      expect(chatServiceMock.createMessage).not.toHaveBeenCalled();
    });

    it('rejects oversized message body', async () => {
      const { socket } = createMockSocket();
      socket.data.userId = 'seed-user-jung';
      socket.data.authorDisplayName = 'Jung';
      socket.data.room = 'channel:seed-channel-1';

      await gateway.handleSend(socket as never, {
        channelId: 'seed-channel-1',
        body: 'x'.repeat(4001),
        clientMessageId: 'client-1',
      });

      expect(socket.emit).toHaveBeenCalledWith('chat:send:ack', {
        ok: false,
        clientMessageId: 'client-1',
        error: 'Message is too long',
      });
      expect(chatServiceMock.createMessage).not.toHaveBeenCalled();
    });

    it('accepts missing clientMessageId and still sends success ack', async () => {
      const { socket } = createMockSocket();
      socket.data.userId = 'seed-user-jung';
      socket.data.authorDisplayName = 'Jung';
      socket.data.room = 'channel:seed-channel-1';
      socket.rooms.add('channel:seed-channel-1');
      chatServiceMock.createMessage.mockResolvedValue({
        id: 'msg-1',
        channelId: 'seed-channel-1',
        authorUserId: 'seed-user-jung',
        body: 'Hello world',
        createdAt: new Date('2026-03-12T10:00:00.000Z'),
      });

      await gateway.handleSend(socket as never, {
        channelId: 'seed-channel-1',
        body: 'Hello world',
      });

      expect(socket.emit).toHaveBeenCalledWith('chat:send:ack', {
        ok: true,
        clientMessageId: undefined,
      });
    });
  });

  describe('handleLeave', () => {
    it('rejects unauthorized socket', async () => {
      const { socket } = createMockSocket();

      await gateway.handleLeave(socket as never, { channelId: 'seed-channel-1' });

      expect(socket.emit).toHaveBeenCalledWith('chat:error', {
        code: 'UNAUTHORIZED',
        message: 'Unauthorized socket',
      });
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('rejects invalid channelId payload', async () => {
      const { socket } = createMockSocket();
      socket.data.userId = 'user-1';

      await gateway.handleLeave(socket as never, { channelId: '' });

      expect(socket.emit).toHaveBeenCalledWith('chat:leave:ack', {
        ok: false,
        error: 'Invalid channelId',
      });
      expect(socket.leave).not.toHaveBeenCalled();
    });

    it('clears socket.data.room when leaving active room', async () => {
      const { socket } = createMockSocket();
      socket.data.userId = 'user-1';
      socket.data.room = 'channel:seed-channel-1';

      await gateway.handleLeave(socket as never, { channelId: 'seed-channel-1' });

      expect(socket.leave).toHaveBeenCalledWith('channel:seed-channel-1');
      expect(socket.data.room).toBeUndefined();
      expect(socket.emit).toHaveBeenCalledWith('chat:leave:ack', {
        ok: true,
        channelId: 'seed-channel-1',
      });
    });

    it('does not clear socket.data.room when leaving different room', async () => {
      const { socket } = createMockSocket();
      socket.data.userId = 'user-1';
      socket.data.room = 'channel:seed-channel-2';

      await gateway.handleLeave(socket as never, { channelId: 'seed-channel-1' });

      expect(socket.leave).toHaveBeenCalledWith('channel:seed-channel-1');
      expect(socket.data.room).toBe('channel:seed-channel-2');
      expect(socket.emit).toHaveBeenCalledWith('chat:leave:ack', {
        ok: true,
        channelId: 'seed-channel-1',
      });
    });
  });
});
