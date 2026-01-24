import Phaser from 'phaser';

type PlayerInfo = {
  playerId: string;
  displayName: string;
  ready: boolean;
  isMe: boolean;
};

export class WaitingRoomUI {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.DOMElement | null = null;
  private isCreator: boolean;
  private onReady: () => void;
  private players: PlayerInfo[] = [];

  constructor(
    scene: Phaser.Scene,
    isCreator: boolean,
    onReady: () => void
  ) {
    this.scene = scene;
    this.isCreator = isCreator;
    this.onReady = onReady;
    this.injectStyles();
    this.create();
  }

  private injectStyles() {
    if (document.getElementById('waiting-room-ui-styles')) return;

    const style = document.createElement('style');
    style.id = 'waiting-room-ui-styles';
    style.textContent = `
      .waiting-room-ui {
        width: 640px;
        height: 540px;
        background: #151515;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .waiting-room-players {
        flex: 1;
        padding: 40px;
      }

      .waiting-room-title {
        margin: 0 0 30px 0;
        font-size: 14px;
        text-transform: uppercase;
        color: #666;
        letter-spacing: 0.5px;
        font-weight: 600;
      }

      .player-list {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .player-item {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .player-ball {
        width: 40px;
        height: 40px;
        flex-shrink: 0;
      }

      .player-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .player-name {
        font-size: 18px;
        color: #ffffff;
        font-weight: 500;
      }

      .player-status {
        font-size: 14px;
        font-weight: 600;
      }

      .player-status.ready {
        color: #22BB33;
      }

      .player-status.waiting {
        color: #BB2233;
      }

      .waiting-room-footer {
        padding: 40px;
        display: flex;
        justify-content: center;
      }

      .ready-button {
        padding: 14px 32px;
        background: #2d6a4f;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      .ready-button:hover {
        background: #3d8a6f;
        transform: translateY(-1px);
      }

      .ready-button:active {
        transform: translateY(0);
      }
    `;
    document.head.appendChild(style);
  }

  private createHTML(): string {
    const buttonText = this.isCreator ? 'Start Match' : 'Ready?';

    return `
      <div class="waiting-room-ui">
        <div class="waiting-room-players">
          <h2 class="waiting-room-title">Players</h2>
          <div class="player-list" data-player-list></div>
        </div>
        
        <div class="waiting-room-footer">
          <button class="ready-button" data-ready-btn>${buttonText}</button>
        </div>
      </div>
    `;
  }

  private create() {
    // Position on the left 2/3rds of screen
    const x = 320; // 640/2 = centered in left 2/3rds
    const y = 270; // Middle of 540px height

    this.container = this.scene.add.dom(x, y).createFromHTML(this.createHTML());
    this.container.setOrigin(0.5);
    this.container.setScrollFactor(0);
    this.container.setDepth(100);

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.container) return;

    const element = this.container.node as HTMLElement;
    const readyBtn = element.querySelector('[data-ready-btn]') as HTMLButtonElement;

    readyBtn?.addEventListener('click', () => {
      this.onReady();
      this.hideButton();
    });
  }

  private hideButton() {
    if (!this.container) return;

    const element = this.container.node as HTMLElement;
    const readyBtn = element.querySelector('[data-ready-btn]') as HTMLButtonElement;
    
    if (readyBtn) {
      readyBtn.style.display = 'none';
    }
  }

  updatePlayers(players: PlayerInfo[]) {
    this.players = players;
    this.renderPlayers();
  }

  private renderPlayers() {
    if (!this.container) return;

    const element = this.container.node as HTMLElement;
    const listEl = element.querySelector('[data-player-list]') as HTMLDivElement;
    if (!listEl) return;

    let html = '';

    this.players.forEach(player => {
      const ballSprite = player.isMe ? 'ball_green' : 'ball_red';
      const statusClass = player.ready ? 'ready' : 'waiting';
      const statusText = player.ready ? 'READY' : 'Waiting...';
      const displayName = player.isMe ? 'YOU' : player.displayName;

      // We need to use data URLs for the images since they're Phaser textures
      // For now, we'll use colored circles as placeholders
      const ballColor = player.isMe ? '#22BB33' : '#BB2233';

      html += `
        <div class="player-item">
          <svg class="player-ball" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="18" fill="${ballColor}" />
          </svg>
          <div class="player-info">
            <div class="player-name">${displayName}</div>
            <div class="player-status ${statusClass}">${statusText}</div>
          </div>
        </div>
      `;
    });

    listEl.innerHTML = html;
  }

  destroy() {
    this.container?.destroy();
    this.container = null;
  }
}