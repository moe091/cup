import Phaser from 'phaser';
import type { Socket } from 'socket.io-client';
import {
  FinishOrderUpdate,
  LevelListItem,
  MatchCountdown,
  MatchJoinInfo,
  MatchResultsUpdate,
  MatchStatus,
  RemotePlayerStateUpdate,
  RoundResultsUpdate,
  RoundStartingPayload,
} from '@cup/bouncer-shared';
import { GameplayScene } from './scenes/Gameplay';
import { WaitingRoomScene } from './scenes/WaitingRoom';
import { BootScene } from './scenes/Boot';
import { ClientMatchFlow } from './clientMatchFlow';
import { netDebug } from './misc/NetDebug';
import type { BouncerConfigInput } from './config';

const PING_INTERVAL_MS = 2000;
type PongPayload = { t0: number; ts: number };

/**
 * Thin shell: owns the Phaser game + scenes + socket, and instantiates the
 * ClientMatchFlow that does all match orchestration. index.ts routes socket
 * events here; each handler is a one-line delegation to the flow.
 */
export class BouncerClient {
  private game: Phaser.Game;
  private socket: Socket;
  private flow: ClientMatchFlow;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(socket: Socket, containerEl: HTMLElement, bouncerConfig?: BouncerConfigInput) {
    this.socket = socket;
    const playerId = socket.id || '';

    const gameplayScene = new GameplayScene(playerId, this.emitMessage.bind(this), containerEl, bouncerConfig);
    const waitingRoomScene = new WaitingRoomScene(playerId, this.emitMessage.bind(this), containerEl);
    const boot = new BootScene();

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 960,
      height: 540,
      parent: containerEl,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      dom: {
        createContainer: true, // Enable DOM element support
      },
      scene: [boot, waitingRoomScene, gameplayScene],
    };

    this.game = new Phaser.Game(config);
    this.flow = new ClientMatchFlow(this.game, waitingRoomScene, gameplayScene, playerId, containerEl);

    this.startPingLoop();
  }

  destroy() {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.socket.off('cs_pong');
    this.flow.destroy();
    this.game.destroy(true);
  }

  /** App-level RTT + NTP-style clock-offset probe, fed to the netcode HUD. */
  private startPingLoop() {
    this.socket.on('cs_pong', (data: PongPayload) => {
      const t3 = Date.now();
      const rtt = t3 - data.t0;
      // offset ≈ how far server clock leads ours, assuming symmetric latency.
      const offset = (data.ts - data.t0 + (data.ts - t3)) / 2;
      netDebug.recordPing(rtt, offset);
    });
    this.pingTimer = setInterval(() => {
      this.socket.emit('cs_ping', { t0: Date.now() });
    }, PING_INTERVAL_MS);
  }

  emitMessage(name: string, data: unknown) {
    if (name === 'player_state') {
      this.socket.volatile.emit(name, data);
      return;
    }
    this.socket.emit(name, data);
  }

  // ---------------- Socket event delegation ---------------- \\

  onMatchJoin(info: MatchJoinInfo) {
    this.flow.onMatchJoin(info);
  }

  onMatchStatusUpdate(status: MatchStatus) {
    this.flow.onMatchStatus(status);
  }

  onSetLevel(level: LevelListItem) {
    this.flow.onSetLevel(level);
  }

  onRoundStarting(payload: RoundStartingPayload) {
    this.flow.onRoundStarting(payload);
  }

  onMatchCountdownUpdate(data: MatchCountdown) {
    this.flow.onCountdown(data);
  }

  onRemotePlayerState(update: RemotePlayerStateUpdate) {
    this.flow.onRemotePlayerState(update);
  }

  onFinishOrderUpdate(update: FinishOrderUpdate) {
    this.flow.onFinishOrderUpdate(update);
  }

  onRoundResultsUpdate(update: RoundResultsUpdate) {
    this.flow.onRoundResults(update);
  }

  onMatchResultsUpdate(update: MatchResultsUpdate) {
    this.flow.onMatchResults(update);
  }

  onHostLeft() {
    this.flow.onHostLeft();
  }

  onJoinError(reason?: string) {
    this.flow.onJoinError(reason);
  }
}
