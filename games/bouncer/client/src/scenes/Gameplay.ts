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
import { ParallaxBackground } from '../misc/ParallaxBackground';
import { RemoteSmoother } from '../misc/RemoteSmoother';

type ShadowSprite = Phaser.GameObjects.Sprite & {
  shadow?: Phaser.GameObjects.Arc;
};

const LOCAL_SIM_HZ = 30;
const LOCAL_STEP_MS = 1000 / LOCAL_SIM_HZ;
const ACTIVE_SEND_MS = 1000 / 30;
const IDLE_SEND_MS = 1000 / 10;
const INTERPOLATION_DELAY_MS = 120;
const EXTRAPOLATION_CAP_MS = 50;
const HARD_SNAP_X_PX = 140;
const HARD_SNAP_Y_PX = 28;
const POSITION_DEADZONE_X_PX = 0.8;
const POSITION_DEADZONE_Y_PX = 0.6;
const ENABLE_SHADOWS = false;
const PLAYER_BALL_DIAMETER_PX = 52;

const PLATFORM_GLOW_COLOR = 0xa7d6ff;
const PLATFORM_BASE_COLOR = 0xcfe9ff;
const PLATFORM_TOP_HIGHLIGHT_COLOR = 0xe9f7ff;
const PLATFORM_BOTTOM_SHADE_COLOR = 0x78a7cf;
const PLATFORM_BASE_ALPHA = 0.8;
const PLATFORM_FOREGROUND_COLOR = 0x5e88c7;
// Quick alternates for A/B:
// const PLATFORM_FOREGROUND_COLOR = 0x6e97d4;
// const PLATFORM_FOREGROUND_COLOR = 0x4f79b8;

type PlatformRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PolygonVerts = Array<{ x: number; y: number }>;

export class GameplayScene extends Phaser.Scene {
  private readyText: Phaser.GameObjects.Text | undefined;
  private readyBg: Phaser.GameObjects.Rectangle | undefined;
  private balls = new Map<string, ShadowSprite>();
  private me: ShadowSprite | undefined;
  private inputController: InputController = new InputController();
  private levelRects: Phaser.GameObjects.GameObject[] = [];
  private levelPolygons: Phaser.GameObjects.Container[] = [];
  private parallaxBg: ParallaxBackground | null = null;
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
    this.parallaxBg?.destroy();
    this.parallaxBg = null;

    this.levelDef = level;
    this.hasStartedMatch = false;

    let minX = 0;
    let minY = 0;
    let maxX = 0;
    let maxY = 0;
    const platformRects: PlatformRect[] = [];
    const polygonDefs: PolygonVerts[] = [];

