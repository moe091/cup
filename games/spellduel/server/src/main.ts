import http from 'node:http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { MatchStateMachine } from './matchStateMachine.js';

const httpServer = http.createServer((_req, res) => {
  res.end('SpellDuel game server is running\n');
});

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

const ioServer = new Server(httpServer, {
  cors: {
    origin: allowedOrigins.length > 0 ? allowedOrigins : 'http://localhost:5173',
  },
  path: '/gameserver/spellduel/socket.io',
});

const matches = new Map<string, MatchStateMachine>();

ioServer.on('connection', (socket) => {
  const ticket = socket.handshake.auth?.ticket;
  const secret = process.env.GAME_TICKET_SECRET;

  if (!ticket || !secret) {
    if (!secret) console.error('[spellduel] GAME_TICKET_SECRET not set');
    socket.disconnect(true);
    return;
  }

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(ticket, secret) as jwt.JwtPayload;
  } catch (err) {
    console.error('[spellduel] Invalid ticket', err);
    socket.disconnect(true);
    return;
  }

  const { matchId, gameId, role, displayName } = payload;

  if (!matchId || gameId !== 'spellduel') {
    console.log('[spellduel] Rejected: missing matchId or wrong gameId');
    socket.disconnect(true);
    return;
  }

  socket.data.matchId = matchId;
  socket.data.displayName = displayName;
  socket.data.role = role;
  socket.data.playerId = socket.id;

  socket.join(matchId);

  const match = getOrCreateMatch(matchId);

  if (match.getPhase() !== 'PRE_MATCH') {
    socket.emit('join_error', { reason: 'match_in_progress' });
    socket.disconnect(true);
    return;
  }

  match.onJoin(socket);

  socket.on('set_ready', (data) => match.onSetReady(socket, data));
  socket.on('update_settings', (data) => match.onUpdateSettings(socket, data));
  socket.on('start_match', () => match.onStartMatch(socket));
  socket.on('next_round', () => match.onNextRound(socket));
  socket.on('new_match', () => match.onNewMatch(socket));
  socket.on('submit_starting_guess', (data) => match.onSubmitStartingGuess(socket, data));
  socket.on('submit_guess', (data) => match.onSubmitGuess(socket, data));

  console.log(`[spellduel] Client connected: ${socket.id} → match ${matchId}`);

  socket.on('disconnect', () => {
    console.log(`[spellduel] Client disconnected: ${socket.id}`);
    match.onLeave(socket);
  });
});

function getOrCreateMatch(matchId: string): MatchStateMachine {
  let match = matches.get(matchId);
  if (!match) {
    const broadcast = (event: string, payload: unknown) => ioServer.to(matchId).emit(event, payload);
    const broadcastExcept = (socketId: string, event: string, payload: unknown) =>
      ioServer.to(matchId).except(socketId).emit(event, payload);
    const onEnd = () => {
      matches.get(matchId)?.destroy();
      matches.delete(matchId);
      console.log(`[spellduel] Match ${matchId} ended`);
    };
    match = new MatchStateMachine(matchId, broadcast, broadcastExcept, onEnd);
    matches.set(matchId, match);
  }
  return match;
}

const PORT = 4002;
httpServer.listen(PORT, () => {
  console.log(`[spellduel] Server listening on port ${PORT}`);
});
