import { HazardDef } from '@cup/bouncer-shared';
import EditorTool, { ToolName } from './EditorTool';
import { LevelEditorScene } from './LevelEditor';

/**
 * Places the currently-selected hazard (chosen via the picker) at each click.
 * The selected hazard key is set by LevelEditorScene.setSelectedHazard().
 */
export default class HazardTool implements EditorTool {
  name: ToolName = 'hazard';
  private scene?: LevelEditorScene;
  private enabled = false;
  private hazardKey?: string;

  setHazardKey(key: string) {
    this.hazardKey = key;
  }

  private onPointerDown = (pointer: Phaser.Input.Pointer) => {
    if (!this.scene || !this.scene.isPrimaryToolPointer(pointer)) return;
    if (this.scene.isPointerOverToolbar(pointer)) return;
    if (!this.hazardKey) return;

    const pos = this.scene.snapWorld(pointer.worldX, pointer.worldY);
    const hazard: HazardDef = { type: 'hazard', hazardKey: this.hazardKey, x: pos.x, y: pos.y };
    this.scene.addObject(hazard);
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
