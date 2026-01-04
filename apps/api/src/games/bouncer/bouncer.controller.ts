import { Controller, Get, Param, Post } from '@nestjs/common';
import { LobbyService } from '../lobby/lobby.service';
import { LobbyJoinResponse } from '../lobby/lobby.types';
import { NotFoundException, GoneException, ConflictException } from '@nestjs/common';

@Controller('games/bouncer')
export class BouncerController { //TODO:: grab user from Req and generate tickets
    constructor(private readonly lobbyService: LobbyService) {}

    @Post('join/:matchId')
    async joinMatch(@Param('matchId') matchId: string): Promise<LobbyJoinResponse> {
        const lobby = await this.lobbyService.findLobbyByMatchId('bouncer', matchId);

        if (!lobby) 
            throw new NotFoundException('Lobby not found');
        else if (lobby.expiresAt && lobby.expiresAt < new Date())
            throw new GoneException('Lobby has expired');
        else if (lobby.status !== 'OPEN')
            throw new ConflictException('Lobby is not open for joining');

        return { matchId: lobby.matchId, socketUrl: lobby.socketUrl };
    }

    @Post('create')
    async createMatch(): Promise<LobbyJoinResponse> {
        const socketUrl = process.env.BOUNCER_SERVER_URL;
        if (!socketUrl) throw new Error('BOUNCER_SERVER_URL is not set');

        return this.lobbyService.createLobby({
            gameId: 'bouncer',
            socketUrl: socketUrl,
            maxPlayers: 4,
        });
    }
}

