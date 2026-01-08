import { io } from 'socket.io-client';
import { BouncerClient } from './BouncerClient';
import type { MatchStatus, MatchCountdown } from '@cup/bouncer-shared';

/*
 * Entry point for Bouncer client. Will be imported in react frontend.
 * React passes in the server url and matchId needed to connect to a lobby, as well
 * as the containerEl, which will end up being passed into phaser as the parent el
 * where the game canvas is added.
 *
 * returns a clean 'disconnect' function that cleans everything up, so react(or whoever
 * imports this) can handle disconnecting smoothly before leaving the page or rerendering or anything
 */
export function connectBouncer(url: string, matchId: string, containerEl: HTMLElement): BouncerConnection {
  let bouncerClient: BouncerClient | null = null;

  const socket = io(url, {
    transports: ['websocket'],
    auth: { matchId: matchId },
    path: '/gameserver/bouncer/socket.io',
  });

  socket.on('connect', () => {
    console.log('Connected to server with socket id:', socket.id);

    if (!bouncerClient) bouncerClient = new BouncerClient(socket, containerEl);
    else console.warn("connectBouncer() - socket.on('connect') :: bouncerClient already exists! Keeping old client.");
  });

  socket.on('match_joined', (message) => {
    console.log('match_joined: ', message);
  });

  socket.on('match_status', (data: MatchStatus) => {
    bouncerClient?.onMatchStatusUpdate(data);
  });

  socket.on('countdown', (data: MatchCountdown) => {
    bouncerClient?.onMatchCountdownUpdate(data);
  });
  
  socket.on('start_match', () => {
    bouncerClient?.onMatchStart();
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
  });

  socket.on('connect_error', (err) => {
    console.error('Connection error:', err);
  });

  return {
    disconnect: () => {
      bouncerClient?.destroy();
      bouncerClient = null;
      socket.disconnect();
    },
  };
}

export type BouncerConnection = {
  disconnect: () => void;
};
