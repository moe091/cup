import type { Ball, TickSnapshot, InputVector } from '@cup/bouncer-shared';
import { InputController } from '../logic/InputController';

export class GameplayScene extends Phaser.Scene {
  private readyText: Phaser.GameObjects.Text | undefined; //placeholder ready button
  private readyBg: Phaser.GameObjects.Rectangle | undefined;
  private balls: Map<string, Phaser.GameObjects.Arc>;
  private inputController: InputController = new InputController();

  constructor(private readonly emit: (name: string, data: unknown) => void) {
    super('gameplay');
    this.balls = new Map<string, Phaser.GameObjects.Arc>();
  }

  create() {
    this.readyBg = this.add.rectangle(480, 280, 200, 60, 0x2d6a4f).setOrigin(0.5);
    this.readyText = this.add.text(480, 280, 'Ready?', { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);

    this.readyBg.setInteractive({ useHandCursor: true });
    this.readyBg.on('pointerup', () => this.emit('set_ready', { ready: true }));

    this.inputController.onDrag(this.input, this.handleDragInput.bind(this));

    this.events.once('destroy', this.onDestroy, this)
    //this.add.circle(480, 270, 20, 0x33935a);
  }

  handleDragInput(inputVector: InputVector) {
    console.log("DRAG: ", inputVector);
    this.emit('input', inputVector);
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
        console.log('UPDATING BALL: ', ball);
        this.balls.get(ball.id)?.setPosition(ball.x, ball.y);
      } else {
        console.log('CREATING BALL: ', ball);
        const newBall = this.add.circle(ball.x, ball.y, 20, 0x2244bb);
        this.balls.set(ball.id, newBall);
      }
    });
  }

  onDestroy() {
    this.inputController.dispose();
  }
}
