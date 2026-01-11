import { Body, Controller, Param, Post, BadRequestException } from '@nestjs/common';
import { LobbyService } from '../lobby/lobby.service';
import { LobbyJoinResponse } from '../lobby/lobby.types';
import { NotFoundException, GoneException, ConflictException } from '@nestjs/common';
import type { LevelDefinition } from '@cup/bouncer-shared';
import { promises as fs } from 'node:fs';
import path from 'node:path';

@Controller('games/bouncer')
export class BouncerController {
  //TODO:: grab user from Req and generate tickets
  constructor(private readonly lobbyService: LobbyService) {}

  @Post('join/:matchId')
  async joinMatch(@Param('matchId') matchId: string): Promise<LobbyJoinResponse> {
    const lobby = await this.lobbyService.findLobbyByMatchId('bouncer', matchId);

    if (!lobby) throw new NotFoundException('Lobby not found');
    else if (lobby.expiresAt && lobby.expiresAt < new Date()) throw new GoneException('Lobby has expired');
    else if (lobby.status !== 'OPEN') throw new ConflictException('Lobby is not open for joining');

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

  @Post('levels')
  async saveLevel(@Body() level: LevelDefinition): Promise<{ name: string }> {
    if (!level?.name) {
      throw new BadRequestException('Level name is required');
    }

    const dir = path.join(process.cwd(), 'tmp', 'bouncer-levels');
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${level.name}.json`);
    await fs.writeFile(filePath, JSON.stringify(level, null, 2), 'utf8');

    return { name: level.name };
  }
}
