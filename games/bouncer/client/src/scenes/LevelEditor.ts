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
    if (end.x === this.start.x) end.x += 32;
    if (end.y === this.start.y) end.y += 32;

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
      x: this.preview?.x || 0,
      y: this.preview?.y || 0,
      width: this.preview?.width || 0,
      height: this.preview?.height || 0,
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
  readonly gridSize = 32;
  readonly toolbarWidth = 80;
  private levelName: string;
  private objects: LevelObject[] = [];
  private objectViews: Array<{ def: LevelObject; view: Phaser.GameObjects.GameObject }> = [];
  private selectedIndex: number | null = null;
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
    this.input.mouse?.disableContextMenu();

    this.drawGrid();
    this.tools[this.activeTool].enable(this);
    this.setupCameraControls();
    this.setupSelectionControls();
    this.scene.launch('level-editor-ui', { toolbarWidth: this.toolbarWidth });
    this.scene.bringToTop('level-editor-ui');

    this.events.once('destroy', this.onDestroy, this);

    this.drawGrid();
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
    const view = this.drawObject(obj);
    if (view) this.objectViews.push({ def: obj, view });
  }

  setLevelName(name: string) {
    this.levelName = name;
  }

  async loadLevel(level: LevelDefinition) {
    this.setLevelName(level.name);
    this.applyLevel(level);
  }

  private clearLevel() {
    this.objects = [];
    this.objectViews.forEach(({ view }) => view.destroy());
    this.objectViews = [];
    this.clearSelection();
  }

  private applyLevel(def: LevelDefinition) {
    this.clearLevel();

    // If you want grid size to be optional, ignore or use def.gridSize later
    for (const obj of def.objects) {
      this.objects.push(obj);
      const view = this.drawObject(obj);
      if (view) this.objectViews.push({ def: obj, view });
    }

    this.cameras.main.setScroll(0, 0);
    this.drawGrid();
  }

  isPointerOverToolbar(pointer: Phaser.Input.Pointer) {
    return pointer.x <= this.toolbarWidth;
  }

  isPrimaryToolPointer(pointer: Phaser.Input.Pointer) {
    return (
      pointer.leftButtonDown() && !(pointer.rightButtonDown() || pointer.middleButtonDown() || pointer.event?.shiftKey)
    );
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
      return rect;
    }

    if (obj.type === 'spawnPoint') {
      const circle = this.add.circle(obj.x, obj.y, 6, 0xffffff).setOrigin(0.5);
      circle.setDepth(2);
      return circle;
    }
  }

  private drawGrid() {
    const g = this.gridGraphics || this.add.graphics();
    this.gridGraphics = g;

    const view = this.cameras.main.worldView;
    const startX = Math.floor((view.x - 200) / this.gridSize) * this.gridSize;
    const endX = Math.ceil((view.x + 200 + view.width) / this.gridSize) * this.gridSize;
    const startY = Math.floor((view.y - 200) / this.gridSize) * this.gridSize;
    const endY = Math.ceil((view.y + 200 + view.height) / this.gridSize) * this.gridSize;

    g.clear();
    g.lineStyle(1, 0x1f1f1f);

    for (let x = startX; x <= endX; x += this.gridSize) g.lineBetween(x, startY, x, endY);
    for (let y = startY; y <= endY; y += this.gridSize) g.lineBetween(startX, y, endX, y);

    g.setDepth(-10);
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
    this.input.on(
      'wheel',
      (_pointer: Phaser.Input.Pointer, _go: Phaser.GameObjects.GameObject[], _dx: number, dy: number) => {
        const zoom = Phaser.Math.Clamp(cam.zoom - dy * 0.001, 0.2, 5);
        cam.setZoom(zoom);
        this.drawGrid();
      },
    );

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown() && this.trySelectAt(pointer)) return;
      if (pointer.middleButtonDown() || pointer.event?.shiftKey) {
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
      this.drawGrid();
    });
  }

  private onDestroy() {
    this.tools[this.activeTool].disable();
    this.scene.stop('level-editor-ui');
    this.gridGraphics?.destroy();
    this.objectViews.forEach(({ view }) => view.destroy());
    this.objectViews = [];
  }

  private setupSelectionControls() {
    this.input.keyboard?.on('keydown-BACKSPACE', () => this.deleteSelected());
  }

  private trySelectAt(pointer: Phaser.Input.Pointer) {
    if (this.isPointerOverToolbar(pointer)) return false;
    const x = pointer.worldX;
    const y = pointer.worldY;

    for (let i = this.objectViews.length - 1; i >= 0; i -= 1) {
      const { def } = this.objectViews[i];
      if (def.type !== 'platform') continue;
      if (this.isPointInPlatform(x, y, def)) {
        this.setSelectedIndex(i);
        return true;
      }
    }

    this.clearSelection();
    return false;
  }

  private isPointInPlatform(x: number, y: number, platform: PlatformDef) {
    const halfW = platform.width / 2;
    const halfH = platform.height / 2;
    return x >= platform.x - halfW && x <= platform.x + halfW && y >= platform.y - halfH && y <= platform.y + halfH;
  }

  private setSelectedIndex(index: number) {
    if (this.selectedIndex === index) return;
    this.clearSelection();
    this.selectedIndex = index;
    this.updateSelectionHighlight(true);
  }

  private clearSelection() {
    if (this.selectedIndex === null) return;
    this.updateSelectionHighlight(false);
    this.selectedIndex = null;
  }

  private updateSelectionHighlight(selected: boolean) {
    if (this.selectedIndex === null) return;
    const entry = this.objectViews[this.selectedIndex];
    if (!entry || entry.def.type !== 'platform') return;
    const rect = entry.view as Phaser.GameObjects.Rectangle;
    if (selected) {
      rect.setFillStyle(0xdb2b2b);
      rect.setStrokeStyle(1, 0x8f1f1f);
    } else {
      rect.setFillStyle(0x2f7a4f);
      rect.setStrokeStyle(1, 0x1d4b31);
    }
  }

  private deleteSelected() {
    if (this.selectedIndex === null) return;
    const { view } = this.objectViews[this.selectedIndex];
    view.destroy();
    this.objectViews.splice(this.selectedIndex, 1);
    this.objects.splice(this.selectedIndex, 1);
    this.selectedIndex = null;
  }
}
