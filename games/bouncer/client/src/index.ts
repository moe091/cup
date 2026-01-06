import { io } from 'socket.io-client';

export type BouncerConnection = {
  disconnect: () => void;
};

export function connectBouncer(url: string, matchId: string): BouncerConnection {
  const socket = io(url, {
    transports: ['websocket'],
    auth: { matchId: matchId },
    path: '/gameserver/bouncer/socket.io',
  });

  socket.on('connect', () => {
    console.log('Connected to server with socket id:', socket.id);
  });

  socket.on('hello_event', (message) => {
    console.log('Received message from server:', message);
  });

  socket.on('match_joined', (message) => {
    console.log('match_joined: ', message);
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
  });

  socket.on('connect_error', (err) => {
    console.error('Connection error:', err);
  });

  return { disconnect: () => void socket.disconnect() };
}
