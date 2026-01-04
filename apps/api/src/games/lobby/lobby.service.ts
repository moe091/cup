import { Injectable } from '@nestjs/common';
import { JsonArray } from 'src/generated/prisma/internal/prismaNamespace';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateLobbyInput, LobbyJoinResponse } from './lobby.types';
import type { Lobby, Prisma } from 'src/generated/prisma/client';

@Injectable()
export class LobbyService {
    constructor(private readonly prisma: PrismaService) {}

    async createLobby(input: CreateLobbyInput): Promise<LobbyJoinResponse> {
        const lobby = await this.prisma.lobby.create({ data: input });
        return {matchId: lobby.matchId, socketUrl: lobby.socketUrl};
    }

    
    async findLobbyByMatchId(gameId: string, matchId: string): Promise<Lobby | null> {
        const lobby = await this.prisma.lobby.findFirst({
            where: { matchId, gameId },
        });
        
        return lobby;
    }

}
