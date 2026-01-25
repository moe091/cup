import { LevelEditorScene } from './LevelEditor';

export type ToolName = 'platform' | 'spawnPoint' | 'polygon';

export default interface EditorTool {
  name: ToolName;
  enable(scene: LevelEditorScene): void;
  disable(): void;
}
