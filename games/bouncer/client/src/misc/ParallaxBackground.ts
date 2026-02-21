import Phaser from 'phaser';

type ParallaxCreateOptions = {
  camera?: Phaser.Cameras.Scene2D.Camera;
  x: number;
  y: number;
  width: number;
  height: number;
  padding?: number;
};

type ParallaxLayer = {
  sprite: Phaser.GameObjects.TileSprite;
  speed: number;
};

const DEFAULT_PADDING = 1000;

export class ParallaxBackground {
  private readonly scene: Phaser.Scene;
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly x: number;
  private readonly y: number;
  private readonly width: number;
  private readonly height: number;
  private readonly padding: number;
  private readonly layers: ParallaxLayer[] = [];

  private constructor(scene: Phaser.Scene, options: ParallaxCreateOptions) {
    this.scene = scene;
    this.camera = options.camera ?? scene.cameras.main;
    this.x = options.x;
    this.y = options.y;
    this.width = options.width;
    this.height = options.height;
    this.padding = options.padding ?? DEFAULT_PADDING;

    this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.handleUpdate, this);
  }

  static create(scene: Phaser.Scene, options: ParallaxCreateOptions): ParallaxBackground {
    return new ParallaxBackground(scene, options);
  }

  addLayer(depth: number, textureKeyOrFilename: string, speed: number, alpha = 1): ParallaxBackground {
    if (!Number.isFinite(speed)) {
      throw new Error(`[ParallaxBackground] Invalid speed '${String(speed)}' for layer '${textureKeyOrFilename}'.`);
    }

    const textureKey = this.resolveTextureKey(textureKeyOrFilename);

    const sprite = this.scene.add
      .tileSprite(
        this.x - this.padding,
        this.y - this.padding,
        this.width + this.padding * 2,
        this.height + this.padding * 2,
        textureKey,
      )
      .setOrigin(0)
      .setDepth(depth)
      .setAlpha(alpha);

    this.layers.push({
      sprite,
      speed,
    });

    this.handleUpdate();
    return this;
  }

  destroy() {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.handleUpdate, this);
    for (const layer of this.layers) {
      layer.sprite.destroy();
    }
    this.layers.length = 0;
  }

  private handleUpdate() {
    const cameraScrollX = this.camera.scrollX;
    const cameraScrollY = this.camera.scrollY;

    for (const layer of this.layers) {
      layer.sprite.tilePositionX = cameraScrollX * layer.speed;
      layer.sprite.tilePositionY = cameraScrollY * layer.speed;
    }
  }

  private resolveTextureKey(textureKeyOrFilename: string): string {
    const hasExactKey = this.scene.textures.exists(textureKeyOrFilename);
    if (hasExactKey) {
      return textureKeyOrFilename;
    }

    const withoutExtension = textureKeyOrFilename.replace(/\.[^.]+$/, '');
    if (this.scene.textures.exists(withoutExtension)) {
      return withoutExtension;
    }

    throw new Error(
      `[ParallaxBackground] Texture key '${textureKeyOrFilename}' not loaded. ` +
        `Tried '${textureKeyOrFilename}' and '${withoutExtension}'.`,
    );
  }
}
