import { LevelEditorScene } from './LevelEditor';

export type ToolName = 'platform' | 'spawnPoint' | 'polygon' | 'goal' | 'checkpoint' | 'hazard';

export default interface EditorTool {
  name: ToolName;
  enable(scene: LevelEditorScene): void;
  disable(): void;
}
