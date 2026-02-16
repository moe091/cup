import Phaser from 'phaser';
import type { ScoreGoal } from '@cup/bouncer-shared';

type PlayerInfo = {
  playerId: string;
  displayName: string;
  ready: boolean;
  isMe: boolean;
  points: number;
};

const SCORE_GOAL_OPTIONS: ScoreGoal[] = [20, 30, 50, 100, 'NEVER'];

export class WaitingRoomUI {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.DOMElement | null = null;
  private isCreator: boolean;
  private onReady: () => void;
  private onScoreGoalChange: ((scoreGoal: ScoreGoal) => void) | null;
  private players: PlayerInfo[] = [];
  private scoreGoal: ScoreGoal = 30;
  private scoreGoalLocked = false;

  constructor(
    scene: Phaser.Scene,
    isCreator: boolean,
    onReady: () => void,
    onScoreGoalChange?: (scoreGoal: ScoreGoal) => void,
  ) {
    this.scene = scene;
    this.isCreator = isCreator;
    this.onReady = onReady;
    this.onScoreGoalChange = onScoreGoalChange ?? null;
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
        padding: 28px 40px 20px 40px;
      }

      .waiting-room-title {
        margin: 0 0 20px 0;
        font-size: 14px;
        text-transform: uppercase;
        color: #666;
        letter-spacing: 0.5px;
        font-weight: 600;
      }

      .score-goal-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        margin-bottom: 18px;
      }

      .score-goal-label {
        font-size: 14px;
        color: #cdd8f2;
        font-weight: 600;
      }

      .score-goal-change {
        padding: 6px 10px;
        border: 1px solid #4a5675;
        border-radius: 6px;
        background: #232c3f;
        color: #d7e5ff;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }

      .score-goal-select {
        padding: 6px 8px;
        border-radius: 6px;
        border: 1px solid #4a5675;
        background: #131a28;
        color: #d7e5ff;
        font-size: 12px;
      }

      .score-goal-lock {
        font-size: 11px;
        color: #8897b9;
      }

      .player-list {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .player-item {
        display: flex;
        align-items: center;
        gap: 14px;
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
        min-width: 0;
        flex: 1;
      }

      .player-main-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
      }

      .player-name {
        font-size: 18px;
        color: #ffffff;
        font-weight: 500;
      }

      .player-points {
        font-size: 13px;
        color: #8fc0ff;
        font-weight: 700;
        white-space: nowrap;
      }

      .player-status {
        font-size: 14px;
        font-weight: 600;
      }

      .player-status.ready {
        color: #22bb33;
      }

      .player-status.waiting {
        color: #bb2233;
      }

      .waiting-room-footer {
        padding: 26px 40px 34px 40px;
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

    const canEditGoal = this.isCreator && !this.scoreGoalLocked;
    const optionsHtml = SCORE_GOAL_OPTIONS.map((goal) => {
      const label = goal === 'NEVER' ? 'Neverending' : String(goal);
      const selected = goal === this.scoreGoal ? 'selected' : '';
      return `<option value="${String(goal)}" ${selected}>${label}</option>`;
    }).join('');

    return `
      <div class="waiting-room-ui">
        <div class="waiting-room-players">
          <h2 class="waiting-room-title">Players</h2>
          <div class="score-goal-row">
            <span class="score-goal-label" data-score-goal-label>${this.scoreGoalLabel(this.scoreGoal)}</span>
            ${canEditGoal ? '<button class="score-goal-change" data-score-goal-change>Change</button>' : ''}
            ${canEditGoal ? `<select class="score-goal-select" data-score-goal-select style="display:none;">${optionsHtml}</select>` : ''}
            ${this.scoreGoalLocked ? '<span class="score-goal-lock">Locked for this match</span>' : ''}
          </div>
          <div class="player-list" data-player-list></div>
        </div>

        <div class="waiting-room-footer">
          <button class="ready-button" data-ready-btn>${buttonText}</button>
        </div>
      </div>
    `;
  }

  private create() {
    const x = 320;
    const y = 270;

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

    const changeBtn = element.querySelector('[data-score-goal-change]') as HTMLButtonElement | null;
    const selectEl = element.querySelector('[data-score-goal-select]') as HTMLSelectElement | null;

    changeBtn?.addEventListener('click', () => {
      if (!selectEl) return;
      selectEl.style.display = selectEl.style.display === 'none' ? 'inline-block' : 'none';
    });

    selectEl?.addEventListener('change', () => {
      const raw = selectEl.value;
      const parsed = this.parseScoreGoal(raw);
      if (!parsed) return;
      this.onScoreGoalChange?.(parsed);
      selectEl.style.display = 'none';
    });
  }

  private parseScoreGoal(raw: string): ScoreGoal | null {
    if (raw === 'NEVER') return 'NEVER';
    const numeric = Number(raw);
    if (numeric === 20 || numeric === 30 || numeric === 50 || numeric === 100) {
      return numeric;
    }
    return null;
  }

  private scoreGoalLabel(goal: ScoreGoal): string {
    if (goal === 'NEVER') return 'Neverending';
    return `First to ${goal} points`;
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

  setScoreGoal(goal: ScoreGoal, locked: boolean) {
    if (this.scoreGoal === goal && this.scoreGoalLocked === locked) {
      return;
    }
    this.scoreGoal = goal;
    this.scoreGoalLocked = locked;
    this.rebuild();
  }

  private rebuild() {
    const prevPlayers = this.players;
    this.container?.destroy();
    this.container = null;
    this.create();
    this.players = prevPlayers;
    this.renderPlayers();
  }

  private renderPlayers() {
    if (!this.container) return;

    const element = this.container.node as HTMLElement;
    const listEl = element.querySelector('[data-player-list]') as HTMLDivElement;
    if (!listEl) return;

    let html = '';

    this.players.forEach((player) => {
      const statusClass = player.ready ? 'ready' : 'waiting';
      const statusText = player.ready ? 'READY' : 'Waiting...';
      const displayName = player.isMe ? 'YOU' : player.displayName;
      const ballColor = player.isMe ? '#22bb33' : '#bb2233';

      html += `
        <div class="player-item">
          <svg class="player-ball" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="18" fill="${ballColor}" />
          </svg>
          <div class="player-info">
            <div class="player-main-row">
              <div class="player-name">${displayName}</div>
              <div class="player-points">Points: ${player.points}</div>
            </div>
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
