import Phaser from 'phaser';
import type { HazardCatalog } from '@cup/bouncer-shared';

export class BootScene extends Phaser.Scene {
  constructor(private hazardCatalog: HazardCatalog = {}) {
    super('boot');
  }

  preload() {
    // Load hazard sprites by catalog key so the gameplay scene can render them.
    for (const entry of Object.values(this.hazardCatalog)) {
      this.load.image(entry.key, entry.spritePath);
    }

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
