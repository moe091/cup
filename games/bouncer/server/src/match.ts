import type { Socket } from 'socket.io';
import type { PlayerId, SocketId, PlayerSession, Broadcast } from './types.js';
import type { MatchStatus, MatchPhase, MatchCountdown } from '@cup/bouncer-shared';
import { Engine } from '@cup/bouncer-engine';
import { performance } from 'node:perf_hooks';


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
  private engine = new Engine();
  private countdownTimer: NodeJS.Timeout | null = null;
  private tickTimer: NodeJS.Timeout | null = null;
  private tickMs = 33;
  private countdownSeconds = 5;


  constructor(
    public matchId: string,
    private broadcast: Broadcast,
  ) {
    console.log('Match created with ID:', matchId);
  }



  startGame() {
    //start up the engine, spawn in players, etc.
    this.broadcast('start_match', {});
    console.log("GAME STARTED!!!!!!!!!!!!!!!!!!");
  }

  startCountdown() {
    this.phase = "IN_PROGRESS";
    let countdownTimer = this.countdownSeconds;

    const countdownSecond = () => {
      if (countdownTimer <= 0) {
        this.startGame();
      } else {
        this.broadcast('countdown', {secondsLeft: countdownTimer} as MatchCountdown);
        countdownTimer--;
        setTimeout(() => countdownSecond(), 1000);
      }
    }

    countdownSecond();
  }



  /**************************************************************************
    .................            GAME STATUS               ..................
   **************************************************************************/
  //updates status by checking minPlayers and playerList to make sure everyone is here and ready. BroadcastStatus should be called to update players
  updateStatus() {
    if (this.phase == 'WAITING') {
      let ready = true; //assume ready is true, will be set to false if not enough players, or if any players haven't readied up

      if (this.players.size < this.minPlayers) {
        //check if enough players
        ready = false;
      } else {
        for (const [pid, session] of this.players) {
          //if any player isn't ready, set ready is false
          if (!session.ready) {
            ready = false;
            break;
          }
        }
      }

      if (ready) {
        //if everyone is here and ready, then start the match
        this.startCountdown();
        
      }
    } else if (this.phase == 'IN_PROGRESS') {
      // check if match is over
    }
  }

  //Evaluates the current match status and then broadcasts it to all connected players
  broadcastStatus() {
    this.updateStatus();

    const status: MatchStatus = {
      matchId: this.matchId,
      phase: this.phase,
      minPlayers: this.minPlayers,
      players: Array.from(this.players.values()).map((player) => ({
        playerId: player.playerId,
        displayName: player.displayName,
        ready: player.ready,
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
    const displayName = `player-${socket.id.slice(0, 6)}`;

    this.players.set(playerId, { playerId, socketId: socket.id as SocketId, displayName, ready: false });

    console.log(`Socket ${socket.id} joined match ${this.matchId}`);
    socket.emit('match_joined', `Welcome to room ${this.matchId}`);

    this.broadcastStatus();
  }

  //client sends this message when ready button is clicked
  onSetReady(socket: Socket, data: { ready: boolean }) {
    const player = this.players.get(socket.data.playerId);
    if (player) player.ready = data.ready;

    this.broadcastStatus();
  }

  //not used yet TODO:: remove this if I don't end up using 'update' events
  onUpdate(socket: Socket, data: unknown): void {
    console.log(`Received update from socket ${socket.id} in match ${this.matchId}:`, data);
  }

  //called on socket disconnect
  onLeave(socket: Socket) {
    console.log(`Socket ${socket.id} left match ${this.matchId}`);
    if (socket.data.playerId) this.players.delete(socket.data.playerId);

    this.broadcastStatus();
  }
}
