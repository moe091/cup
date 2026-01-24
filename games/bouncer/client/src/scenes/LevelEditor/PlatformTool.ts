import { PlatformDef } from "@cup/bouncer-shared";
import EditorTool, { ToolName } from "./EditorTool";
import { LevelEditorScene } from "./LevelEditor";

export default class PlatformTool implements EditorTool {
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