    level.objects.forEach((obj) => {
      if (obj.type === 'platform') {
        // Preserved textured platform rendering for quick restore later:
        // const platform = this.add
        //   .tileSprite(obj.x, obj.y, obj.width, obj.height, 'platform_texture')
        //   .setOrigin(0.5)
        //   .setDepth(-10);
        // this.add
        //   .rectangle(obj.x + 18, obj.y - 15, obj.width, obj.height, 0x000000, 0.4)
        //   .setOrigin(0.5)
        //   .setDepth(-11);

        platformRects.push({
          x: obj.x,
          y: obj.y,
          width: obj.width,
          height: obj.height,
        });

        if (obj.x - obj.width / 2 < minX) minX = obj.x - obj.width / 2;
        if (obj.x + obj.width / 2 > maxX) maxX = obj.x + obj.width / 2;
        if (obj.y - obj.height / 2 < minY) minY = obj.y - obj.height / 2;
        if (obj.y + obj.height / 2 > maxY) maxY = obj.y + obj.height / 2;

      } else if (obj.type === 'polygon') {
        polygonDefs.push(obj.vertices);

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

    this.renderUnifiedTerrain(platformRects, polygonDefs, minX, minY, maxX, maxY);

    this.parallaxBg = ParallaxBackground.create(this, {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
      padding: 1200,
    })
      .addLayer(-140, 'nebula_red.png', 0.08, 0.95)
      .addLayer(-130, 'stars_small_1.png', 0.3, 0.9)
      .addLayer(-120, 'stars_big_1.png', 0.55, 1);

    this.initializeLocalEngineIfReady();
  }

  private renderUnifiedTerrain(
    platformRects: PlatformRect[],
    polygons: PolygonVerts[],
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ) {
    const maskGraphics = this.make.graphics();
    maskGraphics.fillStyle(0xffffff, 1);

    for (const rect of platformRects) {
      maskGraphics.fillRect(
        rect.x - rect.width / 2,
        rect.y - rect.height / 2,
        rect.width,
        rect.height,
      );
    }

    for (const vertices of polygons) {
      maskGraphics.beginPath();
      maskGraphics.moveTo(vertices[0].x, vertices[0].y);
      for (let i = 1; i < vertices.length; i++) {
        maskGraphics.lineTo(vertices[i].x, vertices[i].y);
      }
      maskGraphics.closePath();
      maskGraphics.fillPath();
    }

    const geometryMask = new Phaser.Display.Masks.GeometryMask(this, maskGraphics);

    const terrainX = minX - 500;
    const terrainY = minY - 500;
    const terrainWidth = Math.max(1, maxX - minX + 1000);
    const terrainHeight = Math.max(1, maxY - minY + 1000);
    const terrainCenterX = terrainX + terrainWidth / 2;
    const terrainCenterY = terrainY + terrainHeight / 2;

    const terrainFill = this.add
      .rectangle(terrainCenterX, terrainCenterY, terrainWidth, terrainHeight, PLATFORM_FOREGROUND_COLOR, 0.8)
      .setDepth(-10)
      .setOrigin(0.5);
    terrainFill.setMask(geometryMask);

    this.levelRects.push(maskGraphics, terrainFill);
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
      mySprite.shadow?.setPosition(me.x + 8, me.y - 10);
      mySprite.setRotation(me.angle);
    }

    this.sendAccumulatorMs += LOCAL_STEP_MS;
    const isActive =
      this.inputState.move !== 0 || this.inputState.jumpHeld || Math.abs(me.xVel) > 1 || Math.abs(me.yVel) > 1;
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

      const errorX = sample.x - sprite.x;
      const errorY = sample.y - sprite.y;
      const absErrorX = Math.abs(errorX);
      const absErrorY = Math.abs(errorY);

      if (absErrorX > HARD_SNAP_X_PX || absErrorY > HARD_SNAP_Y_PX) {
        sprite.setPosition(sample.x, sample.y);
      } else {
        const xLerp = Phaser.Math.Clamp(0.18 + absErrorX / 42, 0.18, 0.55);
        const yLerp = Phaser.Math.Clamp(0.14 + absErrorY / 36, 0.14, 0.42);

        const nextX = absErrorX <= POSITION_DEADZONE_X_PX ? sprite.x : Phaser.Math.Linear(sprite.x, sample.x, xLerp);
        const nextY = absErrorY <= POSITION_DEADZONE_Y_PX ? sprite.y : Phaser.Math.Linear(sprite.y, sample.y, yLerp);

        sprite.setPosition(nextX, nextY);
      }
      sprite.shadow?.setPosition(sprite.x + 8, sprite.y - 10);
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
      sprite.shadow?.destroy();
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
    const sprite = this.add
      .sprite(x, y, playerId === this.playerId ? 'ball_green' : 'ball_red')
      .setDisplaySize(PLAYER_BALL_DIAMETER_PX, PLAYER_BALL_DIAMETER_PX) as ShadowSprite;
    if (ENABLE_SHADOWS) {
      sprite.shadow = this.add.circle(x + 8, y - 10, 26, 0x000000, 0.4).setDepth(-2);
    }
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

    // Preserved textured polygon rendering for quick restore later:
    // const width = maxX - minX;
    // const height = maxY - minY;
    // const centerX = (minX + maxX) / 2;
    // const centerY = (minY + maxY) / 2;
    // const shadowGraphics = this.add.graphics();
    // shadowGraphics.fillStyle(0x000000, 0.4);
    // shadowGraphics.beginPath();
    // shadowGraphics.moveTo(vertices[0].x + this.shadowOffset.x, vertices[0].y + this.shadowOffset.y);
    // for (let i = 1; i < vertices.length; i++) {
    //   shadowGraphics.lineTo(vertices[i].x + this.shadowOffset.x, vertices[i].y + this.shadowOffset.y);
    // }
    // shadowGraphics.closePath();
    // shadowGraphics.fillPath();
    // shadowGraphics.setDepth(-11);
    // const graphics = this.make.graphics();
    // graphics.fillStyle(0xffffff);
    // graphics.beginPath();
    // graphics.moveTo(vertices[0].x, vertices[0].y);
    // for (let i = 1; i < vertices.length; i++) {
    //   graphics.lineTo(vertices[i].x, vertices[i].y);
    // }
    // graphics.closePath();
    // graphics.fillPath();
    // const mask = new Phaser.Display.Masks.GeometryMask(this, graphics);
    // const texture = this.add.tileSprite(centerX, centerY, width, height, 'platform_texture');
    // texture.setMask(mask);
    // texture.setDepth(-10);
    // return this.add.container(0, 0, [shadowGraphics, texture]);

    const graphics = this.add.graphics();
    graphics.fillStyle(0xffffff, 1);
    graphics.beginPath();
    graphics.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
      graphics.lineTo(vertices[i].x, vertices[i].y);
    }
    graphics.closePath();
    graphics.fillPath();
    graphics.setDepth(-10);

    return this.add.container(0, 0, [graphics]);
  }

