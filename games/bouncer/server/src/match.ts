import type { Socket } from 'socket.io';
import type { PlayerId, SocketId, PlayerSession, Broadcast } from './types.js';
import type { MatchStatus, MatchPhase, MatchCountdown, TickSnapshot, InputVector, LevelDefinition } from '@cup/bouncer-shared';
import { Simulation } from './gameplay/simulation.js';
import { loadLevelDef } from './api/helpers.js';

/**
 * Match class handles a single room or lobby. It keeps track of players, game
 * state(e.g. WAITING vs IN_PROGRESS vs POST_GAME), handles/routes socket messages,
 * and wraps the engine which handles the actual game state. Match receives updates
 * from players, tells the engine when to tick, and grabs snapshots from the engine
 * to send to players. It's responsible for running the engine and keeping clients synced
 * up with it.
 */
export class Match {
  private players = new Map<PlayerId, PlayerSession>(); // players keyed by PlayerId. Will map to Player class once(if?) implemented
  private phase: MatchPhase = 'WAITING';
  private minPlayers: number = 1;
  private countdownSeconds = 1;
  private simulation: Simulation;
  private lastSeen = Date.now(); //TODO:: add idle cleanup if a match hasn't done anything in a couple hours
  private awaitingAcks = new Set<PlayerId>();
  private afterAcks: (() => void) | null = null;
  private levelDef: LevelDefinition | null = null;

  constructor(
    public matchId: string,
    private broadcast: Broadcast,
    private levelId: string,
  ) {
    console.log(`Match created for level "${this.levelId}" with matchId: ${matchId}`);

    this.simulation = new Simulation(this.broadcastSnapshot.bind(this));
    this.loadLevel();
  }

  async loadLevel() {
    this.levelDef = await loadLevelDef(this.levelId);
    this.simulation.loadLevel(this.levelDef);
  }

  broadcastSnapshot(snapshot: TickSnapshot) {
    this.broadcast('snapshot', snapshot);
  }

  startGame() {
    this.broadcast('start_match', {}); //TODO:: make this display some UI message on client
    this.simulation.start();
  }

  async spawnPlayers() {
    this.players.forEach((player) => {
      this.simulation.spawnPlayer(player.playerId); //TODO:: check return type of spawnPlayer, if false then display error message
    });

    
    this.broadcast('load_level', this.levelDef);
    this.broadcast('initialize_world', this.simulation.getSnapshot());
  }

  startCountdown() {
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

  //Evaluates the current match status and then broadcasts it to all connected players
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

  /**************************************************************************
    ...............           SOCKET HANDLERS               .................
   **************************************************************************/
  //called when a new player joins this match
  onJoin(socket: Socket) {
    socket.data.playerId = socket.id as PlayerId; // TODO:: use real playerIds, will come from tickets once implemented. Also maybe add a createPlayerSession function to clean up the join handler
    const playerId = socket.data.playerId;
    const displayName = socket.data.displayName;
    const role = socket.data.role;

    this.players.set(playerId, { playerId, socketId: socket.id as SocketId, displayName, role, ready: false });

    console.log(`Socket ${socket.id} joined match ${this.matchId}`);
    socket.emit('match_joined', { role, displayName });

    setTimeout(() => this.broadcastStatus(), 1000);
  }

  getPhase() {
    return this.phase;
  }

  setPhase(val: MatchPhase) {
    if (this.phase == 'WAITING' && val == 'IN_PROGRESS') {
      this.phase = 'IN_PROGRESS_QUEUED';
      this.awaitingAcks.clear();

      //After all player acknowledge they are ready for new phase, call setCountdown
      this.players.forEach(p => {
        this.awaitingAcks.add(p.playerId);
        this.afterAcks = () => this.startGameplay();
      });
      this.broadcastStatus();
    } else {
      this.phase = val;
    }
  }

  startGameplay() {
    this.setPhase('IN_PROGRESS');
    this.spawnPlayers();
    this.startCountdown();
  }

  onClientReady(socket: Socket) {
    this.awaitingAcks.delete(socket.data.playerId);

    if (this.awaitingAcks.size === 0 && this.afterAcks) {
      this.afterAcks();
    }
  }

  //client sends this message when ready button is clicked
  onSetReady(socket: Socket, data: { ready: boolean }) {
    // if leader, then it's actually the Start button. Set phase to inProgress, gives clients 1s to load, then start match countdown
    if (socket.data.role === 'creator') {
      this.setPhase('IN_PROGRESS');
    } else {
      const player = this.players.get(socket.data.playerId);
      if (player) player.ready = data.ready;

      this.broadcastStatus();
    }
  }

  //not used yet TODO:: remove this if I don't end up using 'update' events
  onInput(playerId: PlayerId, inputVector: InputVector): void {
    this.simulation.addInput(playerId, inputVector);
  }

  //called on socket disconnect
  onLeave(socket: Socket) {
    console.log(`Socket ${socket.id} left match ${this.matchId}`);
    if (socket.data.playerId) {
      this.players.delete(socket.data.playerId);
      this.awaitingAcks.delete(socket.data.playerId);
    }
    
    this.broadcastStatus();
  }

  isEmpty() {
    return this.players.size === 0;
  }

  destroy() {
    this.simulation.stop();
  }
}
