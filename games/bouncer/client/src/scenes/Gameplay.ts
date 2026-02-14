import { Engine } from '@cup/bouncer-engine';
import type {
  FinishOrderUpdate,
  InitializePlayersPayload,
  InputState,
  LevelDefinition,
  MatchStatus,
  PlayerInputState,
  PlayerStateUpdate,
  RemotePlayerStateUpdate,
} from '@cup/bouncer-shared';
import { InputController } from '../misc/InputController';
import { RemoteSmoother } from '../misc/RemoteSmoother';

type ShadowSprite = Phaser.GameObjects.Sprite & {
  shadow: Phaser.GameObjects.Arc;
};

const LOCAL_SIM_HZ = 30;
const LOCAL_STEP_MS = 1000 / LOCAL_SIM_HZ;
const ACTIVE_SEND_MS = 1000 / 30;
const IDLE_SEND_MS = 1000 / 10;
const INTERPOLATION_DELAY_MS = 120;
const EXTRAPOLATION_CAP_MS = 150;
const SNAP_DISTANCE_PX = 120;

export class GameplayScene extends Phaser.Scene {
  private readyText: Phaser.GameObjects.Text | undefined;
  private readyBg: Phaser.GameObjects.Rectangle | undefined;
  private balls = new Map<string, ShadowSprite>();
  private me: ShadowSprite | undefined;
  private inputController: InputController = new InputController();
  private levelRects: Phaser.GameObjects.TileSprite[] = [];
  private levelPolygons: Phaser.GameObjects.Container[] = [];
  private bg: Phaser.GameObjects.TileSprite | undefined;
  private shadowOffset = { x: 8, y: -10 };
  private engine: Engine | null = null;
  private levelDef: LevelDefinition | null = null;
  private mySpawn: { x: number; y: number } | null = null;
  private localAccumulatorMs = 0;
  private sendAccumulatorMs = 0;
  private localSeq = 0;
  private jumpPressedQueued = false;
  private inputState: InputState = { move: 0, jumpHeld: false, jumpPressed: false };
  private remoteSmoother = new RemoteSmoother();
  private hasStartedMatch = false;
  private hasReportedFinish = false;
  private finishedOrder: string[] = [];

  constructor(
    private playerId: string,
    private readonly emit: (name: string, data: unknown) => void,
    private containerEl: HTMLElement,
  ) {
    super('gameplay');
  }

  fullscreenListener() {
    const fKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    if (!fKey) return;
    fKey.on('down', () => {
      void this.containerEl.requestFullscreen();
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

    this.add
      .sprite(this.cameras.main.width / 2, this.cameras.main.height / 2, 'vignette')
      .setSize(this.cameras.main.width, this.cameras.main.height)
      .setScrollFactor(0);

    this.inputController.onInput(this, this.handleInput.bind(this));

    this.events.once('destroy', this.onDestroy, this);
    this.emit('client_ready', 'IN_PROGRESS');
  }

  statusUpdate(status: MatchStatus) {
    if (status.phase === 'IN_PROGRESS') {
      this.hasStartedMatch = true;
    }
  }

  update(_time: number, delta: number) {
    this.localAccumulatorMs += delta;
    while (this.localAccumulatorMs >= LOCAL_STEP_MS) {
      this.localAccumulatorMs -= LOCAL_STEP_MS;
      this.stepLocalSimulation();
    }

    this.renderRemotePlayers();
  }

  handleInput(input: InputState) {
    this.inputState.move = input.move;
    this.inputState.jumpHeld = input.jumpHeld;
    if (input.jumpPressed) {
      this.jumpPressedQueued = true;
    }
  }

  hideReadyButton() {
    this.readyText?.destroy();
    this.readyText = undefined;

    this.readyBg?.destroy();
    this.readyBg = undefined;
  }

  onInitializePlayers(payload: InitializePlayersPayload) {
    const mySpawn = payload.spawns.find((spawn) => spawn.playerId === this.playerId);
    if (!mySpawn) {
      console.warn('[Gameplay.onInitializePlayers] Missing spawn for local player', this.playerId);
      return;
    }

    this.mySpawn = { x: mySpawn.x, y: mySpawn.y };
    this.initializeLocalEngineIfReady();
  }

  onRemotePlayerState(update: RemotePlayerStateUpdate) {
    if (update.playerId === this.playerId) {
      return;
    }

    this.remoteSmoother.addSnapshot(update);
    if (!this.balls.has(update.playerId)) {
      const sprite = this.createBallSprite(update.playerId, update.x, update.y);
      this.balls.set(update.playerId, sprite);
    }
  }

  onFinishOrderUpdate(update: FinishOrderUpdate) {
    this.finishedOrder = update.finishedPlayerIds;
  }

  onMatchStart() {
    this.hasStartedMatch = true;
  }

  loadLevel(level: LevelDefinition) {
    for (const rect of this.levelRects) rect.destroy();
    this.levelRects = [];
    for (const poly of this.levelPolygons) poly.destroy();
    this.levelPolygons = [];
    this.bg?.destroy();
    this.bg = undefined;

    this.levelDef = level;
    this.hasStartedMatch = false;

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

        this.add
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

        obj.vertices.forEach((v) => {
          if (v.x < minX) minX = v.x;
          if (v.x > maxX) maxX = v.x;
          if (v.y < minY) minY = v.y;
          if (v.y > maxY) maxY = v.y;
        });
      } else if (obj.type === 'goal') {
        this.add.circle(obj.x, obj.y, obj.size, 0xffffff);
      }
    });

    this.bg = this.add
      .tileSprite(minX - 500, minY - 500, maxX - minX + 1000, maxY - minY + 1000, 'bg_texture')
      .setOrigin(0)
      .setDepth(-100);

