import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    this.load.image('bg_texture', '/games/bouncer/background.png');
    this.load.image('nebula_blue.png', '/games/bouncer/nebula_blue.png');
    this.load.image('nebula_pink.png', '/games/bouncer/nebula_pink.png');
    this.load.image('nebula_red.png', '/games/bouncer/nebula_red.png');
    this.load.image('stars_small_1.png', '/games/bouncer/stars_small_1.png');
    this.load.image('stars_small_2.png', '/games/bouncer/stars_small_2.png');
    this.load.image('stars_big_1.png', '/games/bouncer/stars_big_1.png');
    this.load.image('stars_big_2.png', '/games/bouncer/stars_big_2.png');
    this.load.image('platform_texture', '/games/bouncer/platform_texture.png');
    // Use orb sprites for player balls.
    this.load.image('ball_red', '/games/bouncer/orbs/orb_0001.png');
    this.load.image('ball_green', '/games/bouncer/orbs/orb_0000.png');
    this.load.image('vignette', '/games/bouncer/vignette.png');
  }

  create() {
    this.scene.start('waitingRoom');
  }
}
