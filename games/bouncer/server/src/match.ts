import { Socket as SocketIO, DefaultEventsMap } from "socket.io";
import type { Socket } from "socket.io";


export class Match {
    id: string;
    private players = new Map<string, { name: string }>(); // players keyed by socket id. Will map to Player class once implemented


    constructor(public matchId: string) {
        this.id = matchId;
        console.log("Match created with ID:", matchId);
    }
    
    // create onJoin function that takes a Socket.io socket type as paramater
    onJoin(socket: Socket) {
        this.players.set(socket.id, { name: `player-${socket.id.slice(0, 6)}` });

        console.log(`Socket ${socket.id} joined match ${this.matchId}`);
        socket.emit('match_joined', `Welcome to room ${this.matchId}`);
    }

    
    onUpdate(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>, data: any): void {
      console.log(`Received update from socket ${socket.id} in match ${this.matchId}:`, data);
    }
    
    onLeave(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) {
      console.log(`Socket ${socket.id} left match ${this.matchId}`);
    }
}