import type { TickSnapshot, InputVector, LevelDefinition } from '@cup/bouncer-shared';
import { InputController } from '../logic/InputController';

type ShadowSprite = Phaser.GameObjects.Sprite & {
  shadow: Phaser.GameObjects.Arc; //can be circle or rect
};

export class GameplayScene extends Phaser.Scene {
  private readyText: Phaser.GameObjects.Text | undefined; //placeholder ready button
  private readyBg: Phaser.GameObjects.Rectangle | undefined;
  private balls: Map<string, ShadowSprite>;
  private me: Phaser.GameObjects.Sprite | undefined;
  //private dragCircles: Phaser.GameObjects.Arc[] = [];
  private dragCircles: {x: number, y: number, circle: Phaser.GameObjects.Arc}[] = [];
  private lastDragInput: InputVector | undefined;
  private inputController: InputController = new InputController();
  private levelRects: Phaser.GameObjects.TileSprite[] = [];
  private bg: Phaser.GameObjects.TileSprite | undefined;

  constructor(private playerId: string, private readonly emit: (name: string, data: unknown) => void) {
    super('gameplay');
    this.balls = new Map<string, ShadowSprite>();
  }

  preload() {
    this.load.image('bg_texture', '/games/bouncer/background.png');
    this.load.image('platform_texture', '/games/bouncer/platform_texture.png');
    this.load.image('ball_red', '/games/bouncer/ball_red.png');
    this.load.image('ball_green', '/games/bouncer/ball_green.png');
    this.load.image('vignette', '/games/bouncer/vignette.png');
  }

  create() {
    this.cameras.main.setZoom(0.33);
    this.cameras.main.setRoundPixels(true);

    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('trail_dot', 8, 8);
    g.destroy();

    const vignette = this.add.sprite(this.cameras.main.width / 2, this.cameras.main.height / 2, 'vignette')
      .setSize(this.cameras.main.width, this.cameras.main.height)
      .setScrollFactor(0);

    this.readyBg = this.add.rectangle(480, 280, 200, 60, 0x2d6a4f).setOrigin(0.5);
    this.readyText = this.add.text(480, 280, 'Ready?', { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);

    this.readyBg.setInteractive({ useHandCursor: true });
    this.readyBg.on('pointerup', () => this.emit('set_ready', { ready: true }));

    this.inputController.onDrag(this, this.handleDragMove.bind(this), this.handleDragRelease.bind(this), this.cancelDrag.bind(this));

    this.events.once('destroy', this.onDestroy, this)
    //this.add.circle(480, 270, 20, 0x33935a);
  }

  update() {
    console.log('update');
    
    if (this.me && this.lastDragInput) {
      const input = this.lastDragInput;
      const xThird = input.x / 5;
      const yThird = input.y / 5;
      const numCircles = 3;
      if (this.dragCircles.length != numCircles) {
        for (var i = 0; i < numCircles; i++) {
          const x = this.me.x + (xThird * (i+1));
          const y = this.me.y + (yThird * (i+1));  
          const size = 9 - (i * 3);
          this.dragCircles[i] = {x, y, circle: this.add.circle(x, y, size, 0xDDFFEE)}
        }
      } else {
        for (var i = 0; i < this.dragCircles.length; i++) {
          this.dragCircles[i].circle.x = this.me.x + (xThird * (i+1));
          this.dragCircles[i].circle.y = this.me.y + (yThird * (i+1));
        }
      }
    }
  }

  handleDragMove(input: InputVector) {
    this.lastDragInput = input;

  }

  handleDragRelease(inputVector: InputVector) {
    this.dragCircles.forEach(dc => {
      dc.circle.destroy();
    });
    this.dragCircles = [];
    this.lastDragInput = undefined;
    this.emit('input', inputVector);
  }

  cancelDrag() {
    this.dragCircles.forEach(dc => {
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
        const newBall = this.add.sprite(ball.x, ball.y, (ball.id == this.playerId) ? 'ball_green' : 'ball_red') as ShadowSprite;
        newBall.shadow = this.add.circle(ball.x + 8, ball.y - 10, 26, 0x000000, 0.4)
          .setDepth(-2);

        if (ball.id === this.playerId) {
          this.me = newBall;
          this.cameras.main.startFollow(newBall, false, 0.4, 0.4);
          const particles = this.add.particles(0, 0, 'trail_dot', {
            speed: 0,
            lifespan: 400,
            scale: { start: 4, end: 0 },
            alpha: { start: 0.8, end: 0 },
            frequency: 20, // lower = more dots
          }).setDepth(-1);
          particles.startFollow(this.me);
        }
        this.balls.set(ball.id, newBall);
      }
    });
  }

  loadLevel(level: LevelDefinition) {
    for (const rect of this.levelRects) rect.destroy();
    this.levelRects = [];
    let minX = 0;
    let minY = 0;
    let maxX = 0;
    let maxY = 0;

    level.objects.forEach((obj) => {
      if (obj.type !== 'platform') return;

      const platform = this.add.tileSprite(obj.x, obj.y, obj.width, obj.height, 'platform_texture')
        .setOrigin(0.5)
        .setDepth(-10);
      
      const shadow = this.add.rectangle(obj.x + 18, obj.y - 15, obj.width, obj.height, 0x000000, 0.4)
        .setOrigin(0.5)
        .setDepth(-11);
      
      if (obj.x - obj.width / 2 < minX) minX = obj.x - obj.width / 2;
      if (obj.x + obj.width / 2 > maxX) maxX = obj.x + obj.width / 2;
      if (obj.y - obj.height / 2 < minY) minY = obj.y - obj.height / 2;
      if (obj.y + obj.height / 2 > maxY) maxY = obj.y + obj.height / 2;

      this.levelRects.push(platform);
    });

    this.bg = this.add.tileSprite(minX - 500, minY - 500, (maxX - minX) + 1000, (maxY - minY) + 1000, 'bg_texture')
      .setOrigin(0)
      .setDepth(-100);
  }

  


  onDestroy() {
    this.inputController.dispose();
  }
}
