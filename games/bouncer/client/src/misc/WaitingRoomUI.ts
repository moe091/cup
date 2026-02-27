import Phaser from 'phaser';
import type { ScoreGoal } from '@cup/bouncer-shared';

type PlayerInfo = {
  playerId: string;
  displayName: string;
  ready: boolean;
  isMe: boolean;
  points: number;
  wins: number;
  isLeader: boolean;
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
  private roundEndInfo: string | null = null;
  private roundEndInfoReady = false;

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
    let style = document.getElementById('waiting-room-ui-styles') as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = 'waiting-room-ui-styles';
      document.head.appendChild(style);
    }

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
        padding: 14px 36px 10px 36px;
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
        margin-bottom: 24px;
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

      .round-end-info {
        width: 100%;
        margin: 0 0 8px 0;
        text-align: center;
        font-size: 12px;
        color: #f0b35a;
        font-weight: 600;
      }

      .round-end-info.ready {
        color: #42c978;
      }

      .player-list {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .player-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding-bottom: 8px;
        border-bottom: 1px solid #3a3a3a;
      }

      .player-ball {
        width: 32px;
        height: 32px;
        flex-shrink: 0;
      }

      .player-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        flex: 1;
      }

      .player-main-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
      }

      .player-meta-row {
        display: grid;
        grid-template-columns: 1fr 86px 96px;
        align-items: center;
        gap: 10px;
      }

      .player-name {
        font-size: 16px;
        color: #ffffff;
        font-weight: 500;
      }

      .player-points {
        font-size: 12px;
        color: #8fc0ff;
        font-weight: 700;
        white-space: nowrap;
        text-align: right;
      }

      .player-wins {
        font-size: 12px;
        color: #ffffff;
        font-weight: 700;
        white-space: nowrap;
        text-align: right;
      }

      .player-wins.top {
        color: #ffd46b;
      }

      .player-status {
        font-size: 12px;
        font-weight: 600;
      }

      .player-status.ready {
        color: #22bb33;
      }

      .player-status.waiting {
        color: #bb2233;
      }

      .player-status.leader {
        color: #ffffff;
      }

      .waiting-room-footer {
        padding: 16px 40px 26px 40px;
        display: flex;
        flex-direction: column !important;
        justify-content: center;
        align-items: center !important;
        width: 100%;
        box-sizing: border-box;
      }

      .ready-button {
        padding: 12px 28px;
        background: #2d6a4f;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 15px;
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
          <div class="score-goal-row">
            <span class="score-goal-label" data-score-goal-label>${this.scoreGoalLabel(this.scoreGoal)}</span>
            ${canEditGoal ? '<button class="score-goal-change" data-score-goal-change>Change</button>' : ''}
            ${canEditGoal ? `<select class="score-goal-select" data-score-goal-select style="display:none;">${optionsHtml}</select>` : ''}
            ${this.scoreGoalLocked ? '<span class="score-goal-lock">Locked for this match</span>' : ''}
          </div>
          <div class="player-list" data-player-list></div>
        </div>

        <div class="waiting-room-footer">
          ${this.roundEndInfo ? `<div class="round-end-info ${this.roundEndInfoReady ? 'ready' : ''}" data-round-end-info>${this.roundEndInfo}</div>` : ''}
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

  setReadyButtonVisible(visible: boolean) {
    if (!this.container) return;
    const element = this.container.node as HTMLElement;
    const readyBtn = element.querySelector('[data-ready-btn]') as HTMLButtonElement;
    if (!readyBtn) return;
    readyBtn.style.display = visible ? 'inline-block' : 'none';
  }

  setRoundEndInfo(info: string | null, allReady = false) {
    if (this.roundEndInfo === info && this.roundEndInfoReady === allReady) {
      return;
    }
    this.roundEndInfo = info;
    this.roundEndInfoReady = allReady;
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
    const maxWins = this.players.reduce((max, player) => Math.max(max, player.wins), 0);

    this.players.forEach((player) => {
      const statusClass = player.isLeader ? 'leader' : player.ready ? 'ready' : 'waiting';
      const statusText = player.isLeader ? 'Leader' : player.ready ? 'READY' : 'Waiting...';
      const displayName = player.isMe ? 'YOU' : player.displayName;
      const ballColor = player.isMe ? '#22bb33' : '#bb2233';
      const winsClass = player.wins === maxWins && maxWins > 0 ? 'top' : '';

      html += `
        <div class="player-item">
          <svg class="player-ball" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="18" fill="${ballColor}" />
          </svg>
          <div class="player-info">
            <div class="player-main-row">
              <div class="player-name">${displayName}</div>
            </div>
            <div class="player-meta-row">
              <div class="player-status ${statusClass}">${statusText}</div>
              <div class="player-wins ${winsClass}">Wins: ${player.wins}</div>
              <div class="player-points">Points: ${player.points}</div>
            </div>
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

export default WaitingRoomUI;
