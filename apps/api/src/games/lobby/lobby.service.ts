import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateLobbyInput, LobbyTicketPayload } from './lobby.types';
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

  getTicket(lobby: Lobby, userId: string, displayName: string): string {
    const isCreator =
      (lobby.createdByGuestId && lobby.createdByGuestId === userId) ||
      (lobby.createdByUserId && lobby.createdByUserId === userId);
    const ticketPayload: LobbyTicketPayload = {
      sub: userId,
      gameId: lobby.gameId,
      matchId: lobby.matchId,
      role: isCreator ? 'creator' : 'player',
      displayName: displayName,
    };

    const secret = process.env.GAME_TICKET_SECRET;
    if (!secret) throw new Error('GAME_TICKET_SECRET not found');

    return jwt.sign(ticketPayload, secret, { expiresIn: '60m' });
  }
}
