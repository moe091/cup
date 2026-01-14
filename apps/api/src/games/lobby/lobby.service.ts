import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateLobbyInput, LobbyJoinResponse, LobbyTicketPayload } from './lobby.types';
import type { Lobby } from 'src/generated/prisma/client';
import { LobbyCreateResponse } from '@cup/shared-types';
import jwt from 'jsonwebtoken';

@Injectable()
export class LobbyService {
  constructor(private readonly prisma: PrismaService) {}

  async createLobby(input: CreateLobbyInput): Promise<LobbyCreateResponse> {
    const lobby = await this.prisma.lobby.create({ data: input });
    return { matchId: lobby.matchId, socketUrl: lobby.socketUrl };
  }

  async findLobbyByMatchId(gameId: string, matchId: string): Promise<Lobby | null> {
    const lobby = await this.prisma.lobby.findFirst({
      where: { matchId, gameId },
    });

    return lobby;
  }

  async getTicket(gameId: string, matchId: string, userId: string, displayName: string): Promise<string> {
    const ticketPayload: LobbyTicketPayload = {
      sub: userId,
      gameId: gameId,
      matchId: matchId,
      role: 'player', //check if user id matches creator id in lobby row
      displayName: displayName,
    };
    const secret = process.env.GAME_TICKET_SECRET;
    if (!secret) throw new Error('GAME_TICKET_SECRET not found');

    return jwt.sign(ticketPayload, secret, { expiresIn: '60m' });
  }
}
