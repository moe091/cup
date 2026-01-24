import type { LevelListItem } from '@cup/bouncer-shared';
import Phaser from 'phaser';

export class LevelSelectorSidebar {
  private scene: Phaser.Scene;
  private allLevels: LevelListItem[];
  private selectedLevelId: string | null = null;
  private onLevelChange: ((level: LevelListItem) => void) | null;
  private container: Phaser.GameObjects.DOMElement | null = null;
  private isCreator: boolean;
  private levelName: string = 'None';

  constructor(
    scene: Phaser.Scene,
    levels: LevelListItem[],
    isCreator: boolean,
    curLevel: LevelListItem | null,
    onLevelChange?: (level: LevelListItem) => void,
  ) {
    this.scene = scene;
    this.allLevels = levels;
    this.isCreator = isCreator;
    if (curLevel)
        this.levelName = curLevel.name;

    this.onLevelChange = onLevelChange || null;
    this.injectStyles();
    
    // Auto-select a random system level on creation (only if creator)
    if (this.isCreator) {
      this.selectRandomSystemLevel();
    }
    
    this.create();
  }

  private injectStyles() {
    if (document.getElementById('level-selector-sidebar-styles')) return;

    const style = document.createElement('style');
    style.id = 'level-selector-sidebar-styles';
    style.textContent = `
      .level-selector-sidebar {
        width: 320px;
        height: 540px;
        background: #1a1a1a;
        border-left: 2px solid #2a2a2a;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .level-selector-header {
        padding: 20px;
        background: #2a2a2a;
        border-bottom: 2px solid #3a3a3a;
      }

      .level-selector-header h2 {
        margin: 0 0 2px 0;
        font-size: 12px;
        text-transform: uppercase;
        color: #888;
        letter-spacing: 0.5px;
      }

      .current-level-name {
        margin: 0;
        font-size: 18px;
        color: #22BB33;
        font-weight: 600;
      }

      .level-search {
        margin: 16px;
        padding: 10px 12px;
        background: #0a0a0a;
        border: 1px solid #3a3a3a;
        border-radius: 6px;
        color: white;
        font-size: 14px;
        width: calc(100% - 32px);
        box-sizing: border-box;
      }

      .level-search:focus {
        outline: none;
        border-color: #2d6a4f;
      }

      .level-list-container {
        flex: 1;
        overflow-y: auto;
        padding: 0 16px 16px 16px;
      }

      .level-list-container::-webkit-scrollbar {
        width: 8px;
      }

      .level-list-container::-webkit-scrollbar-track {
        background: #0a0a0a;
        border-radius: 4px;
      }

      .level-list-container::-webkit-scrollbar-thumb {
        background: #3a3a3a;
        border-radius: 4px;
      }

      .level-list-container::-webkit-scrollbar-thumb:hover {
        background: #4a4a4a;
      }

      .level-section {
        margin-bottom: 20px;
      }

      .level-section-title {
        font-size: 11px;
        text-transform: uppercase;
        color: #666;
        font-weight: 600;
        margin-bottom: 8px;
        letter-spacing: 0.5px;
      }

      .level-item {
        background: #0a0a0a;
        border: 2px solid transparent;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .level-item:hover {
        background: #252525;
        border-color: #3a3a3a;
      }

      .level-item.selected {
        background: #1e4d2f;
        border-color: #22BB33;
      }

      .level-item-name {
        font-size: 15px;
        font-weight: 500;
        margin-bottom: 4px;
        color: #ffffff;
      }

      .level-item-meta {
        font-size: 11px;
        color: #999;
      }

      .level-footer {
        padding: 16px;
        background: #2a2a2a;
        border-top: 2px solid #3a3a3a;
      }

      .level-select-btn {
        width: 100%;
        padding: 12px 16px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        background: #2d6a4f;
        color: white;
      }

      .level-select-btn:hover:not(:disabled) {
        background: #3d8a6f;
      }

      .level-select-btn:disabled {
        background: #1a3a2f;
        color: #666;
        cursor: not-allowed;
      }

      .empty-state {
        text-align: center;
        color: #666;
        padding: 40px 20px;
        font-size: 14px;
      }

      .viewer-message {
        text-align: center;
        color: #888;
        padding: 60px 30px;
        font-size: 14px;
        line-height: 1.6;
      }
    `;
    document.head.appendChild(style);
  }

  private createHTML(): string {
    const currentLevel = this.allLevels.find(l => l.id === this.selectedLevelId);
    if (currentLevel) {
        this.levelName = currentLevel.name;
    }
    

    if (this.isCreator) {
      // Creator view - full level selector
      return `
        <div class="level-selector-sidebar">
          <div class="level-selector-header">
            <h2>Current Level</h2>
            <p class="current-level-name" data-current-level-name>${this.levelName}</p>
          </div>

          <input 
            type="text" 
            class="level-search" 
            placeholder="Search levels..."
            data-action="search"
          />

          <div class="level-list-container" data-list></div>
        </div>
      `;
    } else {
      // Viewer view - just shows current level
      return `
        <div class="level-selector-sidebar">
          <div class="level-selector-header">
            <h2>Current Level</h2>
            <p class="current-level-name" data-current-level-name>${this.levelName}</p>
          </div>

          <div class="viewer-message">
            Only the match leader can choose levels.
          </div>
        </div>
      `;
    }
  }

