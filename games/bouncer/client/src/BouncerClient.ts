import Phaser from 'phaser';
import type { Socket } from 'socket.io-client';
import { GameplayScene } from './scenes/Gameplay';
import {
  LevelDefinition,
  LevelListItem,
  MatchCountdown,
  MatchJoinInfo,
  MatchStatus,
  TickSnapshot,
  InputState,
  TICK_RATE,
} from '@cup/bouncer-shared';
import { WaitingRoomScene } from './scenes/WaitingRoom';
import { BootScene } from './scenes/Boot';
import { loadLevelDef } from './api/levels';
import { Prediction } from './net/Prediction';

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
  private prediction: Prediction;

  constructor(socket: Socket, containerEl: HTMLElement) {
    this.socket = socket;
    this.prediction = new Prediction(socket.id || '', TICK_RATE);
    this.game = this.createPhaserGame(containerEl, 960, 540);
  }

  createPhaserGame(containerEl: HTMLElement, width: number, height: number): Phaser.Game {
    const playerId = this.socket.id || '';
    this.gameplayScene = new GameplayScene(
      playerId,
      this.emitMessage.bind(this),
      containerEl,
      this.prediction.getLocalBallState.bind(this.prediction),
      this.prediction.setDebugLogs.bind(this.prediction),
    );
    if (this.gameplayScene) {
      this.prediction.setInputSampler(this.gameplayScene.getInputSampler());
    }
    this.prediction.setSendInput(this.sendTickedInput.bind(this));
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
    this.prediction.stop();
    this.game.destroy(true);
  }

  onMatchJoin(info: MatchJoinInfo) {
    this.waitingRoomScene?.onMatchJoin(info);
  }

  onMatchStatusUpdate(status: MatchStatus) {
    console.log(`[BouncerClient.onMatchStatusUpdate] (SocketID :: ${this.socket.id}) Match Status = `, status);
    if (status.phase === 'WAITING') this.startOrContinueWaiting(status);
    else if (status.phase === 'IN_PROGRESS_QUEUED') this.startOrContinueGameplay(status);
  }

  onSetLevel(level: LevelListItem) {
    this.waitingRoomScene?.setLevelSelection(level);
  }

  async onLoadLevel(level: LevelDefinition) {
    this.gameplayScene?.loadLevel(level);
    this.prediction.loadLevel(level);
  }

  onMatchCountdownUpdate(data: MatchCountdown) {
    console.log(`[BouncerClient.onMatchCountdownUpdate]: COUNTDOWN: `, data.secondsLeft);
    //Display a big countdown on screen
  }

  onInitializeWorld(snapshot: TickSnapshot) {
    this.gameplayScene?.applySnapshot(snapshot);
    this.prediction.onServerSnapshot(snapshot);
    const localId = this.socket.id || '';
    const localBall = snapshot.balls.find((ball) => ball.id === localId);
    if (localBall) {
      this.prediction.setLocalBallState({
        id: localBall.id,
        x: localBall.x,
        y: localBall.y,
        xVel: localBall.xVel,
        yVel: localBall.yVel,
        angle: localBall.angle,
        angularVel: localBall.angularVel,
      });
    } else {
      this.prediction.spawnPlayer(localId);
    }
  }

  onSnapshot(snapshot: TickSnapshot) {
    this.prediction.onServerSnapshot(snapshot);
    this.gameplayScene?.applySnapshot(snapshot);
  }

  // ------------- Scene Helpers -------------- \\
  startOrContinueWaiting(status: MatchStatus) {
    if (!this.game.scene.isActive('waitingRoom')) {
      this.game.scene.stop('gameplay');
      this.game.scene.start('waitingRoom');
    }
    this.waitingRoomScene?.statusUpdate(status);
  }

  startOrContinueGameplay(status: MatchStatus) {
    if (!this.game.scene.isActive('gameplay')) {
      this.game.scene.stop('waitingRoom');
      this.game.scene.start('gameplay');
    }
    this.gameplayScene?.statusUpdate(status);
  }

  onMatchStart() {
    //TODO:: Display a UI message or something here
    console.log(`[BouncerClient.onMatchStart]: Starting Match!`);
    this.prediction.startFromTickZero();
  }

  emitMessage(name: string, data: unknown) {
    this.socket.emit(name, data);
  }

  private sendTickedInput(tick: number, input: InputState) {
    this.emitMessage('player_input', { tick, input });
  }
}