  private createFrostedPlatform(
    x: number,
    y: number,
    width: number,
    height: number,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);

    const glow = this.add
      .rectangle(x, y, width + 16, height + 16, PLATFORM_GLOW_COLOR, 0.18)
      .setOrigin(0.5)
      .setDepth(-12);
    glow.setBlendMode(Phaser.BlendModes.ADD);

    const base = this.add
      .rectangle(x, y, width, height, PLATFORM_BASE_COLOR, PLATFORM_BASE_ALPHA)
      .setOrigin(0.5)
      .setDepth(-10);
    base.setBlendMode(Phaser.BlendModes.SCREEN);

    const topStripHeight = Math.min(4, Math.max(2, height * 0.14));
    const topHighlight = this.add
      .rectangle(x, y - height / 2 + topStripHeight / 2, Math.max(0, width - 4), topStripHeight, PLATFORM_TOP_HIGHLIGHT_COLOR, 0.3)
      .setOrigin(0.5)
      .setDepth(-9);

    const bottomStripHeight = Math.min(6, Math.max(3, height * 0.2));
    const bottomShade = this.add
      .rectangle(x, y + height / 2 - bottomStripHeight / 2, Math.max(0, width - 4), bottomStripHeight, PLATFORM_BOTTOM_SHADE_COLOR, 0.22)
      .setOrigin(0.5)
      .setDepth(-9);

    container.add([glow, base, topHighlight, bottomShade]);
    return container;
  }

  private createFrostedPolygon(vertices: Array<{ x: number; y: number }>): Phaser.GameObjects.Container {
    const glow = this.add.graphics();
    glow.fillStyle(PLATFORM_GLOW_COLOR, 0.15);
    glow.beginPath();
    glow.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
      glow.lineTo(vertices[i].x, vertices[i].y);
    }
    glow.closePath();
    glow.fillPath();
    glow.setDepth(-12);
    glow.setBlendMode(Phaser.BlendModes.ADD);

    const base = this.add.graphics();
    base.fillStyle(PLATFORM_BASE_COLOR, PLATFORM_BASE_ALPHA);
    base.beginPath();
    base.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
      base.lineTo(vertices[i].x, vertices[i].y);
    }
    base.closePath();
    base.fillPath();
    base.setDepth(-10);
    base.setBlendMode(Phaser.BlendModes.SCREEN);

    const highlight = this.add.graphics();
    highlight.lineStyle(1, PLATFORM_TOP_HIGHLIGHT_COLOR, 0.24);
    highlight.beginPath();
    highlight.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
      highlight.lineTo(vertices[i].x, vertices[i].y);
    }
    highlight.closePath();
    highlight.strokePath();
    highlight.setDepth(-9);

    return this.add.container(0, 0, [glow, base, highlight]);
  }

  onDestroy() {
    this.inputController.dispose();
    this.parallaxBg?.destroy();
    this.parallaxBg = null;
    this.remoteSmoother.clearAll();
  }
}
