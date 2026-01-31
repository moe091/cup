import type { TickSnapshot, InputVector, LevelDefinition, MatchStatus } from '@cup/bouncer-shared';
import { InputController } from '../misc/InputController';

type ShadowSprite = Phaser.GameObjects.Sprite & {
  shadow: Phaser.GameObjects.Arc;
};

export class GameplayScene extends Phaser.Scene {
  private readyText: Phaser.GameObjects.Text | undefined;
  private readyBg: Phaser.GameObjects.Rectangle | undefined;
  private balls: Map<string, ShadowSprite>;
  private me: Phaser.GameObjects.Sprite | undefined;
  private dragCircles: { x: number; y: number; circle: Phaser.GameObjects.Arc }[] = [];
  private lastDragInput: InputVector | undefined;
  private inputController: InputController = new InputController();
  private levelRects: Phaser.GameObjects.TileSprite[] = [];
  private levelPolygons: Phaser.GameObjects.Container[] = [];
  private bg: Phaser.GameObjects.TileSprite | undefined;
  private shadowOffset = { x: 8, y: -10 };

  constructor(
    private playerId: string,
    private readonly emit: (name: string, data: unknown) => void,
    private containerEl: HTMLElement,
  ) {
    super('gameplay');
    this.balls = new Map<string, ShadowSprite>();
  }

  fullscreenListener() {
    const fKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    fKey.on('down', () => {
      this.containerEl.requestFullscreen();
    });
  }

  create() {
    this.fullscreenListener();

    this.cameras.main.setZoom(0.33);
    this.cameras.main.setRoundPixels(true);

    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('trail_dot', 8, 8);
    g.destroy();

    const vignette = this.add
      .sprite(this.cameras.main.width / 2, this.cameras.main.height / 2, 'vignette')
      .setSize(this.cameras.main.width, this.cameras.main.height)
      .setScrollFactor(0);

    this.inputController.onDrag(
      this,
      this.handleDragMove.bind(this),
      this.handleDragRelease.bind(this),
      this.cancelDrag.bind(this),
    );

    this.events.once('destroy', this.onDestroy, this);
    console.log('EMITTING CLIENT READY');
    this.emit('client_ready', 'IN_PROGRESS');
  }

  statusUpdate(status: MatchStatus) {}

  update() {
    if (this.me && this.lastDragInput) {
      const input = this.lastDragInput;
      const xThird = input.x / 5;
      const yThird = input.y / 5;
      const numCircles = 3;
      if (this.dragCircles.length != numCircles) {
        for (var i = 0; i < numCircles; i++) {
          const x = this.me.x + xThird * (i + 1);
          const y = this.me.y + yThird * (i + 1);
          const size = 9 - i * 3;
          this.dragCircles[i] = { x, y, circle: this.add.circle(x, y, size, 0xddffee) };
        }
      } else {
        for (var i = 0; i < this.dragCircles.length; i++) {
          this.dragCircles[i].circle.x = this.me.x + xThird * (i + 1);
          this.dragCircles[i].circle.y = this.me.y + yThird * (i + 1);
        }
      }
    }
  }

  handleDragMove(input: InputVector) {
    this.lastDragInput = input;
  }

  handleDragRelease(inputVector: InputVector) {
    this.dragCircles.forEach((dc) => {
      dc.circle.destroy();
    });
    this.dragCircles = [];
    this.lastDragInput = undefined;
    this.emit('input', inputVector);
  }

  cancelDrag() {
    this.dragCircles.forEach((dc) => {
      dc.circle.destroy();
    });
    this.dragCircles = [];
    this.lastDragInput = undefined;
  }

  hideReadyButton() {
    this.readyText?.destroy();
    this.readyText = undefined;

    this.readyBg?.destroy();
    this.readyBg = undefined;
  }

  applySnapshot(snapshot: TickSnapshot) {
    snapshot.balls.forEach((ball) => {
      if (this.balls.has(ball.id)) {
        const cur = this.balls.get(ball.id);
        cur?.setPosition(ball.x, ball.y);
        cur?.shadow.setPosition(ball.x + 8, ball.y - 10);
        cur?.setRotation(ball.angle);
      } else {
        console.log('CREATING BALL: ', ball);
        const newBall = this.add.sprite(
          ball.x,
          ball.y,
          ball.id == this.playerId ? 'ball_green' : 'ball_red',
        ) as ShadowSprite;
        newBall.shadow = this.add.circle(ball.x + 8, ball.y - 10, 26, 0x000000, 0.4).setDepth(-2);

        if (ball.id === this.playerId) {
          this.me = newBall;
          this.cameras.main.startFollow(newBall, false, 0.4, 0.4);
          const particles = this.add
            .particles(0, 0, 'trail_dot', {
              speed: 0,
              lifespan: 400,
              scale: { start: 4, end: 0 },
              alpha: { start: 0.8, end: 0 },
              frequency: 20,
            })
            .setDepth(-1);
          particles.startFollow(this.me);
        }
        this.balls.set(ball.id, newBall);
      }
    });
  }

