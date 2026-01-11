import Phaser from 'phaser';
import type { LevelDefinition } from '@cup/bouncer-shared';
import { LevelEditorScene } from './scenes/LevelEditor';
import { LevelEditorUiScene } from './scenes/LevelEditorUi';

export class BouncerEditorClient {
  private game: Phaser.Game;
  private editorScene: LevelEditorScene;
  private editorUiScene: LevelEditorUiScene;

  constructor(containerEl: HTMLElement, levelName: string) {
    this.editorScene = new LevelEditorScene(levelName);
    this.editorUiScene = new LevelEditorUiScene();
    this.game = this.createPhaserGame(containerEl, 960, 540);
  }

  private createPhaserGame(containerEl: HTMLElement, width: number, height: number): Phaser.Game {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width,
      height,
      parent: containerEl,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [this.editorScene, this.editorUiScene],
    };

    return new Phaser.Game(config);
  }

  destroy() {
    this.game.destroy(true);
  }

  getLevelDefinition(): LevelDefinition {
    return this.editorScene.getLevelDefinition();
  }
}
