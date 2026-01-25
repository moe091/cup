import Phaser from 'phaser';
import type { LevelDefinition, LevelObject, PlatformDef, PolygonDef, SpawnPointDef } from '@cup/bouncer-shared';
import EditorTool, { ToolName } from './EditorTool';
import SpawnPointTool from './SpawnPointTool';
import PlatformTool from './PlatformTool';
import PolygonTool from './PolygonTool';

type ObjectView = { def: LevelObject; view: Phaser.GameObjects.GameObject };

export class LevelEditorScene extends Phaser.Scene {
  readonly gridSize = 32;
  readonly toolbarWidth = 80;
  private levelName: string;
  private objects: LevelObject[] = [];
  private objectViews: Array<ObjectView> = [];
  private selectedIndex: number | null = null;
  private gridGraphics?: Phaser.GameObjects.Graphics;
  private activeTool: ToolName = 'platform';
  private tools: Record<ToolName, EditorTool> = {
    platform: new PlatformTool(),
    spawnPoint: new SpawnPointTool(),
    polygon: new PolygonTool(),
  };
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;

  constructor(
    levelName: string,
    private containerEl: HTMLElement,
  ) {
    super('level-editor');
    this.levelName = levelName;
  }

  fullscreenListener() {
    const fKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    fKey.on('down', () => {
      this.containerEl.requestFullscreen();
    });
  }

  create() {
    this.fullscreenListener();

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

    if (obj.type === 'polygon') {
      // Convert vertices to flat array for Phaser polygon
      const points = obj.vertices.flatMap((v) => [v.x, v.y]);
      const polygon = this.add.polygon(0, 0, points, 0x4a90e2).setOrigin(0);
      polygon.setStrokeStyle(2, 0x2e5a8a);
      polygon.setDepth(1);
      return polygon;
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

      if (def.type === 'platform') {
        if (this.isPointInPlatform(x, y, def)) {
          this.setSelectedIndex(i);
          return true;
        }
      } else if (def.type === 'polygon') {
        if (this.isPointInPolygon(x, y, def)) {
          this.setSelectedIndex(i);
          return true;
        }
      }
    }

    this.clearSelection();
    return false;
  }

  private isPointInPolygon(x: number, y: number, polygon: PolygonDef) {
    const vertices = polygon.vertices;
    let inside = false;

    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i].x;
      const yi = vertices[i].y;
      const xj = vertices[j].x;
      const yj = vertices[j].y;

      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }

    return inside;
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
    if (!entry) return;

    if (entry.def.type === 'platform') {
      const rect = entry.view as Phaser.GameObjects.Rectangle;
      if (selected) {
        rect.setFillStyle(0xdb2b2b);
        rect.setStrokeStyle(1, 0x8f1f1f);
      } else {
        rect.setFillStyle(0x2f7a4f);
        rect.setStrokeStyle(1, 0x1d4b31);
      }
    } else if (entry.def.type === 'polygon') {
      const poly = entry.view as Phaser.GameObjects.Polygon;
      if (selected) {
        poly.setFillStyle(0xdb2b2b);
        poly.setStrokeStyle(2, 0x8f1f1f);
      } else {
        poly.setFillStyle(0x4a90e2);
        poly.setStrokeStyle(2, 0x2e5a8a);
      }
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
