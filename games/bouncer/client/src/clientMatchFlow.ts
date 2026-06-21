import type Phaser from 'phaser';
import type {
  FinishOrderUpdate,
  MatchCountdown,
  MatchJoinInfo,
  MatchResultsUpdate,
  MatchStatus,
  RemotePlayerStateUpdate,
  RoundResultsUpdate,
  RoundStartingPayload,
  LevelListItem,
} from '@cup/bouncer-shared';
import type { WaitingRoomScene } from './scenes/WaitingRoom';
import type { GameplayScene } from './scenes/Gameplay';

/**
 * The client-side brain for match flow. Subscribes (via BouncerClient delegation)
 * to all server events, tracks the current phase, and drives scene transitions.
 *
 * It is the single writer of "is the round live" — that flips only on the
 * IN_PROGRESS status, which the server broadcasts to everyone at once.
 *
 * Scene mapping: PRE_MATCH = waiting room; every other phase = gameplay scene
 * (POST_ROUND / POST_MATCH render as modals over it). Scene switches happen only
 * at PRE_MATCH<->COUNTDOWN and POST_MATCH->PRE_MATCH.
 */
export class ClientMatchFlow {
  private phase: MatchStatus['phase'] | null = null;
  private isLeader = false;
  private gameplaySceneStarted = false;

  // Results arrive just before the matching phase status; held until shown.
  private latestRoundResults: RoundResultsUpdate | null = null;
  private latestMatchResults: MatchResultsUpdate | null = null;

  // A single terminal/blocking message overlay (host left, join rejected, etc.).
  private blockingOverlay: HTMLDivElement | null = null;
  private roundStartingOverlay: HTMLDivElement | null = null;

  constructor(
    private game: Phaser.Game,
    private waitingRoom: WaitingRoomScene,
    private gameplay: GameplayScene,
    private playerId: string,
    private containerEl: HTMLElement,
  ) {}

  // ---------------- Incoming events ---------------- \\

  onMatchJoin(info: MatchJoinInfo) {
    this.waitingRoom.onMatchJoin(info);
  }

  onMatchStatus(status: MatchStatus) {
    console.log(`[bouncer-timing] match_status phase=${status.phase} t=${performance.now().toFixed(0)}ms`);
    this.phase = status.phase;
    const me = status.players.find((p) => p.playerId === this.playerId);
    this.isLeader = me?.role === 'creator';
    this.gameplay.setPlayerNames(new Map(status.players.map((p) => [p.playerId, p.displayName])));

    switch (status.phase) {
      case 'PRE_MATCH':
        this.hideRoundStartingOverlay();
        // Boot already starts the waiting room, so on the initial join we must
        // NOT start it again (that would restart the scene and wipe the UI that
        // match_joined just built). Only swap scenes when returning from a match.
        if (this.gameplaySceneStarted) {
          this.returnToWaitingRoom();
        }
        this.waitingRoom.statusUpdate(status);
        break;

      case 'COUNTDOWN':
        // Scene + level were prepared by round_starting; freeze input until IN_PROGRESS.
        // Show a "Round Starting..." overlay until the numeric 3-2-1 countdown begins.
        this.gameplay.setRunning(false);
        this.showRoundStartingOverlay();
        break;

      case 'IN_PROGRESS':
        this.hideRoundStartingOverlay();
        this.gameplay.setRunning(true);
        break;

      case 'POST_ROUND':
        this.hideRoundStartingOverlay();
        this.gameplay.setRunning(false);
        if (this.latestRoundResults) {
          this.gameplay.showRoundResultsModal(this.latestRoundResults, this.isLeader);
        }
        break;

      case 'POST_MATCH':
        this.hideRoundStartingOverlay();
        this.gameplay.setRunning(false);
        if (this.latestMatchResults) {
          this.gameplay.showMatchResultsModal(this.latestMatchResults, this.isLeader);
        }
        break;
    }
  }

  onSetLevel(level: LevelListItem) {
    this.waitingRoom.setLevelSelection(level);
  }

