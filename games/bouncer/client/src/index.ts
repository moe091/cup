import { io } from 'socket.io-client';
import { BouncerClient } from './BouncerClient';
import { BouncerEditorClient } from './BouncerEditorClient';
import { type LevelDefinition, type MatchStatus, type MatchCountdown, type TickSnapshot, MatchJoinInfo, LevelListItem } from '@cup/bouncer-shared';
import { LevelEditorScene } from './scenes/LevelEditor/LevelEditor';
import { loadLevelDef } from './api/levels';

/*
 * Entry point for Bouncer client. Will be imported in react frontend.
 * React passes in the server url and matchId needed to connect to a lobby, as well
 * as the containerEl, which will end up being passed into phaser as the parent el
 * where the game canvas is added.
 *
 * returns a clean 'disconnect' function that cleans everything up, so react(or whoever
 * imports this) can handle disconnecting smoothly before leaving the page or rerendering or anything
 */
export function connectBouncer(url: string, ticket: string, containerEl: HTMLElement): BouncerConnection {
  let bouncerClient: BouncerClient | null = null;

  const socket = io(url, {
    transports: ['websocket'],
    auth: { ticket: ticket },
    path: '/gameserver/bouncer/socket.io',
  });

  socket.on('connect', () => {
    console.log('Connected to server with socket id:', socket.id);

    if (!bouncerClient) bouncerClient = new BouncerClient(socket, containerEl);
    else console.warn("connectBouncer() - socket.on('connect') :: bouncerClient already exists! Keeping old client.");
  });

  socket.on('match_joined', (data: MatchJoinInfo) => {
    bouncerClient?.onMatchJoin(data);
  });

  socket.on('match_status', (data: MatchStatus) => {
    bouncerClient?.onMatchStatusUpdate(data);
  });

  //this event is called when the match leader updates the level selection for next round, but it's not time to load it yet
  socket.on('set_level', (data: LevelListItem) => {
    bouncerClient?.onSetLevel(data);
  });

  //this event actually loads a levelDefinition
  socket.on('load_level', (data: LevelDefinition) => {
    bouncerClient?.onLoadLevel(data);
  });

  socket.on('countdown', (data: MatchCountdown) => {
    bouncerClient?.onMatchCountdownUpdate(data);
  });

  socket.on('initialize_world', (data: TickSnapshot) => {
    bouncerClient?.onInitializeWorld(data);
  });

  socket.on('start_match', () => {
    bouncerClient?.onMatchStart();
  });

  socket.on('snapshot', (data: TickSnapshot) => {
    bouncerClient?.onSnapshot(data);
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

export type BouncerEditorConnection = {
  disconnect: () => void;
  getLevelDefinition: () => LevelDefinition;
  loadExistingLevel: (id: string) => void;
};

export function createBouncerEditor(containerEl: HTMLElement, levelName: string): BouncerEditorConnection {
  const editor = new BouncerEditorClient(containerEl, levelName);

  return {
    disconnect: () => editor.destroy(),
    getLevelDefinition: () => editor.getLevelDefinition(),
    loadExistingLevel: async (id: string) => {
      const level = await loadLevelDef(id);
      editor.loadLevel(level);
    },
  };
}
