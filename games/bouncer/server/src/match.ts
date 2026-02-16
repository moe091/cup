import { Socket } from 'socket.io';
import type {
  MatchStatus,
  MatchPhase,
  MatchCountdown,
  LevelDefinition,
  LevelListItem,
  InitializePlayersPayload,
  PlayerStateUpdate,
  RemotePlayerStateUpdate,
  FinishOrderUpdate,
} from '@cup/bouncer-shared';
import type { PlayerId, SocketId, PlayerSession, Broadcast, BroadcastExcept } from './types.js';
import { loadLevelDef } from './api/helpers.js';

export class Match {
  private players = new Map<PlayerId, PlayerSession>();
  private phase: MatchPhase = 'WAITING';
  private minPlayers = 1;
  private countdownSeconds = 1;
  private awaitingAcks = new Set<PlayerId>();
  private afterAcks: (() => void) | null = null;
  private levelDef: LevelDefinition | null = null;
  private levelSelection: LevelListItem | null = null;
  private finishedPlayerIds: PlayerId[] = [];

  constructor(
    public matchId: string,
    private broadcast: Broadcast,
    private broadcastExcept: BroadcastExcept,
  ) {}

  private addPlayer(playerId: PlayerId, socketId: SocketId, displayName: string, role: string) {
    this.players.set(playerId, { playerId, socketId, displayName, role, ready: false });
  }

  private async loadLevel(): Promise<LevelDefinition | null> {
    if (!this.levelSelection) {
      console.error('[Match.loadLevel] loadLevel called with no levelSelection');
      return null;
    }

    this.levelDef = await loadLevelDef(this.levelSelection.id);
    return this.levelDef;
  }

  private startGame() {
    this.broadcast('start_match', {});
  }

  private startCountdown() {
    let countdownTimer = this.countdownSeconds;

    const countdownSecond = () => {
      if (countdownTimer <= 0) {
        this.startGame();
      } else {
        this.broadcast('countdown', { secondsLeft: countdownTimer } as MatchCountdown);
        countdownTimer--;
        setTimeout(() => countdownSecond(), 1000);
      }
    };

    countdownSecond();
  }

  private assignSpawns(level: LevelDefinition): InitializePlayersPayload {
    const spawnPoints = level.objects.filter((obj) => obj.type === 'spawnPoint');
    const playerIds = Array.from(this.players.keys());
    const spawns = playerIds.map((playerId, idx) => {
      const spawn = spawnPoints[idx] ?? spawnPoints[0];
      const x = spawn?.x ?? 0;
      const y = spawn?.y ?? 0;
      return { playerId, x, y };
    });

    return { spawns };
  }

  broadcastStatus() {
    const status: MatchStatus = {
      matchId: this.matchId,
      phase: this.phase,
      minPlayers: this.minPlayers,
      players: Array.from(this.players.values()).map((player) => ({
        playerId: player.playerId,
        displayName: player.displayName,
        ready: player.ready,
        role: player.role,
      })),
    };

    this.broadcast('match_status', status);
  }

  onJoin(socket: Socket) {
    socket.data.playerId = socket.id as PlayerId;
    const playerId = socket.data.playerId as PlayerId;
    const displayName = socket.data.displayName as string;
    const role = socket.data.role as string;

    this.addPlayer(playerId, socket.id as SocketId, displayName, role);

    socket.emit('match_joined', { role, displayName });

    if (this.levelSelection) {
      socket.emit('set_level', this.levelSelection);
    }

    setTimeout(() => this.broadcastStatus(), 1000);
  }

  getPhase() {
    return this.phase;
  }

  setPhase(val: MatchPhase) {
    if (this.phase === 'WAITING' && val === 'IN_PROGRESS') {
      this.phase = 'IN_PROGRESS_QUEUED';
      this.awaitingAcks.clear();

      this.players.forEach((player) => {
        this.awaitingAcks.add(player.playerId);
      });
      this.afterAcks = () => {
        void this.startGameplay();
      };
      this.broadcastStatus();
      return;
    }

    this.phase = val;
    this.broadcastStatus();
  }