  onRoundStarting(payload: RoundStartingPayload) {
    console.log(`[bouncer-timing] round_starting received t=${performance.now().toFixed(0)}ms`);
    // A new round is beginning; discard last round's results.
    this.latestRoundResults = null;

    if (!this.gameplaySceneStarted) {
      console.log('[bouncer-timing] starting gameplay scene (first round, full scene boot)');
      this.game.scene.stop('waitingRoom');
      this.game.scene.start('gameplay', { level: payload.level, spawns: payload.spawns });
      this.gameplaySceneStarted = true;
    } else {
      console.log('[bouncer-timing] reloading level into existing gameplay scene');
      this.gameplay.startRound(payload.level, payload.spawns);
    }
  }

  onCountdown(data: MatchCountdown) {
    console.log(`[bouncer-timing] countdown tick=${data.secondsLeft} t=${performance.now().toFixed(0)}ms`);
    // Numeric countdown has begun — replace the "Round Starting..." overlay with it.
    this.hideRoundStartingOverlay();
    this.gameplay.showCountdown(data.secondsLeft);
  }

  onRemotePlayerState(update: RemotePlayerStateUpdate) {
    this.gameplay.onRemotePlayerState(update);
  }

  onFinishOrderUpdate(update: FinishOrderUpdate) {
    this.gameplay.onFinishOrderUpdate(update);
  }

  onRoundResults(update: RoundResultsUpdate) {
    this.latestRoundResults = update;
  }

  onMatchResults(update: MatchResultsUpdate) {
    this.latestMatchResults = update;
  }

  onHostLeft() {
    this.showBlockingMessage('The host left the match.');
  }

  onJoinError(reason?: string) {
    const message = reason === 'match_in_progress' ? 'This match is already in progress.' : 'Unable to join match.';
    this.showBlockingMessage(message);
  }

  // ---------------- Scene helpers ---------------- \\

  /** Returning to the lobby after a match: stop gameplay and (re)start the waiting room. */
  private returnToWaitingRoom() {
    if (this.game.scene.isActive('gameplay')) {
      this.game.scene.stop('gameplay');
    }
    if (!this.game.scene.isActive('waitingRoom')) {
      this.game.scene.start('waitingRoom');
    }
    this.gameplaySceneStarted = false;
    this.latestRoundResults = null;
    this.latestMatchResults = null;
  }

  // Centered "Round Starting..." banner shown on all clients during the COUNTDOWN
  // phase up until the numeric 3-2-1 begins (covers the scene-build pause).
  private showRoundStartingOverlay() {
    if (this.roundStartingOverlay) {
      return;
    }
    const overlay = document.createElement('div');
    overlay.textContent = 'Round Starting...';
    overlay.style.cssText = [
      'position:absolute',
      'inset:0',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'background:rgba(3,5,10,0.72)',
      'color:#f4f8ff',
      'font-family:Arial, sans-serif',
      'font-size:30px',
      'font-weight:bold',
      'letter-spacing:0.5px',
      'pointer-events:none',
      'z-index:900',
    ].join(';');
    this.containerEl.appendChild(overlay);
    this.roundStartingOverlay = overlay;
  }

  private hideRoundStartingOverlay() {
    this.roundStartingOverlay?.remove();
    this.roundStartingOverlay = null;
  }

  // Full-screen terminal message (host left, join rejected). First one wins so an
  // immediate follow-up disconnect can't replace the reason with a generic message.
  private showBlockingMessage(text: string) {
    if (this.blockingOverlay) {
      return;
    }
    const overlay = document.createElement('div');
    overlay.textContent = text;
    overlay.style.cssText = [
      'position:absolute',
      'inset:0',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'background:rgba(3,5,10,0.82)',
      'color:#f4f8ff',
      'font-family:Arial, sans-serif',
      'font-size:24px',
      'font-weight:bold',
      'text-align:center',
      'padding:0 24px',
      'z-index:1000',
    ].join(';');
    this.containerEl.appendChild(overlay);
    this.blockingOverlay = overlay;
  }

  destroy() {
    this.blockingOverlay?.remove();
    this.blockingOverlay = null;
    this.roundStartingOverlay?.remove();
    this.roundStartingOverlay = null;
  }
}
