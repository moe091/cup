import Phaser from 'phaser';
import type { LevelDefinition, LevelObject, PlatformDef, SpawnPointDef } from '@cup/bouncer-shared';

type ToolName = 'platform' | 'spawnPoint';

interface EditorTool {
  name: ToolName;
  enable(scene: LevelEditorScene): void;
  disable(): void;
}

class PlatformTool implements EditorTool {
  name: ToolName = 'platform';
  private scene?: LevelEditorScene;
  private start?: { x: number; y: number };
  private preview?: Phaser.GameObjects.Rectangle;
  private enabled = false;

  private onPointerDown = (pointer: Phaser.Input.Pointer) => {
    if (!this.scene || !this.scene.isPrimaryToolPointer(pointer)) return;
    if (this.scene.isPointerOverToolbar(pointer)) return;

    const start = this.scene.snapWorld(pointer.worldX, pointer.worldY);
    this.start = start;
    this.preview = this.scene.add
      .rectangle(start.x, start.y, this.scene.gridSize, this.scene.gridSize, 0x2f7a4f, 0.5)
      .setOrigin(0.5);
  };

  private onPointerMove = (pointer: Phaser.Input.Pointer) => {
    if (!this.scene || !this.start || !this.preview) return;
    const end = this.scene.snapWorld(pointer.worldX, pointer.worldY);
    const width = Math.max(this.scene.gridSize, Math.abs(end.x - this.start.x));
    const height = Math.max(this.scene.gridSize, Math.abs(end.y - this.start.y));
    const centerX = (this.start.x + end.x) / 2;
    const centerY = (this.start.y + end.y) / 2;

    this.preview.setPosition(centerX, centerY);
    this.preview.setSize(width, height);
  };

  private onPointerUp = (pointer: Phaser.Input.Pointer) => {
    if (!this.scene || !this.start) return;
    if (this.scene.isPointerOverToolbar(pointer)) {
      this.cleanupPreview();
      return;
    }

    const end = this.scene.snapWorld(pointer.worldX, pointer.worldY);
    const width = Math.max(this.scene.gridSize, Math.abs(end.x - this.start.x));
    const height = Math.max(this.scene.gridSize, Math.abs(end.y - this.start.y));
    const centerX = (this.start.x + end.x) / 2;
    const centerY = (this.start.y + end.y) / 2;

    const platform: PlatformDef = {
      type: 'platform',
      name: `platform_${Date.now()}`,
      x: centerX,
      y: centerY,
      width,
      height,
    };

    this.scene.addObject(platform);
    this.cleanupPreview();
  };

  enable(scene: LevelEditorScene) {
    if (this.enabled) return;
    this.enabled = true;
    this.scene = scene;
    scene.input.on('pointerdown', this.onPointerDown);
    scene.input.on('pointermove', this.onPointerMove);
    scene.input.on('pointerup', this.onPointerUp);
  }

  disable() {
    if (!this.scene || !this.enabled) return;
    this.scene.input.off('pointerdown', this.onPointerDown);
    this.scene.input.off('pointermove', this.onPointerMove);
    this.scene.input.off('pointerup', this.onPointerUp);
    this.enabled = false;
    this.cleanupPreview();
    this.scene = undefined;
  }

  private cleanupPreview() {
    this.preview?.destroy();
    this.preview = undefined;
    this.start = undefined;
  }
}

class SpawnPointTool implements EditorTool {
  name: ToolName = 'spawnPoint';
  private scene?: LevelEditorScene;
  private enabled = false;

  private onPointerDown = (pointer: Phaser.Input.Pointer) => {
    if (!this.scene || !this.scene.isPrimaryToolPointer(pointer)) return;
    if (this.scene.isPointerOverToolbar(pointer)) return;

    const pos = this.scene.snapWorld(pointer.worldX, pointer.worldY);
    const spawn: SpawnPointDef = {
      type: 'spawnPoint',
      name: `spawn_${Date.now()}`,
      x: pos.x,
      y: pos.y,
    };

    this.scene.addObject(spawn);
  };

  enable(scene: LevelEditorScene) {
    if (this.enabled) return;
    this.enabled = true;
    this.scene = scene;
    scene.input.on('pointerdown', this.onPointerDown);
  }

  disable() {
    if (!this.scene || !this.enabled) return;
    this.scene.input.off('pointerdown', this.onPointerDown);
    this.enabled = false;
    this.scene = undefined;
  }
}

