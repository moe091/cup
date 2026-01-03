import { Injectable } from '@nestjs/common';
import { JsonArray } from 'src/generated/prisma/internal/prismaNamespace';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateLobbyInput, LobbyJoinResponse } from './lobby.types';

@Injectable()
export class LobbyService {
    constructor(private readonly prisma: PrismaService) {}

    async createLobby(input: CreateLobbyInput): Promise<LobbyJoinResponse> {
        const lobby = await this.prisma.lobby.create({ data: input });
        return {matchId: lobby.matchId, socketUrl: lobby.socketUrl};
    }

}
