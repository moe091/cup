import http from 'node:http';
import { Server } from 'socket.io';
import { Match } from './match.js';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

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
  const ticket = socket.handshake.auth?.ticket;
  const secret = process.env.GAME_TICKET_SECRET;
  console.log("[DEBUG] ticket: ", ticket);
  console.log("[DEBUG] secret: ", secret);
  if (!ticket || !secret) {
    if (!secret) console.error("GAME_TICKET_SECRET not set");
    socket.disconnect(true);
    return;
  }

  let payload: jwt.JwtPayload;

  try {
    payload = jwt.verify(ticket, secret) as jwt.JwtPayload;
  } catch (err) {
    console.error("Invalid Ticket", err);
    socket.disconnect(true);
    return;
  }

  const matchId = payload.matchId;
  const gameId = payload.gameId;
  const sub = payload.sub;
  const role = payload.role;
  const displayName = payload.displayName;

  console.log("[DEBUG] Ticket info: ", matchId, gameId, sub, role, displayName);

  if (!matchId || gameId != 'bouncer') {
    console.log('Connection rejected: missing matchId or gameId');
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
    match = new Match(matchId, broadcast, 'test2');
    matches.set(matchId, match);
  }
  return match;
}
