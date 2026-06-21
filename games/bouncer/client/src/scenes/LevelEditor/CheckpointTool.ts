import { CheckpointDef } from '@cup/bouncer-shared';
import EditorTool, { ToolName } from './EditorTool';
import { LevelEditorScene } from './LevelEditor';

export const CHECKPOINT_RECT_COLOR = 0x33cc66;
export const CHECKPOINT_RESPAWN_COLOR = 0x1f9e3f;

/**
 * Two-phase tool: first drag out the checkpoint rectangle (like the platform
 * tool), then click once more to place its respawn point — only then is the
 * checkpoint committed. A green cursor circle previews the respawn placement.
 */
export default class CheckpointTool implements EditorTool {
  name: ToolName = 'checkpoint';
  private scene?: LevelEditorScene;
  private enabled = false;
  private mode: 'rect' | 'respawn' = 'rect';
  private start?: { x: number; y: number };
  private preview?: Phaser.GameObjects.Rectangle;
  private pendingRect?: { x: number; y: number; width: number; height: number };
  private respawnCursor?: Phaser.GameObjects.Arc;

  private onPointerDown = (pointer: Phaser.Input.Pointer) => {
    if (!this.scene || !this.scene.isPrimaryToolPointer(pointer)) return;
    if (this.scene.isPointerOverToolbar(pointer)) return;

    if (this.mode === 'rect') {
      const start = this.scene.snapWorld(pointer.worldX, pointer.worldY);
      this.start = start;
      this.preview = this.scene.add
        .rectangle(start.x, start.y, this.scene.gridSize, this.scene.gridSize, CHECKPOINT_RECT_COLOR, 0.35)
        .setOrigin(0.5);
      this.preview.setDepth(1);
      return;
    }

    // respawn phase: this click places the respawn point and commits the checkpoint
    if (!this.pendingRect) {
      this.reset();
      return;
    }
    const pos = this.scene.snapWorld(pointer.worldX, pointer.worldY);
    const checkpoint: CheckpointDef = {
      type: 'checkpoint',
      name: `checkpoint_${Date.now()}`,
      rect: { ...this.pendingRect },
      respawn: { x: pos.x, y: pos.y },
    };
    this.scene.addObject(checkpoint);
    this.reset();
  };

  private onPointerMove = (pointer: Phaser.Input.Pointer) => {
    if (!this.scene) return;

    if (this.mode === 'rect') {
      if (!this.start || !this.preview) return;
      const end = this.scene.snapWorld(pointer.worldX, pointer.worldY);
      if (end.x === this.start.x) end.x += 32;
      if (end.y === this.start.y) end.y += 32;

      const width = Math.max(this.scene.gridSize, Math.abs(end.x - this.start.x));
      const height = Math.max(this.scene.gridSize, Math.abs(end.y - this.start.y));
      this.preview.setPosition((this.start.x + end.x) / 2, (this.start.y + end.y) / 2);
      this.preview.setSize(width, height);
      return;
    }

    if (this.respawnCursor) {
      const pos = this.scene.snapWorld(pointer.worldX, pointer.worldY);
      this.respawnCursor.setPosition(pos.x, pos.y);
    }
  };

  private onPointerUp = (pointer: Phaser.Input.Pointer) => {
    if (!this.scene || this.mode !== 'rect' || !this.start) return;
    if (this.scene.isPointerOverToolbar(pointer)) {
      this.reset();
      return;
    }

    // Lock in the rectangle and move to respawn-placement phase (keep it visible).
    this.pendingRect = {
      x: this.preview?.x ?? 0,
      y: this.preview?.y ?? 0,
      width: this.preview?.width ?? this.scene.gridSize,
      height: this.preview?.height ?? this.scene.gridSize,
    };
    this.mode = 'respawn';
    this.start = undefined;

    const pos = this.scene.snapWorld(pointer.worldX, pointer.worldY);
    this.respawnCursor = this.scene.add.circle(pos.x, pos.y, 12, CHECKPOINT_RESPAWN_COLOR, 0.8).setOrigin(0.5);
    this.respawnCursor.setDepth(3);
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
    this.reset();
    this.scene = undefined;
  }

  // Discards any in-progress checkpoint and returns to rectangle-drawing phase.
  private reset() {
    this.preview?.destroy();
    this.preview = undefined;
    this.respawnCursor?.destroy();
    this.respawnCursor = undefined;
    this.start = undefined;
    this.pendingRect = undefined;
    this.mode = 'rect';
  }
}
