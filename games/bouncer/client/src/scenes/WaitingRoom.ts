import { MatchJoinInfo, MatchStatus } from "@cup/bouncer-shared";

type PlayerRow = {
  container: Phaser.GameObjects.Container;
  nameText: Phaser.GameObjects.Text;
  readyText: Phaser.GameObjects.Text;
};

export class WaitingRoomScene extends Phaser.Scene {
  private startText: Phaser.GameObjects.Text | undefined;
  private role = '';
  private rows = new Map<string, PlayerRow>();
  private isReady = false;
  private pendingStatus: MatchStatus | null = null;


  constructor( 
    private playerId: string,
    private readonly emit: (name: string, data: unknown) => void,
  ) {
    super('waitingRoom');
  }

  init(data: { isCreator: boolean }) {

  }
  create() {
    const background = this.add
      .sprite(this.cameras.main.width / 2, this.cameras.main.height / 2, 'bg_texture')
      .setSize(this.cameras.main.width, this.cameras.main.height)
      .setDepth(-100)
      .setScrollFactor(0);

    const darken = this.add.rectangle(this.cameras.main.width / 2, this.cameras.main.height / 2, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.5);

    const startBg = this.add.rectangle(480, 400, 120, 40, 0x2d6a4f).setOrigin(0.5);
    this.startText = this.add.text(480, 400, this.role === 'creator' ? 'Start Match' : 'Ready?', { fontSize: '16px', color: '#ffffff' }).setOrigin(0.5);

    startBg.setInteractive({ useHandCursor: true });
    startBg.on('pointerup', () => {
      this.emit('set_ready', { ready: true });
      this.startText?.destroy();
      startBg.destroy();
    });

    this.isReady = true;
    if (this.pendingStatus) {
      this.statusUpdate(this.pendingStatus);
      this.pendingStatus = null;
    }
  }

  onMatchJoin(info: MatchJoinInfo) {
    this.role = info.role;

    if (info.role === 'creator') {
      this.startText?.setText('Start Match');
     } else {
      this.startText?.setText('Ready?');
     }
  }

  statusUpdate(status: MatchStatus) {
    if (!this.isReady) { //incase first update arrive before seen finishes loading
      this.pendingStatus = status;
      return;
    }

    const top = 120;
    const gap = 56;

    const seen = new Set<string>();

    status.players.forEach((p, index) => {
      const y = top + index * gap;
      seen.add(p.playerId);

      let row = this.rows.get(p.playerId);
      if (!row) {
        const spriteName = p.playerId === this.playerId ? 'ball_green' : 'ball_red';
        const bg = this.add.rectangle(120, 0, 300, 50, 0x000000).setDepth(-9);
        const ball = this.add.sprite(0, 0, spriteName).setScale(0.6);
        const nameText = this.add.text(40, -10, p.displayName, { fontSize: '18px', color: '#fff' });
        const readyText = this.add.text(140, -10, '', { fontSize: '18px', color: '#7cff7c', fontStyle: 'bold' });

        const container = this.add.container(80, y, [bg, ball, nameText, readyText]);
        row = { container, nameText, readyText };
        this.rows.set(p.playerId, row);
      }

      row.container.setPosition(80, y);
      row.nameText.setText(p.playerId === this.playerId ? 'YOU' : p.displayName);
      row.readyText.setText(p.ready ? 'READY' : 'Waiting...');
      row.readyText.setColor(p.ready ? '#22BB33' : '#BB2233');
    });

    for (const [id, row] of this.rows) {
      if (!seen.has(id)) {
        row.container.destroy();
        this.rows.delete(id);
      }
    }
  }

  /**
   * ------------- NEXT: SETUP WAITING ROOM SERVER-SIDE AND WIREUP STATUS UPDATE
   * ------------- SOCKET MESSAGES. SEND PLAYER NAMES AND READY STATUS, THEN
   * ------------- DISPLAY THAT INFO IN THIS SCENE. IF OWNER, ADD A 'START MATCH'
   * ------------- BUTTON THAT SENDS START MATCH MSG TO SERVER, WHICH SENDS A
   * ------------- MATCH START STATUS UPDATE TO ALL CLIENTS, WHICH TRIGGERS THEM
   * ------------- TO LOAD THE GAMEPLAY SCENE.
   * ------------- Server Match class already has waiting phase, that will become the waiting
   * room phase. Only "ready" clicks from the owner trigger match start. Status updates are already
   * sent on player join(onJoin calsl broadcastStatus which sends player id, name and ready
   * status), use those to update waiting room UI3
   */

  startMatch() {
    this.game.scene.stop('waitingRoom');
    this.game.scene.start('gameplay', { example: 'pass data into gameplay init(data) fn' });
  }
}
