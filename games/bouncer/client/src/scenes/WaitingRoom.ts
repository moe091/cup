import type { MatchJoinInfo, MatchStatus, LevelListItem, ScoreGoal } from '@cup/bouncer-shared';
import { listLevels } from '../api/levels';
import { LevelSelectorSidebar } from '../misc/LevelSelectorSidebar';
import WaitingRoomUI from '../misc/WaitingRoomUI';

export class WaitingRoomScene extends Phaser.Scene {
  private role = '';
  private sceneActive = false;
  private levelsLoaded = false;
  private latestStatus: MatchStatus | null = null;
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
    this.sceneActive = true;

    this.fullscreenListener();

    // Build whatever UI we can with what we already know (role may or may not be
    // set yet — match_joined can arrive before or after this lifecycle hook).
    this.createUIComponents();

    // For creators, fetch the level list (idempotent; safe to call again once the
    // role becomes known via onMatchJoin).
    void this.ensureLevelsLoaded();
  }

  // Fetches the level list for creators and (re)builds the level selector. Idempotent:
  // callable from both create() and onMatchJoin regardless of which fires first.
  private async ensureLevelsLoaded() {
    if (this.levelsLoaded || this.role !== 'creator') return;

    const levels = await listLevels();
    if (this.isShuttingDown || !this.sys.isActive()) {
      return;
    }
    this.levelList = levels;
    this.levelsLoaded = true;
    this.createUIComponents();
  }

  private createUIComponents() {
    // Need both a known role and a live scene (add.dom requires booted systems).
    if (!this.role || !this.sceneActive) return;

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

    // Re-apply the last known status so a freshly (re)built UI is populated
    // regardless of whether the status arrived before or after this ran.
    this.applyStatus();
  }

  private onReadyClicked() {
    // The leader's button starts the match; everyone else's marks themselves ready.
    if (this.role === 'creator') {
      console.log(`[bouncer-timing] leader clicked Start Match, emitting start_match t=${performance.now().toFixed(0)}ms`);
      this.emit('start_match', {});
    } else {
      this.emit('set_ready', { ready: true });
    }
  }

  private onScoreGoalSelected(scoreGoal: ScoreGoal) {
    this.emit('update_score_goal', { scoreGoal });
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

    // Now that we know the role, build the UI and (for creators) load levels.
    // Either of create()/onMatchJoin may run first; both paths are idempotent.
    this.createUIComponents();
    void this.ensureLevelsLoaded();
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

  // The waiting room is only shown in PRE_MATCH. Button visibility is derived
  // purely from the server's ready state (single source of truth): the leader
  // always sees "Start Match"; everyone else sees "Ready?" until they are ready.
  statusUpdate(status: MatchStatus) {
    // Always remember the latest status; apply it if the UI exists yet, otherwise
    // it's re-applied automatically once createUIComponents builds the UI.
    this.latestStatus = status;
    this.applyStatus();
  }

  private applyStatus() {
    const status = this.latestStatus;
    if (!status || !this.waitingRoomUI) return;

    this.scoreGoal = status.scoreGoal;
    this.scoreGoalLocked = status.scoreGoalLocked;
    this.waitingRoomUI.setScoreGoal(this.scoreGoal, this.scoreGoalLocked);

    const localPlayer = status.players.find((p) => p.playerId === this.playerId);
    const showButton = this.role === 'creator' || !(localPlayer?.ready ?? false);
    this.waitingRoomUI.setReadyButtonVisible(showButton);

    this.updatePlayerList(status);
  }

  private onShutdown() {
    this.isShuttingDown = true;
    this.sceneActive = false;
    this.levelSelector?.destroy();
    this.levelSelector = null;
    this.waitingRoomUI?.destroy();
    this.waitingRoomUI = null;
  }
}
