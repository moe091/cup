import http from 'node:http';
import { Server } from 'socket.io';
import { Match } from './match.js';

console.log('Server main.ts started');

const httpServer = http.createServer((req, res) => {
  res.end('Bouncer http server is running\n');
});

const ioServer = new Server(httpServer, {
  cors: {
    origin: '*', // TODO-PROD:: restrict this once I know my prod domain
  },
  path: '/gameserver/bouncer/socket.io',
});

const matches: Map<string, Match> = new Map();

function getOrCreateMatch(matchId: string): Match {
  // Check if match already exists
  let match = matches.get(matchId);
  if (!match) {
    match = new Match(matchId);
    matches.set(matchId, match);
  }
  return match;
}

ioServer.on('connection', (socket) => {
  const matchId = String((socket.handshake.auth as { matchId?: unknown }).matchId ?? '');
  if (!matchId) {
    console.log('Connection rejected: missing matchId');
    return socket.disconnect(true);
  }

  socket.data.matchId = matchId;
  socket.join(matchId);

  const match = getOrCreateMatch(matchId);
  match.onJoin(socket);

  socket.on('update', (data) => match.onUpdate(socket, data));

  console.log('New client connected, socket id:', socket.id);
  socket.emit('hello_event', 'Hello, you are connected to match #' + socket.handshake.auth.matchId);

  socket.on('disconnect', () => {
    console.log('Client disconnected, socket id:', socket.id);
    match.onLeave(socket);
  });
});

httpServer.listen(4001, () => {
  console.log('Server is listening on port 4001');
});
