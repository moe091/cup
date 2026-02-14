import { GoalDef } from '@cup/bouncer-shared';
import EditorTool, { ToolName } from './EditorTool';
import { LevelEditorScene } from './LevelEditor';

export default class GoalTool implements EditorTool {
  name: ToolName = 'goal';
  private scene?: LevelEditorScene;
  private enabled = false;

  private onPointerDown = (pointer: Phaser.Input.Pointer) => {
    if (!this.scene || !this.scene.isPrimaryToolPointer(pointer)) return;
    if (this.scene.isPointerOverToolbar(pointer)) return;

    const pos = this.scene.snapWorld(pointer.worldX, pointer.worldY);
    const goal: GoalDef = {
      type: 'goal',
      name: `goal_${Date.now()}`,
      x: pos.x,
      y: pos.y,
      size: 30,
    };

    this.scene.addObject(goal);
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