  private create() {
    // Position on the right side of the screen
    const x = 960 - 160; // 960 - (320/2) = right third centered
    const y = 270; // Middle of 540px height

    this.container = this.scene.add.dom(x, y).createFromHTML(this.createHTML());
    this.container.setOrigin(0.5);
    this.container.setScrollFactor(0);
    this.container.setDepth(100);

    this.setupEventListeners();
    this.renderLevels(this.allLevels);
  }

  private setupEventListeners() {
    if (!this.container || !this.isCreator) return;

    const element = this.container.node as HTMLElement;

    // Search input
    const searchInput = element.querySelector('[data-action="search"]') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
      this.filterLevels((e.target as HTMLInputElement).value);
    });

    // Event delegation for level items - now triggers immediately on click
    const listEl = element.querySelector('[data-list]') as HTMLDivElement;
    listEl?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const levelItem = target.closest('[data-level-id]') as HTMLElement;
      if (levelItem) {
        const levelId = levelItem.getAttribute('data-level-id');
        if (levelId) this.selectLevel(levelId);
      }
    });
  }

  private renderLevels(levels: LevelListItem[]) {
    if (!this.container || !this.isCreator) return;

    const element = this.container.node as HTMLElement;
    const listEl = element.querySelector('[data-list]') as HTMLDivElement;
    if (!listEl) return;
    
    const builtIn = levels.filter(l => l.ownerUserId === null);
    const custom = levels.filter(l => l.ownerUserId !== null);

    let html = '';

    if (builtIn.length > 0) {
      html += '<div class="level-section">';
      html += '<div class="level-section-title">Built-in Levels</div>';
      builtIn.forEach(level => {
        html += this.createLevelItemHtml(level);
      });
      html += '</div>';
    }

    if (custom.length > 0) {
      html += '<div class="level-section">';
      html += '<div class="level-section-title">Custom Levels</div>';
      custom.forEach(level => {
        html += this.createLevelItemHtml(level);
      });
      html += '</div>';
    }

    if (levels.length === 0) {
      html = '<div class="empty-state">No levels found</div>';
    }

    listEl.innerHTML = html;
  }

  private createLevelItemHtml(level: LevelListItem): string {
    const isSelected = this.selectedLevelId === level.id;
    return `
      <div 
        class="level-item ${isSelected ? 'selected' : ''}" 
        data-level-id="${level.id}"
      >
        <div class="level-item-name">${level.name}</div>
        <div class="level-item-meta">
          ${level.ownerUserId === null ? 'Official Level' : 'Custom Level'}
        </div>
      </div>
    `;
  }

  private selectLevel(levelId: string) {
    this.selectedLevelId = levelId;
    this.renderLevels(this.allLevels);
    this.updateCurrentLevelDisplay();
    
    // Immediately notify that level changed
    const level = this.allLevels.find(l => l.id === this.selectedLevelId);
    if (level && this.onLevelChange) {
      this.onLevelChange(level);
    }
  }

  private selectRandomSystemLevel() {
    const systemLevels = this.allLevels.filter(l => l.ownerUserId === null);
    if (systemLevels.length > 0) {
      const randomLevel = systemLevels[Math.floor(Math.random() * systemLevels.length)];
      this.selectedLevelId = randomLevel.id;
      
      // Notify about initial selection
      if (this.onLevelChange) {
        this.onLevelChange(randomLevel);
      }
    }
  }

  private setCurrentLevelName(levelName: string) {
    if (!this.container) return;
    
    const element = this.container.node as HTMLElement;
    const nameEl = element.querySelector('[data-current-level-name]') as HTMLElement;
    if (!nameEl) return;

    nameEl.textContent = levelName;
  }

  private updateCurrentLevelDisplay() {
    if (!this.container) return;
    
    const element = this.container.node as HTMLElement;
    const nameEl = element.querySelector('[data-current-level-name]') as HTMLElement;
    if (!nameEl) return;

    const currentLevel = this.allLevels.find(l => l.id === this.selectedLevelId);
    nameEl.textContent = currentLevel ? currentLevel.name : 'None';
  }

  private filterLevels(query: string) {
    const filtered = this.allLevels.filter(l => 
      l.name.toLowerCase().includes(query.toLowerCase())
    );
    this.renderLevels(filtered);
  }

  getSelectedLevel(): LevelListItem | null {
    return this.allLevels.find(l => l.id === this.selectedLevelId) || null;
  }

  // Allow external updates to the selected level (e.g., from server)
  setSelectedLevel(levelName: string) {
    // const level = this.allLevels.find(l => l.id === levelId);
    // if (level) {
    //   this.selectedLevelId = levelId;
    //   this.renderLevels(this.allLevels);
    //   this.updateCurrentLevelDisplay();
    // }
    this.levelName = levelName; //used in case this is called before ui loads, so it can dispaly levelname on load
    this.setCurrentLevelName(levelName);
  }

  destroy() {
    this.container?.destroy();
    this.container = null;
  }
}