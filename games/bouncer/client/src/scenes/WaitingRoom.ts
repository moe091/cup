import type { MatchJoinInfo, MatchStatus, LevelListItem, ScoreGoal } from '@cup/bouncer-shared';
import { listLevels } from '../api/levels';
import { LevelSelectorSidebar } from '../misc/LevelSelectorSidebar';
import WaitingRoomUI from '../misc/WaitingRoomUI';

export class WaitingRoomScene extends Phaser.Scene {
  private role = '';
  private isReady = false;
  private pendingStatus: MatchStatus | null = null;
  private levelSelector: LevelSelectorSidebar | null = null;
  private waitingRoomUI: WaitingRoomUI | null = null;
  private selectedLevel: LevelListItem | null = null;
  private levelList: LevelListItem[] = [];
  private isShuttingDown = false;
  private scoreGoal: ScoreGoal = 30;
  private scoreGoalLocked = false;

  constructor(
    private playerId: string,
    private readonly emit: (name: string, data: unknown) => void,
    private containerEl: HTMLElement,
  ) {
    super('waitingRoom');
  }

  init(data: { isCreator: boolean }) {
    // Initialization if needed
  }

  fullscreenListener() {
    console.log('fullscreen listener setup');
    const fKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    fKey.on('down', () => {
      console.log('request full screen: ', this.containerEl);
      this.containerEl.requestFullscreen();
    });
  }

  async create() {
    this.isShuttingDown = false;
    this.events.once('shutdown', this.onShutdown, this);
    this.isReady = false;

    this.fullscreenListener();

    // Load available levels (only for creators)
    if (this.role === 'creator') {
      const levels = await listLevels();
      if (this.isShuttingDown || !this.sys.isActive()) {
        return;
      }
      this.levelList = levels;
      console.log('GOT LEVEL LIST: ', this.levelList);
    }

    // Try to create UI components now that we're ready
    this.createUIComponents();

    this.isReady = true;
    if (this.pendingStatus) {
      this.statusUpdate(this.pendingStatus);
      this.pendingStatus = null;
    }
  }

  private createUIComponents() {
    if (!this.role) return;

    const isCreator = this.role === 'creator';

    // Create waiting room UI (player list + ready button)
    if (!this.waitingRoomUI) {
      this.waitingRoomUI = new WaitingRoomUI(
        this,
        isCreator,
        this.onReadyClicked.bind(this),
        isCreator ? this.onScoreGoalSelected.bind(this) : undefined,
      );
      this.waitingRoomUI.setScoreGoal(this.scoreGoal, this.scoreGoalLocked);
      this.waitingRoomUI.setReadyButtonVisible(true);

      // Update with any pending player status
      if (this.pendingStatus) {
        this.updatePlayerList(this.pendingStatus);
      }
    }

    // Create level selector sidebar
    if (!this.levelSelector && isCreator && this.levelList.length > 0) {
      this.levelSelector = new LevelSelectorSidebar(
        this,
        this.levelList,
        isCreator,
        this.selectedLevel,
        this.onLevelSelected.bind(this),
      );
    } else if (!this.levelSelector && !isCreator) {
      // Non-creators get empty level list
      this.levelSelector = new LevelSelectorSidebar(this, [], false, this.selectedLevel, undefined);
    }
  }

  private onReadyClicked() {
    this.emit('set_ready', { ready: true });
  }

  private onScoreGoalSelected(scoreGoal: ScoreGoal) {
    this.emit('update_score_goal', { scoreGoal });
  }

  private createLevelSelector() {
    if (this.levelSelector || this.levelList.length === 0 || !this.role) return;

    const isCreator = this.role === 'creator';

    // Create level selector sidebar for everyone
    this.levelSelector = new LevelSelectorSidebar(
      this,
      this.levelList,
      isCreator,
      this.selectedLevel,
      isCreator ? this.onLevelSelected.bind(this) : undefined,
    );
  }

  // Callback from levelSelect sidebar. Broadcasts message to update level selection
  private onLevelSelected(level: LevelListItem) {
    // Emit to server
    this.emit('update_level_selection', level);
  }

  // Message bounced back by the server after leader sets level (or level is auto-set)
  setLevelSelection(level: LevelListItem) {
    console.log('Updating level to: ', level);
    this.selectedLevel = level;

    // Update the sidebar display for everyone
    this.levelSelector?.setSelectedLevel(level.name);
  }

  onMatchJoin(info: MatchJoinInfo) {
    this.role = info.role;

    // Create the UI components now that we know the role
    this.createUIComponents();
  }

  private updatePlayerList(status: MatchStatus) {
    const players = status.players.map((p) => ({
      playerId: p.playerId,
      displayName: p.displayName,
      ready: p.ready,
      isMe: p.playerId === this.playerId,
      points: p.points,
      wins: p.wins,
      isLeader: p.role === 'creator',
    }));

    this.waitingRoomUI?.updatePlayers(players);
  }

  statusUpdate(status: MatchStatus) {
    if (!this.isReady) {
      this.pendingStatus = status;
      return;
    }

    this.scoreGoal = status.scoreGoal;
    this.scoreGoalLocked = status.scoreGoalLocked;
    this.waitingRoomUI?.setScoreGoal(this.scoreGoal, this.scoreGoalLocked);

    if (status.phase === 'ROUND_END') {
      const nonLeaders = status.players.filter((p) => p.role !== 'creator');
      const readyCount = nonLeaders.filter((p) => p.ready).length;
      const total = nonLeaders.length;
      const info = total > 0 ? `Waiting for players: ${readyCount}/${total}` : 'Waiting for players: 0/0';
      this.waitingRoomUI?.setRoundEndInfo(info, total === 0 || readyCount >= total);
      this.waitingRoomUI?.setReadyButtonVisible(this.role === 'creator');
    } else {
      this.waitingRoomUI?.setRoundEndInfo(null, false);
      this.waitingRoomUI?.setReadyButtonVisible(true);
    }

    this.updatePlayerList(status);
  }

  private onShutdown() {
    this.isShuttingDown = true;
    this.levelSelector?.destroy();
    this.levelSelector = null;
    this.waitingRoomUI?.destroy();
    this.waitingRoomUI = null;
  }

  startMatch() {
    this.game.scene.stop('waitingRoom');
    this.game.scene.start('gameplay', { level: this.selectedLevel });
  }
}
