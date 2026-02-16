import Phaser from 'phaser';
import type { Socket } from 'socket.io-client';
import { GameplayScene } from './scenes/Gameplay';
import {
  FinishOrderUpdate,
  InitializePlayersPayload,
  LevelDefinition,
  LevelListItem,
  MatchCountdown,
  MatchJoinInfo,
  MatchStatus,
  RemotePlayerStateUpdate,
  RoundResultsUpdate,
} from '@cup/bouncer-shared';
import { WaitingRoomScene } from './scenes/WaitingRoom';
import { BootScene } from './scenes/Boot';

/**
 * The root of the actual bouncer game client. This class is created after all the
 * socket connection stuff is handled, and it creates the actual phaser game instance.
 * It will provide callbacks and functions for sending/receiving messages related to
 * actual gameplay, and act as a middleman between the socket+frontend and the actual
 * game, letting Gameplay.ts focus only on gameplay.
 */
export class BouncerClient {
  private game: Phaser.Game;
  private socket: Socket;
  private gameplayScene: GameplayScene | undefined;
  private waitingRoomScene: WaitingRoomScene | undefined;
  private pendingLevel: LevelDefinition | null = null;
  private pendingInitializePlayers: InitializePlayersPayload | null = null;
  private pendingGameplayStatus: MatchStatus | null = null;
  private pendingRoundEndStatus: MatchStatus | null = null;
  private pendingRoundResults: RoundResultsUpdate | null = null;
  private wantsGameplay = false;
  private isGameplayStarted = false;
  private hasSentClientReadyForQueue = false;

  constructor(socket: Socket, containerEl: HTMLElement) {
    this.socket = socket;
    this.game = this.createPhaserGame(containerEl, 960, 540);
  }

  createPhaserGame(containerEl: HTMLElement, width: number, height: number): Phaser.Game {
    const playerId = this.socket.id || '';
    this.gameplayScene = new GameplayScene(playerId, this.emitMessage.bind(this), containerEl);
    this.waitingRoomScene = new WaitingRoomScene(playerId, this.emitMessage.bind(this), containerEl);
    const boot = new BootScene();

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: width,
      height: height,
      parent: containerEl,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      dom: {
        createContainer: true, // Enable DOM element support
      },
      scene: [boot, this.waitingRoomScene, this.gameplayScene],
    };

    return new Phaser.Game(config);
  }

  destroy() {
    this.game.destroy(true);
  }

  onMatchJoin(info: MatchJoinInfo) {
    this.waitingRoomScene?.onMatchJoin(info);
  }

  onMatchStatusUpdate(status: MatchStatus) {
    console.log(`[BouncerClient.onMatchStatusUpdate] (SocketID :: ${this.socket.id}) Match Status = `, status);
    if (status.phase === 'ROUND_END') {
      this.pendingRoundEndStatus = status;
      this.tryShowRoundResults();
      return;
    }

    if (status.phase === 'WAITING') {
      this.pendingRoundEndStatus = null;
      this.pendingRoundResults = null;

      this.wantsGameplay = false;
      this.pendingGameplayStatus = null;
      this.hasSentClientReadyForQueue = false;
      this.startOrContinueWaiting(status);
      return;
    }

    if (status.phase === 'IN_PROGRESS_QUEUED' || status.phase === 'IN_PROGRESS') {
      this.wantsGameplay = true;
      this.pendingGameplayStatus = status;

      if (status.phase === 'IN_PROGRESS_QUEUED' && !this.hasSentClientReadyForQueue) {
        this.emitMessage('client_ready', 'IN_PROGRESS');
        this.hasSentClientReadyForQueue = true;
      }

      if (status.phase === 'IN_PROGRESS') {
        this.hasSentClientReadyForQueue = false;
      }

      this.tryStartGameplay();
      if (this.isGameplayStarted) {
        this.startOrContinueGameplay(status);
      }
    }
  }

  onSetLevel(level: LevelListItem) {
    this.waitingRoomScene?.setLevelSelection(level);
  }

  async onLoadLevel(level: LevelDefinition) {
    this.pendingLevel = level;
    this.tryStartGameplay();
  }

  onMatchCountdownUpdate(data: MatchCountdown) {
    console.log(`[BouncerClient.onMatchCountdownUpdate]: COUNTDOWN: `, data.secondsLeft);
    //Display a big countdown on screen
  }

  onInitializePlayers(payload: InitializePlayersPayload) {
    this.pendingInitializePlayers = payload;
    this.tryStartGameplay();
  }

  onRemotePlayerState(update: RemotePlayerStateUpdate) {
    this.gameplayScene?.onRemotePlayerState(update);
  }

  onFinishOrderUpdate(update: FinishOrderUpdate) {
    this.gameplayScene?.onFinishOrderUpdate(update);
  }

  onRoundResultsUpdate(update: RoundResultsUpdate) {
    console.log('[BouncerClient.onRoundResultsUpdate]', update);
    this.pendingRoundResults = update;
    this.tryShowRoundResults();
  }

  // ------------- Scene Helpers -------------- \\
  startOrContinueWaiting(status: MatchStatus) {
    const waitingActive = this.game.scene.isActive('waitingRoom');
    const gameplayActive = this.game.scene.isActive('gameplay');

    if (!waitingActive && gameplayActive) {
      this.game.scene.stop('gameplay');
      this.game.scene.start('waitingRoom');
    }

    this.isGameplayStarted = false;
    this.pendingLevel = null;
    this.pendingInitializePlayers = null;
    this.pendingGameplayStatus = null;
    this.pendingRoundEndStatus = null;
    this.pendingRoundResults = null;
    this.hasSentClientReadyForQueue = false;
    this.waitingRoomScene?.statusUpdate(status);
  }

  startOrContinueGameplay(status: MatchStatus) {
    this.ensureGameplaySceneStarted();
    this.gameplayScene?.statusUpdate(status);
  }

  onMatchStart() {
    this.gameplayScene?.onMatchStart();
    console.log(`[BouncerClient.onMatchStart]: Starting Match!`);
  }

  emitMessage(name: string, data: unknown) {
    console.log(`Emitting Message [${name}]: `, data);
    if (name === 'player_state') {
      this.socket.volatile.emit(name, data);
      return;
    }

    this.socket.emit(name, data);
  }

  private tryStartGameplay() {
    if (!this.wantsGameplay) {
      return;
    }
    if (!this.pendingLevel || !this.pendingInitializePlayers) {
      return;
    }

    this.ensureGameplaySceneStarted();

    this.gameplayScene?.loadLevel(this.pendingLevel);
    this.gameplayScene?.onInitializePlayers(this.pendingInitializePlayers);
    if (this.pendingGameplayStatus) {
      this.gameplayScene?.statusUpdate(this.pendingGameplayStatus);
    }

    this.pendingLevel = null;
    this.pendingInitializePlayers = null;
  }

  private ensureGameplaySceneStarted() {
    if (!this.game.scene.isActive('gameplay')) {
      this.game.scene.stop('waitingRoom');
      this.game.scene.start('gameplay');
    }
    this.isGameplayStarted = true;
  }

  private tryShowRoundResults(): boolean {
    if (!this.pendingRoundResults) {
      return false;
    }
    if (!this.game.scene.isActive('gameplay')) {
      return false;
    }

    this.wantsGameplay = false;
    this.pendingGameplayStatus = null;
    this.hasSentClientReadyForQueue = false;

    this.gameplayScene?.showRoundResultsModal(this.pendingRoundResults);
    this.pendingRoundResults = null;

    return true;
  }
}
