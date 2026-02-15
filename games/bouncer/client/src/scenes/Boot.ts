import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    this.load.image('bg_texture', '/games/bouncer/background.png');
    this.load.image('platform_texture', '/games/bouncer/platform_texture.png');
    this.load.image('ball_red', '/games/bouncer/ball_red.png');
    this.load.image('ball_green', '/games/bouncer/ball_green.png');
    this.load.image('vignette', '/games/bouncer/vignette.png');
  }

  create() {
    this.scene.start('waitingRoom');
  }
}
