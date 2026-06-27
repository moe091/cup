import { Controller, Param, Post, Req, Res } from '@nestjs/common';
import { NotFoundException, GoneException, ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuthedRequest } from 'src/auth/auth.types';
import type { Response } from 'express';
import { LobbyService } from '../lobby/lobby.service';
import type { LobbyJoinResponse } from '../lobby/lobby.types';
import type { LobbyCreateResponse } from '@cup/shared-types';

@Controller('games/spellduel')
export class SpellDuelController {
  constructor(private readonly lobbyService: LobbyService) {}

  @Post('create')
  async createMatch(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LobbyCreateResponse> {
    const socketUrl = process.env.SPELLDUEL_SERVER_URL;
    if (!socketUrl) throw new Error('SPELLDUEL_SERVER_URL is not set');

    let guestId = req.cookies?.guestId as string;

    if (!req.user && !guestId) {
      guestId = randomUUID();
      res.cookie('guestId', guestId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });
    }

    return this.lobbyService.createLobby({
      gameId: 'spellduel',
      socketUrl,
      maxPlayers: 4,
      createdByUserId: req.user?.id as string,
      createdByGuestId: req.user?.id ? undefined : guestId,
    });
  }

  @Post('join/:matchId')
  async joinMatch(@Param('matchId') matchId: string, @Req() req: AuthedRequest): Promise<LobbyJoinResponse> {
    const lobby = await this.lobbyService.findLobbyByMatchId('spellduel', matchId);

    if (!lobby) throw new NotFoundException('Lobby not found');
    if (lobby.expiresAt && lobby.expiresAt < new Date()) throw new GoneException('Lobby has expired');
    if (lobby.status !== 'OPEN') throw new ConflictException('Lobby is not open for joining');

    const userId = (req.user?.id as string) || (req.cookies?.guestId as string) || randomUUID();
    const ticket = this.lobbyService.getTicket(lobby, userId, req.user?.displayName || 'Guest');

    return { matchId: lobby.matchId, socketUrl: lobby.socketUrl, ticket };
  }
}