  loadLevel(level: LevelDefinition) {
    console.log('[DEBUG] loadLevel being called with level definition: ', level.name);
    // Clean up existing level objects
    for (const rect of this.levelRects) rect.destroy();
    this.levelRects = [];
    for (const poly of this.levelPolygons) poly.destroy();
    this.levelPolygons = [];

    let minX = 0;
    let minY = 0;
    let maxX = 0;
    let maxY = 0;

    level.objects.forEach((obj) => {
      if (obj.type === 'platform') {
        const platform = this.add
          .tileSprite(obj.x, obj.y, obj.width, obj.height, 'platform_texture')
          .setOrigin(0.5)
          .setDepth(-10);

        const shadow = this.add
          .rectangle(obj.x + 18, obj.y - 15, obj.width, obj.height, 0x000000, 0.4)
          .setOrigin(0.5)
          .setDepth(-11);

        if (obj.x - obj.width / 2 < minX) minX = obj.x - obj.width / 2;
        if (obj.x + obj.width / 2 > maxX) maxX = obj.x + obj.width / 2;
        if (obj.y - obj.height / 2 < minY) minY = obj.y - obj.height / 2;
        if (obj.y + obj.height / 2 > maxY) maxY = obj.y + obj.height / 2;

        this.levelRects.push(platform);
      } else if (obj.type === 'polygon') {
        const polygonContainer = this.createTexturedPolygon(obj.vertices);
        this.levelPolygons.push(polygonContainer);

        // Update bounds for background
        obj.vertices.forEach((v) => {
          if (v.x < minX) minX = v.x;
          if (v.x > maxX) maxX = v.x;
          if (v.y < minY) minY = v.y;
          if (v.y > maxY) maxY = v.y;
        });
      } else if (obj.type === 'goal') {
        const goal = this.add.circle(obj.x, obj.y, obj.size, 0xFFFFFF);

      }
    });

    this.bg = this.add
      .tileSprite(minX - 500, minY - 500, maxX - minX + 1000, maxY - minY + 1000, 'bg_texture')
      .setOrigin(0)
      .setDepth(-100);
  }

  private createTexturedPolygon(vertices: Array<{ x: number; y: number }>): Phaser.GameObjects.Container {
    // Calculate bounding box
    let minX = vertices[0].x;
    let minY = vertices[0].y;
    let maxX = vertices[0].x;
    let maxY = vertices[0].y;

    vertices.forEach((v) => {
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
    });

    const width = maxX - minX;
    const height = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Create shadow polygon (offset and black filled)
    const shadowGraphics = this.add.graphics();
    shadowGraphics.fillStyle(0x000000, 0.4);
    shadowGraphics.beginPath();
    shadowGraphics.moveTo(vertices[0].x + this.shadowOffset.x, vertices[0].y + this.shadowOffset.y);
    for (let i = 1; i < vertices.length; i++) {
      shadowGraphics.lineTo(vertices[i].x + this.shadowOffset.x, vertices[i].y + this.shadowOffset.y);
    }
    shadowGraphics.closePath();
    shadowGraphics.fillPath();
    shadowGraphics.setDepth(-11);

    // Create the Graphics object to define the polygon shape for mask
    const graphics = this.make.graphics();
    graphics.fillStyle(0xffffff);
    graphics.beginPath();
    graphics.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
      graphics.lineTo(vertices[i].x, vertices[i].y);
    }
    graphics.closePath();
    graphics.fillPath();

    // Create a Geometry Mask from the Graphics object
    const mask = new Phaser.Display.Masks.GeometryMask(this, graphics);

    // Create the textured tileSprite and apply the mask
    const texture = this.add.tileSprite(centerX, centerY, width, height, 'platform_texture');
    texture.setMask(mask);
    texture.setDepth(-10);

    // Container to hold everything
    const container = this.add.container(0, 0, [shadowGraphics, texture]);

    return container;
  }

  onDestroy() {
    this.inputController.dispose();
  }
}
