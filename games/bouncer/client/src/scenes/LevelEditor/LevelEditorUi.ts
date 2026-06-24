import Phaser from 'phaser';
import type { LevelEditorScene } from './LevelEditor';
import { ToolName } from './EditorTool';
import { PICKUP_CATALOG } from '@cup/bouncer-shared';

export class LevelEditorUiScene extends Phaser.Scene {
  private toolbarWidth = 120;
  private toolbarItems: Array<{
    tool: ToolName;
    bg: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
  }> = [];
  private editor?: LevelEditorScene;
  private hazardPicker?: Phaser.GameObjects.Container;
  private pickupPicker?: Phaser.GameObjects.Container;

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
      this.closeHazardPicker();
      this.closePickupPicker();
    });
  }

  private toggleHazardPicker() {
    if (this.hazardPicker) {
      this.closeHazardPicker();
    } else {
      this.openHazardPicker();
    }
  }

  private closeHazardPicker() {
    this.hazardPicker?.destroy(true);
    this.hazardPicker = undefined;
  }

  private togglePickupPicker() {
    if (this.pickupPicker) {
      this.closePickupPicker();
    } else {
      this.openPickupPicker();
    }
  }

  private closePickupPicker() {
    this.pickupPicker?.destroy(true);
    this.pickupPicker = undefined;
  }

  private openPickupPicker() {
    if (!this.editor) return;
    const entries = Object.values(PICKUP_CATALOG);

    const w = this.scale.width;
    const h = this.scale.height;
    const areaX = this.toolbarWidth + (w - this.toolbarWidth) / 2;
    const cy = h / 2;
    const panelW = Math.min(640, w - this.toolbarWidth - 40);
    const panelH = Math.min(460, h - 40);

    const container = this.add.container(0, 0).setDepth(500);

    const backdrop = this.add.rectangle(w / 2, cy, w, h, 0x000000, 0.5).setInteractive();
    backdrop.on('pointerup', () => this.closePickupPicker());

    const panel = this.add.rectangle(areaX, cy, panelW, panelH, 0x161616, 0.98).setInteractive();
    panel.setStrokeStyle(2, 0x333333);

    const title = this.add
      .text(areaX, cy - panelH / 2 + 22, 'Select Pickup', { fontSize: '18px', color: '#ffffff' })
      .setOrigin(0.5);

    container.add([backdrop, panel, title]);

    const cols = 4;
    const cell = 130;
    const visibleCols = Math.min(cols, Math.max(1, entries.length));
    const startX = areaX - (visibleCols * cell) / 2 + cell / 2;
    const startY = cy - panelH / 2 + 90;

    entries.forEach((entry, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * cell;
      const y = startY + row * cell;

      const itemBg = this.add
        .rectangle(x, y, cell - 14, cell - 14, 0x222222)
        .setStrokeStyle(1, 0x444444)
        .setInteractive({ useHandCursor: true });

      let icon: Phaser.GameObjects.GameObject;
      if (this.textures.exists(entry.key)) {
        const maxDim = 72;
        const scale = Math.min(maxDim / entry.spriteWidth, maxDim / entry.spriteHeight, 1);
        icon = this.add
          .image(x, y - 12, entry.key)
          .setDisplaySize(entry.spriteWidth * scale, entry.spriteHeight * scale)
          .setOrigin(0.5);
      } else {
        icon = this.add.circle(x, y - 12, 32, entry.color).setOrigin(0.5);
      }

      const label = this.add
        .text(x, y + (cell - 14) / 2 - 16, entry.displayName, { fontSize: '12px', color: '#dddddd' })
        .setOrigin(0.5);

      itemBg.on('pointerup', () => {
        this.editor?.setSelectedPickup(entry.key);
        this.closePickupPicker();
      });

      container.add([itemBg, icon, label]);
    });

    this.pickupPicker = container;
  }

  private openHazardPicker() {
    if (!this.editor) return;
    const entries = Object.values(this.editor.getHazardCatalog());

    const w = this.scale.width;
    const h = this.scale.height;
    const areaX = this.toolbarWidth + (w - this.toolbarWidth) / 2; // center of the non-toolbar area
    const cy = h / 2;
    const panelW = Math.min(640, w - this.toolbarWidth - 40);
    const panelH = Math.min(460, h - 40);

    const container = this.add.container(0, 0).setDepth(500);

    const backdrop = this.add.rectangle(w / 2, cy, w, h, 0x000000, 0.5).setInteractive();
    backdrop.on('pointerup', () => this.closeHazardPicker());

    const panel = this.add.rectangle(areaX, cy, panelW, panelH, 0x161616, 0.98).setInteractive();
    panel.setStrokeStyle(2, 0x333333);

    const title = this.add
      .text(areaX, cy - panelH / 2 + 22, 'Select Hazard', { fontSize: '18px', color: '#ffffff' })
      .setOrigin(0.5);

    container.add([backdrop, panel, title]);

    if (entries.length === 0) {
      const empty = this.add
        .text(areaX, cy, 'No hazards in hazards.json', { fontSize: '14px', color: '#aaaaaa' })
        .setOrigin(0.5);
      container.add(empty);
    }

    const cols = 4;
    const cell = 130;
    const visibleCols = Math.min(cols, Math.max(1, entries.length));
    const startX = areaX - (visibleCols * cell) / 2 + cell / 2;
    const startY = cy - panelH / 2 + 90;

    entries.forEach((entry, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * cell;
      const y = startY + row * cell;

      const itemBg = this.add
        .rectangle(x, y, cell - 14, cell - 14, 0x222222)
        .setStrokeStyle(1, 0x444444)
        .setInteractive({ useHandCursor: true });

      let icon: Phaser.GameObjects.GameObject;
      if (this.textures.exists(entry.key)) {
        const maxDim = 72;
        const scale = Math.min(maxDim / entry.spriteWidth, maxDim / entry.spriteHeight, 1);
        icon = this.add
          .image(x, y - 12, entry.key)
          .setDisplaySize(entry.spriteWidth * scale, entry.spriteHeight * scale)
          .setOrigin(0.5);
      } else {
        icon = this.add.rectangle(x, y - 12, 60, 60, 0x555555).setOrigin(0.5);
      }

      const label = this.add
        .text(x, y + (cell - 14) / 2 - 16, entry.displayName, { fontSize: '12px', color: '#dddddd' })
        .setOrigin(0.5);

      itemBg.on('pointerup', () => {
        this.editor?.setSelectedHazard(entry.key);
        this.closeHazardPicker();
      });

      container.add([itemBg, icon, label]);
    });

    this.hazardPicker = container;
  }

  private createToolbar() {
    const toolbar = this.add.rectangle(0, 0, this.toolbarWidth, this.scale.height, 0x111111).setOrigin(0, 0);
    toolbar.setDepth(100);

    const items: Array<{ tool: ToolName; label: string }> = [
      { tool: 'platform', label: 'Plat' },
      { tool: 'spawnPoint', label: 'Spawn' },
      { tool: 'polygon', label: 'Poly' },
      { tool: 'goal', label: 'Goal' },
      { tool: 'checkpoint', label: 'Check' },
      { tool: 'hazard', label: 'Hazards' },
      { tool: 'pickup', label: 'Pickups' },
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

      bg.on('pointerup', () => {
        // Hazards/Pickups open their pickers; picking an item activates the tool.
        if (item.tool === 'hazard') {
          this.toggleHazardPicker();
        } else if (item.tool === 'pickup') {
          this.togglePickupPicker();
        } else {
          this.editor?.setActiveTool(item.tool);
        }
      });

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
