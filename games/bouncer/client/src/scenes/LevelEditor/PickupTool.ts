import { PickupDef } from '@cup/bouncer-shared';
import EditorTool, { ToolName } from './EditorTool';
import { LevelEditorScene } from './LevelEditor';

/**
 * Places the currently-selected pickup (chosen via the picker) at each click.
 * The selected pickup key is set by LevelEditorScene.setSelectedPickup().
 */
export default class PickupTool implements EditorTool {
  name: ToolName = 'pickup';
  private scene?: LevelEditorScene;
  private enabled = false;
  private pickupKey?: string;

  setPickupKey(key: string) {
    this.pickupKey = key;
  }

  private onPointerDown = (pointer: Phaser.Input.Pointer) => {
    if (!this.scene || !this.scene.isPrimaryToolPointer(pointer)) return;
    if (this.scene.isPointerOverToolbar(pointer)) return;
    if (!this.pickupKey) return;

    const pos = this.scene.snapWorld(pointer.worldX, pointer.worldY);
    const pickup: PickupDef = { type: 'pickup', pickupKey: this.pickupKey, x: pos.x, y: pos.y };
    this.scene.addObject(pickup);
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
