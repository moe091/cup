import { InputState, LevelDefinition } from "@cup/bouncer-shared";
import type { PlayerId, Player, PlayerSession } from "../types.js";
import { Simulation } from "./simulation.js";


export default class GameManager {
    private players = new Map<PlayerId, Player>();

    constructor(private simulation: Simulation) {

    }

    addPlayer(playerId: PlayerId, session: PlayerSession) {
        this.players.set(playerId, {playerId, isFinished: false, session});
    }

    getPlayer(playerId: PlayerId): Player | undefined {
        return this.players.get(playerId);
    }

    getPlayers(): Map<PlayerId, Player> {
      return this.players;
    }

    getPlayerSession(playerId: PlayerId): PlayerSession | undefined {
        return this.players.get(playerId)?.session;
    }

    playerFinished(playerId: PlayerId) {
        const player = this.players.get(playerId);

        console.log("[GameManager.playerFinished] Player Finished: ", player);
        if (player)
            player.isFinished = true;
        else
            console.warn("[GameManager.playerFinished] Player who doesn't exist somehow finished, something is wrong...", playerId);
    }

    spawnPlayers() {
      this.players.forEach((player) => {
        this.simulation.spawnPlayer(player.playerId); //TODO:: check return type of spawnPlayer, if false then display error message
      });
    }

    loadLevel(levelDef: LevelDefinition) {
      this.simulation.loadLevel(levelDef);
    }

    start() {
      this.simulation.start();
    }
    
    getPlayerStatus() {
      return Array.from(this.players.values()).map((player) => ({
        playerId: player.playerId,
        displayName: player.session.displayName,
        ready: player.session.ready,
        role: player.session.role,
      }));
    }
        
    setInputState(playerId: PlayerId, tick: number, input: InputState) {
      this.simulation.setInputState(playerId, tick, input);
    }

    setPlayerReady(playerId: PlayerId, ready: boolean) {
      const player = this.players.get(playerId);
      if (player) player.session.ready = ready;
    }
    
    deletePlayer(playerId: PlayerId) {
      this.players.delete(playerId);
    }
    
    isEmpty() {
      return this.players.size === 0;
    }
}