    this.initializeLocalEngineIfReady();
  }

  private stepLocalSimulation() {
    if (!this.engine || !this.hasStartedMatch) {
      this.jumpPressedQueued = false;
      return;
    }

    const input: PlayerInputState = {
      playerId: this.playerId,
      move: this.inputState.move,
      jumpHeld: this.inputState.jumpHeld,
      jumpPressed: this.jumpPressedQueued,
    };

    this.jumpPressedQueued = false;
    this.engine.step([input]);

    const snapshot = this.engine.getSnapshot();
    const me = snapshot.balls.find((ball) => ball.id === this.playerId);
    if (!me) {
      return;
    }

    const mySprite = this.balls.get(this.playerId);
    if (mySprite) {
      mySprite.setPosition(me.x, me.y);
      mySprite.shadow.setPosition(me.x + 8, me.y - 10);
      mySprite.setRotation(me.angle);
    }

    this.sendAccumulatorMs += LOCAL_STEP_MS;
    const isActive =
      this.inputState.move !== 0 ||
      this.inputState.jumpHeld ||
      Math.abs(me.xVel) > 1 ||
      Math.abs(me.yVel) > 1;
    const targetSendMs = isActive ? ACTIVE_SEND_MS : IDLE_SEND_MS;
    if (this.sendAccumulatorMs >= targetSendMs) {
      this.sendAccumulatorMs = 0;
      const update: PlayerStateUpdate = {
        seq: this.localSeq++,
        x: me.x,
        y: me.y,
        angle: me.angle,
        xVel: me.xVel,
        yVel: me.yVel,
      };
      this.emit('player_state', update);
    }
  }

  private renderRemotePlayers() {
    const renderTimeMs = performance.now() - INTERPOLATION_DELAY_MS;

    for (const playerId of this.remoteSmoother.getPlayerIds()) {
      if (playerId === this.playerId) {
        continue;
      }

      const sample = this.remoteSmoother.sample(playerId, renderTimeMs, EXTRAPOLATION_CAP_MS);
      if (!sample) {
        continue;
      }

      let sprite = this.balls.get(playerId);
      if (!sprite) {
        sprite = this.createBallSprite(playerId, sample.x, sample.y);
        this.balls.set(playerId, sprite);
      }

      const dx = sample.x - sprite.x;
      const dy = sample.y - sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist > SNAP_DISTANCE_PX) {
        sprite.setPosition(sample.x, sample.y);
      } else {
        sprite.setPosition(
          Phaser.Math.Linear(sprite.x, sample.x, 0.7),
          Phaser.Math.Linear(sprite.y, sample.y, 0.7),
        );
      }
      sprite.shadow.setPosition(sprite.x + 8, sprite.y - 10);
      sprite.setRotation(Phaser.Math.Angle.RotateTo(sprite.rotation, sample.angle, 0.35));
    }
  }

  private initializeLocalEngineIfReady() {
    if (!this.levelDef || !this.mySpawn) {
      return;
    }

    this.engine = new Engine(1 / LOCAL_SIM_HZ, this.onLocalPlayerFinished.bind(this));
    this.engine.loadLevel(this.levelDef);
    this.engine.spawnPlayerAt(this.playerId, this.mySpawn.x, this.mySpawn.y);

    for (const sprite of this.balls.values()) {
      sprite.destroy();
      sprite.shadow.destroy();
    }
    this.balls.clear();
    this.remoteSmoother.clearAll();

    const meSprite = this.createBallSprite(this.playerId, this.mySpawn.x, this.mySpawn.y);
    this.balls.set(this.playerId, meSprite);
    this.me = meSprite;
    this.cameras.main.startFollow(meSprite, false, 0.4, 0.4);

    const particles = this.add
      .particles(0, 0, 'trail_dot', {
        speed: 0,
        lifespan: 400,
        scale: { start: 4, end: 0 },
        alpha: { start: 0.8, end: 0 },
        frequency: 20,
      })
      .setDepth(-1);
    particles.startFollow(meSprite);

    this.hasReportedFinish = false;
    this.hasStartedMatch = false;
    this.finishedOrder = [];
    this.localAccumulatorMs = 0;
    this.sendAccumulatorMs = 0;
    this.jumpPressedQueued = false;
    this.localSeq = 0;
  }

  private onLocalPlayerFinished(playerId: string) {
    if (playerId !== this.playerId) {
      return;
    }
    if (this.hasReportedFinish) {
      return;
    }

    this.hasReportedFinish = true;
    this.emit('player_finished', {});
  }

  private createBallSprite(playerId: string, x: number, y: number): ShadowSprite {
    const sprite = this.add.sprite(
      x,
      y,
      playerId === this.playerId ? 'ball_green' : 'ball_red',
    ) as ShadowSprite;
    sprite.shadow = this.add.circle(x + 8, y - 10, 26, 0x000000, 0.4).setDepth(-2);
    return sprite;
  }

  private createTexturedPolygon(vertices: Array<{ x: number; y: number }>): Phaser.GameObjects.Container {
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

    const graphics = this.make.graphics();
    graphics.fillStyle(0xffffff);
    graphics.beginPath();
    graphics.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
      graphics.lineTo(vertices[i].x, vertices[i].y);
    }
    graphics.closePath();
    graphics.fillPath();

    const mask = new Phaser.Display.Masks.GeometryMask(this, graphics);
    const texture = this.add.tileSprite(centerX, centerY, width, height, 'platform_texture');
    texture.setMask(mask);
    texture.setDepth(-10);

    return this.add.container(0, 0, [shadowGraphics, texture]);
  }

  onDestroy() {
    this.inputController.dispose();
    this.remoteSmoother.clearAll();
  }
}
