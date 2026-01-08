export class GameplayScene extends Phaser.Scene {
  private readyText: Phaser.GameObjects.Text | undefined; //placeholder ready button
  private readyBg: Phaser.GameObjects.Rectangle | undefined;

  constructor(private readonly emit: (name: string, data: unknown) => void) {
    super('gameplay');
  }

  create() {
    this.readyBg = this.add.rectangle(480, 280, 200, 60, 0x2d6a4f).setOrigin(0.5);
    this.readyText = this.add.text(480, 280, 'Ready?', { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);

    this.readyBg.setInteractive({ useHandCursor: true });
    this.readyBg.on('pointerup', () => this.emit('set_ready', { ready: true }));

    //this.add.circle(480, 270, 20, 0x33935a);
  }

  hideReadyButton() {
    this.readyText?.destroy();
    this.readyText = undefined;

    this.readyBg?.destroy();
    this.readyBg = undefined;
  }
}
