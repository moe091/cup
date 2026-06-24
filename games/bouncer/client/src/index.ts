import { io } from 'socket.io-client';
import { BouncerClient } from './BouncerClient';
import { BouncerEditorClient } from './BouncerEditorClient';
import {
  FinishOrderUpdate,
  type LevelDefinition,
  type MatchStatus,
  type MatchCountdown,
  type RemotePlayerStateUpdate,
  type RoundResultsUpdate,
  type RoundStartingPayload,
  type MatchResultsUpdate,
  MatchJoinInfo,
  LevelListItem,
  type HazardCatalog,
  type PickupRemovedPayload,
  type PlayerHeldPickupPayload,
  type PlayerEffectAppliedPayload,
} from '@cup/bouncer-shared';
import { LevelEditorScene } from './scenes/LevelEditor/LevelEditor';
import { loadLevelDef } from './api/levels';

export type { BouncerNetConfig, BouncerPhysicsConfig, BouncerConfigInput } from './config';
import type { BouncerConfigInput } from './config';

/*
 * Entry point for Bouncer client. Will be imported in react frontend.
 * React passes in the server url and matchId needed to connect to a lobby, as well
 * as the containerEl, which will end up being passed into phaser as the parent el
 * where the game canvas is added.
 *
 * returns a clean 'disconnect' function that cleans everything up, so react(or whoever
 * imports this) can handle disconnecting smoothly before leaving the page or rerendering or anything
 */
export function connectBouncer(
  url: string,
  ticket: string,
  containerEl: HTMLElement,
  config?: BouncerConfigInput,
  hazardCatalog?: HazardCatalog,
): BouncerConnection {
  let bouncerClient: BouncerClient | null = null;

  const socket = io(url, {
    transports: ['websocket'],
    auth: { ticket: ticket },
    path: '/gameserver/bouncer/socket.io',
  });

  socket.on('connect', () => {
    console.log('Connected to server with socket id:', socket.id);

    if (!bouncerClient) bouncerClient = new BouncerClient(socket, containerEl, config, hazardCatalog);
    else console.warn("connectBouncer() - socket.on('connect') :: bouncerClient already exists! Keeping old client.");
  });

  socket.on('match_joined', (data: MatchJoinInfo) => {
    bouncerClient?.onMatchJoin(data);
  });

  socket.on('match_status', (data: MatchStatus) => {
    bouncerClient?.onMatchStatusUpdate(data);
  });

  //this event is called when the match leader updates the level selection in the lobby
  socket.on('set_level', (data: LevelListItem) => {
    bouncerClient?.onSetLevel(data);
  });

  //sent once on COUNTDOWN entry: bundles the level definition + per-player spawns
  socket.on('round_starting', (data: RoundStartingPayload) => {
    bouncerClient?.onRoundStarting(data);
  });

  socket.on('countdown', (data: MatchCountdown) => {
    bouncerClient?.onMatchCountdownUpdate(data);
  });

  socket.on('host_left', () => {
    bouncerClient?.onHostLeft();
  });

  // Server rejects joins outside the lobby (e.g. match already in progress), then
  // disconnects. Show the reason before the socket drops.
  socket.on('join_error', (data: { reason?: string }) => {
    bouncerClient?.onJoinError(data?.reason);
  });

  socket.on('remote_player_state', (data: RemotePlayerStateUpdate) => {
    bouncerClient?.onRemotePlayerState(data);
  });

  socket.on('finish_order_update', (data: FinishOrderUpdate) => {
    bouncerClient?.onFinishOrderUpdate(data);
  });

  socket.on('round_results', (data: RoundResultsUpdate) => {
    bouncerClient?.onRoundResultsUpdate(data);
  });

  socket.on('match_results', (data: MatchResultsUpdate) => {
    bouncerClient?.onMatchResultsUpdate(data);
  });

  socket.on('pickup_removed', (data: PickupRemovedPayload) => {
    bouncerClient?.onPickupRemoved(data);
  });

  socket.on('player_pickup_held', (data: PlayerHeldPickupPayload) => {
    bouncerClient?.onPlayerHeldPickup(data);
  });

  socket.on('player_effect_applied', (data: PlayerEffectAppliedPayload) => {
    bouncerClient?.onPlayerEffectApplied(data);
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

export function createBouncerEditor(
  containerEl: HTMLElement,
  levelName: string,
  hazardCatalog?: HazardCatalog,
): BouncerEditorConnection {
  const editor = new BouncerEditorClient(containerEl, levelName, hazardCatalog);

  return {
    disconnect: () => editor.destroy(),
    getLevelDefinition: () => editor.getLevelDefinition(),
    loadExistingLevel: async (id: string) => {
      const level = await loadLevelDef(id);
      editor.loadLevel(level);
    },
  };
}
