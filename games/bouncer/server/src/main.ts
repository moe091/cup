import http from 'node:http';
import { Server } from 'socket.io';
import { Match } from './match.js';

//setup server
const httpServer = http.createServer((req, res) => {
  res.end('Bouncer http server is running\n');
});
const ioServer = new Server(httpServer, {
  cors: {
    origin: '*', // TODO:: PROD:: restrict this once I know my prod domain
  },
  path: '/gameserver/bouncer/socket.io',
});

//each 'match' represents a room or lobby, and is defined by the matchId in the URL on the frontend(also defined in ticket for verification)
const matches: Map<string, Match> = new Map();

//wait for connection, create and assign rooms/matches, setup socket handlers.
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

  socket.on('input', (data) => match.onInput(socket.data.playerId, data));

  socket.on('set_ready', (data) => match.onSetReady(socket, data));

  console.log('New client connected, socket id:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected, socket id:', socket.id);
    match.onLeave(socket);
  });
});

httpServer.listen(4001, () => {
  console.log('Server is listening on port 4001');
});

function getOrCreateMatch(matchId: string): Match {
  let match = matches.get(matchId);

  if (!match) {
    const broadcast = (name: string, payload: unknown) => {
      ioServer.to(matchId).emit(name, payload);
    };
    match = new Match(matchId, broadcast);
    matches.set(matchId, match);
  }
  return match;
}