export class LevelEditorScene extends Phaser.Scene {
  readonly gridSize = 16;
  readonly toolbarWidth = 120;
  private levelName: string;
  private objects: LevelObject[] = [];
  private objectViews: Phaser.GameObjects.GameObject[] = [];
  private gridGraphics?: Phaser.GameObjects.Graphics;
  private activeTool: ToolName = 'platform';
  private tools: Record<ToolName, EditorTool> = {
    platform: new PlatformTool(),
    spawnPoint: new SpawnPointTool(),
  };
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;

  constructor(levelName: string) {
    super('level-editor');
    this.levelName = levelName;
  }

  create() {
    this.cameras.main.setBackgroundColor('#0b0b0b');
    this.cameras.main.setBounds(0, 0, 10000, 10000);
    this.input.mouse?.disableContextMenu();

    this.drawGrid();
    this.tools[this.activeTool].enable(this);
    this.setupCameraControls();
    this.scene.launch('level-editor-ui', { toolbarWidth: this.toolbarWidth });
    this.scene.bringToTop('level-editor-ui');

    this.events.once('destroy', this.onDestroy, this);
  }

  getLevelDefinition(): LevelDefinition {
    return {
      name: this.levelName,
      gridSize: this.gridSize,
      objects: [...this.objects],
    };
  }

  addObject(obj: LevelObject) {
    this.objects.push(obj);
    this.drawObject(obj);
  }

  setLevelName(name: string) {
    this.levelName = name;
  }

  isPointerOverToolbar(pointer: Phaser.Input.Pointer) {
    return pointer.x <= this.toolbarWidth;
  }

  isPrimaryToolPointer(pointer: Phaser.Input.Pointer) {
    return pointer.leftButtonDown() && !(pointer.rightButtonDown() || pointer.middleButtonDown() || pointer.event?.shiftKey);
  }

  snapWorld(x: number, y: number) {
    return {
      x: Math.round(x / this.gridSize) * this.gridSize,
      y: Math.round(y / this.gridSize) * this.gridSize,
    };
  }

  private drawObject(obj: LevelObject) {
    if (obj.type === 'platform') {
      const rect = this.add.rectangle(obj.x, obj.y, obj.width, obj.height, 0x2f7a4f).setOrigin(0.5);
      rect.setStrokeStyle(1, 0x1d4b31);
      rect.setDepth(1);
      this.objectViews.push(rect);
      return;
    }

    if (obj.type === 'spawnPoint') {
      const circle = this.add.circle(obj.x, obj.y, 6, 0xffffff).setOrigin(0.5);
      circle.setDepth(2);
      this.objectViews.push(circle);
    }
  }

  private drawGrid() {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x1f1f1f, 1);

    const max = 10000;
    for (let x = 0; x <= max; x += this.gridSize) {
      graphics.lineBetween(x, 0, x, max);
    }
    for (let y = 0; y <= max; y += this.gridSize) {
      graphics.lineBetween(0, y, max, y);
    }

    graphics.setDepth(-10);
    this.gridGraphics = graphics;
  }

  getActiveTool() {
    return this.activeTool;
  }

  setActiveTool(tool: ToolName) {
    if (this.activeTool === tool) return;
    this.tools[this.activeTool].disable();
    this.activeTool = tool;
    this.tools[this.activeTool].enable(this);
    this.events.emit('tool_changed', this.activeTool);
  }

  private setupCameraControls() {
    const cam = this.cameras.main;
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _go: Phaser.GameObjects.GameObject[], _dx: number, dy: number) => {
      const zoom = Phaser.Math.Clamp(cam.zoom - dy * 0.001, 0.25, 2);
      cam.setZoom(zoom);
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown() || pointer.middleButtonDown() || pointer.event?.shiftKey) {
        this.isPanning = true;
        this.panStartX = pointer.x;
        this.panStartY = pointer.y;
      }
    });

    this.input.on('pointerup', () => {
      this.isPanning = false;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isPanning) return;
      const dx = pointer.x - this.panStartX;
      const dy = pointer.y - this.panStartY;

      cam.scrollX -= dx / cam.zoom;
      cam.scrollY -= dy / cam.zoom;

      this.panStartX = pointer.x;
      this.panStartY = pointer.y;
    });
  }

  private onDestroy() {
    this.tools[this.activeTool].disable();
    this.scene.stop('level-editor-ui');
    this.gridGraphics?.destroy();
    this.objectViews.forEach((obj) => obj.destroy());
    this.objectViews = [];
  }
}
