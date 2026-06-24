import Phaser from 'phaser';
import type {
  LevelDefinition,
  LevelObject,
  PlatformDef,
  PolygonDef,
  SpawnPointDef,
  CheckpointDef,
  HazardDef,
  HazardCatalog,
  PickupDef,
} from '@cup/bouncer-shared';
import { resolveHazardBody, PICKUP_CATALOG } from '@cup/bouncer-shared';
import EditorTool, { ToolName } from './EditorTool';
import SpawnPointTool from './SpawnPointTool';
import PlatformTool from './PlatformTool';
import PolygonTool from './PolygonTool';
import GoalTool from './GoalTool';
import CheckpointTool, { CHECKPOINT_RECT_COLOR, CHECKPOINT_RESPAWN_COLOR } from './CheckpointTool';
import HazardTool from './HazardTool';
import PickupTool from './PickupTool';

const PLATFORM_FILL = 0x5aa9e6;
const PLATFORM_STROKE = 0x2e6da4;
const SPAWN_RADIUS = 26;

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
    goal: new GoalTool(),
    checkpoint: new CheckpointTool(),
    hazard: new HazardTool(),
    pickup: new PickupTool(),
  };
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private hazardCatalog: HazardCatalog;
  // Right-click-drag to move the selected object. dragOriginalDef is the def at
  // drag start (never mutated); each move re-derives from it + a grid-snapped delta.
  private isDraggingObject = false;
  private dragStartWorld = { x: 0, y: 0 };
  private dragOriginalDef: LevelObject | null = null;

  constructor(
    levelName: string,
    private containerEl: HTMLElement,
    hazardCatalog: HazardCatalog = {},
  ) {
    super('level-editor');
    this.levelName = levelName;
    this.hazardCatalog = hazardCatalog;
  }

  preload() {
    // Load each hazard's sprite under its catalog key so placed hazards + the
    // picker can render it. Textures are game-global (shared with the UI scene).
    for (const entry of Object.values(this.hazardCatalog)) {
      this.load.image(entry.key, entry.spritePath);
    }
    // Load pickup icons under their catalog key for the picker and placed sprites.
    for (const entry of Object.values(PICKUP_CATALOG)) {
      this.load.image(entry.key, entry.iconPath);
    }
  }

  getHazardCatalog(): HazardCatalog {
    return this.hazardCatalog;
  }

  /** Selects a hazard from the picker and switches to the hazard tool. */
  setSelectedHazard(key: string) {
    (this.tools.hazard as HazardTool).setHazardKey(key);
    this.setActiveTool('hazard');
  }

  /** Selects a pickup from the picker and switches to the pickup tool. */
  setSelectedPickup(key: string) {
    (this.tools.pickup as PickupTool).setPickupKey(key);
    this.setActiveTool('pickup');
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
      const rect = this.add.rectangle(obj.x, obj.y, obj.width, obj.height, PLATFORM_FILL).setOrigin(0.5);
      rect.setStrokeStyle(1, PLATFORM_STROKE);
      rect.setDepth(1);
      return rect;
    }

    if (obj.type === 'checkpoint') {
      // Container holds the sensor rect (list[0], used for selection highlight)
      // plus the respawn marker.
      const rect = this.add
        .rectangle(obj.rect.x, obj.rect.y, obj.rect.width, obj.rect.height, CHECKPOINT_RECT_COLOR, 0.35)
        .setOrigin(0.5);
      rect.setStrokeStyle(1, CHECKPOINT_RESPAWN_COLOR);
      const respawn = this.add.circle(obj.respawn.x, obj.respawn.y, 12, CHECKPOINT_RESPAWN_COLOR).setOrigin(0.5);
      const container = this.add.container(0, 0, [rect, respawn]);
      container.setDepth(1);
      return container;
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
      const circle = this.add.circle(obj.x, obj.y, SPAWN_RADIUS, 0xffffff).setOrigin(0.5);
      circle.setDepth(2);
      return circle;
    }

    if (obj.type === 'goal') {
      const circle = this.add.circle(obj.x, obj.y, obj.size, 0x22dd29).setOrigin(0.5);
      circle.setDepth(2);
      return circle;
    }

    if (obj.type === 'hazard') {
      return this.drawHazard(obj);
    }

    if (obj.type === 'pickup') {
      return this.drawPickup(obj);
    }
  }

  // Container = main visual (sprite/fallback) at list[0] + red body overlay for
  // collision calibration. The overlay is drawn on top (semi-transparent +
  // outline) so it stays visible over an opaque sprite.
  private drawHazard(obj: HazardDef): Phaser.GameObjects.Container {
    const entry = this.hazardCatalog[obj.hazardKey];
    const container = this.add.container(0, 0);

    if (entry && this.textures.exists(entry.key)) {
      const sprite = this.add
        .image(obj.x, obj.y, entry.key)
        .setDisplaySize(entry.spriteWidth, entry.spriteHeight)
        .setOrigin(0.5);
      container.add(sprite);
    } else {
      const placeholder = this.add.rectangle(obj.x, obj.y, 40, 40, 0x888888, 0.6).setOrigin(0.5);
      container.add(placeholder);
    }

    if (entry) {
      const body = resolveHazardBody(entry);
      const bx = obj.x + body.offsetX;
      const by = obj.y + body.offsetY;
      if (body.shape === 'circle') {
        const c = this.add.circle(bx, by, body.radius, 0xff0000, 0.2);
        c.setStrokeStyle(1.5, 0xff3030, 0.9);
        container.add(c);
      } else {
        const r = this.add.rectangle(bx, by, body.width, body.height, 0xff0000, 0.2).setOrigin(0.5);
        r.setStrokeStyle(1.5, 0xff3030, 0.9);
        container.add(r);
      }
    }

    container.setDepth(2);
    return container;
  }

  private drawPickup(obj: PickupDef): Phaser.GameObjects.Container {
    const entry = PICKUP_CATALOG[obj.pickupKey];
    const container = this.add.container(0, 0);
    const size = 52;

    if (entry && this.textures.exists(entry.key)) {
      const sprite = this.add.image(obj.x, obj.y, entry.key).setDisplaySize(size, size).setOrigin(0.5);
      container.add(sprite);
    } else {
      const circle = this.add.circle(obj.x, obj.y, size / 2, entry?.color ?? 0x888888);
      container.add(circle);
    }

    // Label below the sprite showing the pickup type.
    const label = this.add
      .text(obj.x, obj.y + size / 2 + 8, entry?.displayName ?? obj.pickupKey, {
        fontSize: '13px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0);
    container.add(label);
    container.setDepth(2);
    return container;
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
      if (pointer.rightButtonDown()) {
        // Right-click selects; if something got selected, start dragging it.
        if (this.trySelectAt(pointer)) this.beginObjectDrag(pointer);
        return;
      }
      if (pointer.middleButtonDown() || pointer.event?.shiftKey) {
        this.isPanning = true;
        this.panStartX = pointer.x;
        this.panStartY = pointer.y;
      }
    });

    this.input.on('pointerup', () => {
      this.isPanning = false;
      this.isDraggingObject = false;
      this.dragOriginalDef = null;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDraggingObject) {
        this.updateObjectDrag(pointer);
        return;
      }
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

  private beginObjectDrag(pointer: Phaser.Input.Pointer) {
    if (this.selectedIndex === null) return;
    this.isDraggingObject = true;
    this.dragStartWorld = { x: pointer.worldX, y: pointer.worldY };
    // Capture the original def; we never mutate it, so totals stay drift-free.
    this.dragOriginalDef = this.objects[this.selectedIndex];
  }

  private updateObjectDrag(pointer: Phaser.Input.Pointer) {
    if (this.selectedIndex === null || !this.dragOriginalDef) return;

    let dx = pointer.worldX - this.dragStartWorld.x;
    let dy = pointer.worldY - this.dragStartWorld.y;

    // Free movement by default; hold Shift to snap the object's anchor to the grid.
    if (pointer.event?.shiftKey) {
      const anchor = this.getObjectAnchor(this.dragOriginalDef);
      const snapped = this.snapWorld(anchor.x + dx, anchor.y + dy);
      dx = snapped.x - anchor.x;
      dy = snapped.y - anchor.y;
    }

    const moved = this.translateObject(this.dragOriginalDef, dx, dy);
    this.objects[this.selectedIndex] = moved;

    // Redraw the view at the new position and keep it highlighted.
    this.objectViews[this.selectedIndex].view.destroy();
    const view = this.drawObject(moved);
    if (view) {
      this.objectViews[this.selectedIndex] = { def: moved, view };
      this.updateSelectionHighlight(true);
    }
  }

  // Representative point used for grid-snapping a drag (per object type).
  private getObjectAnchor(def: LevelObject): { x: number; y: number } {
    switch (def.type) {
      case 'platform':
      case 'spawnPoint':
      case 'goal':
      case 'hazard':
      case 'pickup':
        return { x: def.x, y: def.y };
      case 'polygon':
        return def.vertices[0] ?? { x: 0, y: 0 };
      case 'checkpoint':
        return { x: def.rect.x, y: def.rect.y };
    }
  }

  private translateObject(def: LevelObject, dx: number, dy: number): LevelObject {
    switch (def.type) {
      case 'platform':
      case 'spawnPoint':
      case 'goal':
      case 'hazard':
      case 'pickup':
        return { ...def, x: def.x + dx, y: def.y + dy };
      case 'polygon':
        return { ...def, vertices: def.vertices.map((v) => ({ x: v.x + dx, y: v.y + dy })) };
      case 'checkpoint':
        return {
          ...def,
          rect: { ...def.rect, x: def.rect.x + dx, y: def.rect.y + dy },
          respawn: { x: def.respawn.x + dx, y: def.respawn.y + dy },
        };
    }
  }

  private onDestroy() {
    this.tools[this.activeTool].disable();
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
      } else if (def.type === 'checkpoint') {
        if (this.isPointInCheckpointRect(x, y, def)) {
          this.setSelectedIndex(i);
          return true;
        }
      } else if (def.type === 'hazard') {
        if (this.isPointInHazard(x, y, def)) {
          this.setSelectedIndex(i);
          return true;
        }
      } else if (def.type === 'pickup') {
        if (this.isPointInCircle(x, y, def.x, def.y, 32)) {
          this.setSelectedIndex(i);
          return true;
        }
      } else if (def.type === 'spawnPoint') {
        if (this.isPointInCircle(x, y, def.x, def.y, SPAWN_RADIUS)) {
          this.setSelectedIndex(i);
          return true;
        }
      } else if (def.type === 'goal') {
        if (this.isPointInCircle(x, y, def.x, def.y, def.size)) {
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

  private isPointInCheckpointRect(x: number, y: number, checkpoint: CheckpointDef) {
    const { x: cx, y: cy, width, height } = checkpoint.rect;
    const halfW = width / 2;
    const halfH = height / 2;
    return x >= cx - halfW && x <= cx + halfW && y >= cy - halfH && y <= cy + halfH;
  }

  private isPointInHazard(x: number, y: number, hazard: HazardDef) {
    const entry = this.hazardCatalog[hazard.hazardKey];
    const halfW = (entry?.spriteWidth ?? 40) / 2;
    const halfH = (entry?.spriteHeight ?? 40) / 2;
    return x >= hazard.x - halfW && x <= hazard.x + halfW && y >= hazard.y - halfH && y <= hazard.y + halfH;
  }

  private isPointInCircle(x: number, y: number, cx: number, cy: number, radius: number) {
    const ddx = x - cx;
    const ddy = y - cy;
    return ddx * ddx + ddy * ddy <= radius * radius;
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
        rect.setFillStyle(PLATFORM_FILL);
        rect.setStrokeStyle(1, PLATFORM_STROKE);
      }
    } else if (entry.def.type === 'checkpoint') {
      const container = entry.view as Phaser.GameObjects.Container;
      const rect = container.list[0] as Phaser.GameObjects.Rectangle;
      if (selected) {
        rect.setFillStyle(0xdb2b2b, 0.45);
        rect.setStrokeStyle(1, 0x8f1f1f);
      } else {
        rect.setFillStyle(CHECKPOINT_RECT_COLOR, 0.35);
        rect.setStrokeStyle(1, CHECKPOINT_RESPAWN_COLOR);
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
    } else if (entry.def.type === 'hazard') {
      const main = (entry.view as Phaser.GameObjects.Container).list[0];
      if (main instanceof Phaser.GameObjects.Image) {
        if (selected) main.setTint(0xff7777);
        else main.clearTint();
      } else if (main instanceof Phaser.GameObjects.Rectangle) {
        main.setFillStyle(selected ? 0xdb2b2b : 0x888888, selected ? 0.85 : 0.6);
      }
    } else if (entry.def.type === 'pickup') {
      const main = (entry.view as Phaser.GameObjects.Container).list[0];
      if (main instanceof Phaser.GameObjects.Image) {
        if (selected) main.setTint(0xff7777);
        else main.clearTint();
      } else if (main instanceof Phaser.GameObjects.Arc) {
        const entry2 = PICKUP_CATALOG[(entry.def as PickupDef).pickupKey];
        main.setFillStyle(selected ? 0xdb2b2b : (entry2?.color ?? 0x888888));
      }
    } else if (entry.def.type === 'spawnPoint') {
      (entry.view as Phaser.GameObjects.Arc).setFillStyle(selected ? 0xdb2b2b : 0xffffff);
    } else if (entry.def.type === 'goal') {
      (entry.view as Phaser.GameObjects.Arc).setFillStyle(selected ? 0xdb2b2b : 0x22dd29);
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
