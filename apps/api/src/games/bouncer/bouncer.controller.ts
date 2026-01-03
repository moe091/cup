import { Controller, Get, Param, Post } from '@nestjs/common';
import { LobbyService } from '../lobby/lobby.service';
import { LobbyJoinResponse } from '../lobby/lobby.types';

@Controller('games/bouncer')
export class BouncerController {
    constructor(private readonly lobbyService: LobbyService) {}

    @Post('join/:matchId')
    joinMatch(@Param('matchId') matchId: string) {
        // do a bunch of stuff to check if match exists, is full, etc.

        return { matchId }; // add ticket to this eventually
    }

    @Post('create')
    async createMatch(): Promise<LobbyJoinResponse> {
        return this.lobbyService.createLobby({
            gameId: 'bouncer',
            socketUrl: 'http://localhost:4001/bouncer',
            maxPlayers: 4,
        });
    }
}

