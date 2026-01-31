import Phaser from 'phaser';
import type { LevelEditorScene } from './LevelEditor';
import { ToolName } from './EditorTool';

export class LevelEditorUiScene extends Phaser.Scene {
  private toolbarWidth = 120;
  private toolbarItems: Array<{
    tool: ToolName;
    bg: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
  }> = [];
  private editor?: LevelEditorScene;

  constructor() {
    super('level-editor-ui');
  }

  init(data: { toolbarWidth?: number }) {
    if (data?.toolbarWidth) {
      this.toolbarWidth = data.toolbarWidth;
    }
  }

  create() {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    this.cameras.main.setZoom(1);

    this.editor = this.scene.get('level-editor') as LevelEditorScene | undefined;
    if (!this.editor) return;

    this.createToolbar();
    this.updateToolbarHighlight(this.editor.getActiveTool());
    this.editor.events.on('tool_changed', this.updateToolbarHighlight, this);

    this.events.once('shutdown', () => {
      this.editor?.events.off('tool_changed', this.updateToolbarHighlight, this);
    });
  }

  private createToolbar() {
    const toolbar = this.add.rectangle(0, 0, this.toolbarWidth, this.scale.height, 0x111111).setOrigin(0, 0);
    toolbar.setDepth(100);

    const items: Array<{ tool: ToolName; label: string }> = [
      { tool: 'platform', label: 'Plat' },
      { tool: 'spawnPoint', label: 'Spawn' },
      { tool: 'polygon', label: 'Poly' },
      { tool: 'goal', label: 'Goal' },
    ];

    const startY = 40;
    const gap = 70;
    items.forEach((item, index) => {
      const y = startY + index * gap;
      const bg = this.add.rectangle(this.toolbarWidth / 2, y, 90, 40, 0x1c1c1c).setOrigin(0.5);
      bg.setDepth(101);
      bg.setInteractive({ useHandCursor: true });

      const label = this.add.text(this.toolbarWidth / 2, y, item.label, {
        fontSize: '14px',
        color: '#ffffff',
      });
      label.setOrigin(0.5);
      label.setDepth(102);

      bg.on('pointerup', () => this.editor?.setActiveTool(item.tool));

      this.toolbarItems.push({ tool: item.tool, bg, label });
    });
  }

  private updateToolbarHighlight(activeTool: ToolName) {
    this.toolbarItems.forEach((item) => {
      if (item.tool === activeTool) {
        item.bg.setFillStyle(0x2f7a4f);
        item.label.setColor('#eafff3');
      } else {
        item.bg.setFillStyle(0x1c1c1c);
        item.label.setColor('#ffffff');
      }
    });
  }
}
