import Phaser from 'phaser';
import type { Socket } from 'socket.io-client';
import { GameplayScene } from './scenes/Gameplay';
import { MatchCountdown, MatchStatus } from '@cup/bouncer-shared';

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

  constructor(socket: Socket, containerEl: HTMLElement) {
    this.socket = socket;
    this.game = this.createPhaserGame(containerEl, 960, 540);

    console.log('Created new game: ', this.game);
  }

  createPhaserGame(containerEl: HTMLElement, width: number, height: number): Phaser.Game {
    this.gameplayScene = new GameplayScene(this.emitMessage.bind(this));
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: width,
      height: height,
      parent: containerEl,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [this.gameplayScene],
    };

    return new Phaser.Game(config);
  }

  destroy() {
    this.game.destroy(true);
  }

  onMatchStatusUpdate(data: MatchStatus) {
    console.log(`[BouncerClient.onMatchStatusUpdate] (SocketID :: ${this.socket.id}) Match Status = `, data);
    const me = data.players.find((p) => p.playerId === this.socket.id);

    if (me?.ready) this.gameplayScene?.hideReadyButton();
  }

  onMatchCountdownUpdate(data: MatchCountdown) {
    console.log(`[BouncerClient.onMatchCountdownUpdate]: COUNTDOWN: `, data.secondsLeft);
    //Display a big countdown on screen
  }

  onMatchStart() {
    console.log(`[BouncerClient.onMatchStart]: Starting Match!`);
  }

  emitMessage(name: string, data: unknown) {
    console.log(`Emitting Message [${name}]: `, data);
    this.socket.emit(name, data);
  }
}
