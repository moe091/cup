import http from 'node:http';
import { Server } from 'socket.io';
import { MatchStateMachine } from './matchStateMachine.js';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

//setup server
const httpServer = http.createServer((req, res) => {
  res.end('Bouncer http server is running\n');
});

// Reuses the same CORS_ALLOWED_ORIGINS the chat gateway uses (both containers load
// the same .env.docker). Falls back to the local dev origin when unset so `pnpm dev`
// keeps working without any env config.
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

const ioServer = new Server(httpServer, {
  cors: {
    origin: allowedOrigins.length > 0 ? allowedOrigins : 'http://localhost:5173',
  },
  path: '/gameserver/bouncer/socket.io',
});

//each 'match' represents a room or lobby, and is defined by the matchId in the URL on the frontend(also defined in ticket for verification)
const matches: Map<string, MatchStateMachine> = new Map();

//wait for connection, create and assign rooms/matches, setup socket handlers.
ioServer.on('connection', (socket) => {
  const ticket = socket.handshake.auth?.ticket;
  const secret = process.env.GAME_TICKET_SECRET;
  if (!ticket || !secret) {
    if (!secret) console.error('GAME_TICKET_SECRET not set');
    socket.disconnect(true);
    return;
  }

  let payload: jwt.JwtPayload;

  try {
    payload = jwt.verify(ticket, secret) as jwt.JwtPayload;
  } catch (err) {
    console.error('Invalid Ticket', err);
    socket.disconnect(true);
    return;
  }

  const matchId = payload.matchId;
  const gameId = payload.gameId;
  const role = payload.role;
  const displayName = payload.displayName;

  if (!matchId || gameId != 'bouncer') {
    console.log('Connection rejected: missing matchId or gameId');
    return socket.disconnect(true);
  }

  socket.data.matchId = matchId;
  socket.data.displayName = displayName;
  socket.data.role = role;

  socket.join(matchId);

  const match = getOrCreateMatch(matchId);

  // Joins are only allowed in the lobby. Any in-progress phase rejects new players.
  if (match.getPhase() !== 'PRE_MATCH') {
    socket.emit('join_error', { reason: 'match_in_progress' }); //TODO:: handle join_error on client side, display message
    return socket.disconnect(true);
  }
  match.onJoin(socket);

  socket.on('update_level_selection', (data) => match.onUpdateLevelSelection(socket, data));
  socket.on('update_score_goal', (data) => match.onUpdateScoreGoal(socket, data));
  socket.on('player_state', (data) => match.onPlayerState(socket, data));
  // Debug RTT/clock-offset probe: echo the client's timestamp + our server time.
  socket.on('cs_ping', (data) => socket.emit('cs_pong', { t0: data?.t0, ts: Date.now() }));
  socket.on('player_finished', () => match.onPlayerFinished(socket));
  socket.on('checkpoint_reached', (data) => match.onCheckpointReached(socket, data));
  socket.on('player_died', () => match.onPlayerDied(socket));
  socket.on('set_ready', (data) => match.onSetReady(socket, data));
  socket.on('round_ready', () => match.onRoundReady(socket));
  socket.on('start_match', () => match.onStartMatch(socket));
  socket.on('next_round', () => match.onNextRound(socket));
  socket.on('new_match', () => match.onNewMatch(socket));

  console.log('New client connected, socket id:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected, socket id:', socket.id);
    match.onLeave(socket);
  });
});

httpServer.listen(4001, () => {
  console.log('Server is listening on port 4001');
});

function getOrCreateMatch(matchId: string): MatchStateMachine {
  let match = matches.get(matchId);

  if (!match) {
    const broadcast = (name: string, payload: unknown) => {
      ioServer.to(matchId).emit(name, payload);
    };
    const broadcastExcept = (socketId: string, name: string, payload: unknown) => {
      ioServer.to(matchId).except(socketId).emit(name, payload);
    };
    const onEnd = () => {
      const sm = matches.get(matchId);
      sm?.destroy();
      matches.delete(matchId);
      console.log('Match ' + matchId + ' ended, destroying it!');
      //TODO:: Notify API match has ended so it can update database
    };
    match = new MatchStateMachine(matchId, broadcast, broadcastExcept, onEnd);
    matches.set(matchId, match);
  }
  return match;
}