  async startGameplay() {
    this.setPhase('IN_PROGRESS');
    this.finishedPlayerIds = [];

    const level = await this.loadLevel();
    if (!level) {
      console.error('[Match.startGameplay] Failed to load level');
      this.setPhase('WAITING');
      this.broadcastStatus();
      return;
    }

    this.broadcast('load_level', level);
    this.broadcast('initialize_players', this.assignSpawns(level));
    this.startCountdown();
  }

  onClientReady(socket: Socket) {
    this.awaitingAcks.delete(socket.data.playerId as PlayerId);

    if (this.awaitingAcks.size === 0 && this.afterAcks) {
      const afterAcks = this.afterAcks;
      this.afterAcks = null;
      afterAcks();
    }
  }

  onSetReady(socket: Socket, data: { ready: boolean }) {
    if (socket.data.role === 'creator') {
      this.setPhase('IN_PROGRESS');
      return;
    }

    const playerId = socket.data.playerId as PlayerId;
    const player = this.players.get(playerId);
    if (player) {
      player.ready = data.ready;
    }

    this.broadcastStatus();
  }

  onUpdateLevelSelection(socket: Socket, level: LevelListItem) {
    console.log(`${socket.data.role}-${socket.data.displayName} updated level selection to: ${level.name}`);
    this.levelSelection = level;
    this.broadcast('set_level', level);
  }

  onPlayerState(socket: Socket, data: unknown) {
    if (this.phase !== 'IN_PROGRESS') {
      return;
    }

    const parsed = this.parsePlayerStateUpdate(data);
    if (!parsed) {
      return;
    }

    const payload: RemotePlayerStateUpdate = {
      playerId: socket.data.playerId as PlayerId,
      serverTimeMs: Date.now(),
      ...parsed,
    };

    this.broadcastExcept(socket.id, 'remote_player_state', payload);
  }

  onPlayerFinished(socket: Socket) {
    if (this.phase !== 'IN_PROGRESS') {
      return;
    }

    const playerId = socket.data.playerId as PlayerId;
    if (!this.players.has(playerId)) {
      return;
    }
    if (this.finishedPlayerIds.includes(playerId)) {
      return;
    }

    this.finishedPlayerIds.push(playerId);
    const finishUpdate: FinishOrderUpdate = {
      finishedPlayerIds: [...this.finishedPlayerIds],
    };
    this.broadcast('finish_order_update', finishUpdate);
  }

  onLeave(socket: Socket) {
    const playerId = socket.data.playerId as PlayerId | undefined;
    if (playerId) {
      this.players.delete(playerId);
      this.awaitingAcks.delete(playerId);
      this.finishedPlayerIds = this.finishedPlayerIds.filter((id) => id !== playerId);
    }

    this.broadcastStatus();
  }

  isEmpty() {
    return this.players.size === 0;
  }

  destroy() {
    this.awaitingAcks.clear();
    this.afterAcks = null;
    this.finishedPlayerIds = [];
  }

  private parsePlayerStateUpdate(data: unknown): PlayerStateUpdate | null {
    if (!data || typeof data !== 'object') {
      return null;
    }

    const candidate = data as Partial<PlayerStateUpdate>;
    if (!this.isFiniteNumber(candidate.seq)) return null;
    if (!this.isFiniteNumber(candidate.x)) return null;
    if (!this.isFiniteNumber(candidate.y)) return null;
    if (!this.isFiniteNumber(candidate.angle)) return null;
    if (!this.isFiniteNumber(candidate.xVel)) return null;
    if (!this.isFiniteNumber(candidate.yVel)) return null;

    return {
      seq: candidate.seq,
      x: candidate.x,
      y: candidate.y,
      angle: candidate.angle,
      xVel: candidate.xVel,
      yVel: candidate.yVel,
    };
  }

  private isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }
}
