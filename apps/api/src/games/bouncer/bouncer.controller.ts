import {
  Body,
  Controller,
  Param,
  Post,
  BadRequestException,
  Req,
  PayloadTooLargeException,
  Res,
  UnauthorizedException,
  Get,
} from '@nestjs/common';
import { LobbyService } from '../lobby/lobby.service';
import { LobbyJoinResponse, LobbyTicketPayload } from '../lobby/lobby.types';
import { NotFoundException, GoneException, ConflictException } from '@nestjs/common';
import type { LevelDefinition } from '@cup/bouncer-shared';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import type { AuthedRequest } from 'src/auth/auth.types';
import { randomUUID } from 'node:crypto';
import { LobbyCreateResponse } from '@cup/shared-types';
import type { Request, Response } from 'express';
import { BouncerService } from './bouncer.service';
import { UserScalarFieldEnum } from 'src/generated/prisma/internal/prismaNamespace';

@Controller('games/bouncer')
export class BouncerController {
  //TODO:: grab user from Req and generate tickets
  constructor(
    private readonly lobbyService: LobbyService,
    private readonly bouncerService: BouncerService,
  ) {}

  @Post('join/:matchId')
  async joinMatch(@Param('matchId') matchId: string, @Req() req: AuthedRequest): Promise<LobbyJoinResponse> {
    const lobby = await this.lobbyService.findLobbyByMatchId('bouncer', matchId);

    if (!lobby) throw new NotFoundException('Lobby not found');
    else if (lobby.expiresAt && lobby.expiresAt < new Date()) throw new GoneException('Lobby has expired');
    else if (lobby.status !== 'OPEN') throw new ConflictException('Lobby is not open for joining');

    const userId = req.user?.id || req.cookies?.guestId || randomUUID(); //TODO:: add getOrCreateGuestId to users service once I make one
    const ticket = await this.lobbyService.getTicket('bouncer', matchId, userId, req.user?.displayName || 'Guest');

    return { matchId: lobby.matchId, socketUrl: lobby.socketUrl, ticket };
  }

  @Post('create')
  async createMatch(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LobbyCreateResponse> {
    const socketUrl = process.env.BOUNCER_SERVER_URL;
    if (!socketUrl) throw new Error('BOUNCER_SERVER_URL is not set');

    let guestId = req.cookies?.guestId;

    if (!req.user && !guestId) {
      guestId = crypto.randomUUID();
      res.cookie('guestId', guestId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      });
    }

    return this.lobbyService.createLobby({
      gameId: 'bouncer',
      socketUrl: socketUrl,
      maxPlayers: 4,
      createdByUserId: req.user?.id,
      createdByGuestId: guestId,
    });
  }

  @Post('levelsOld')
  async saveLevelOld(@Body() level: LevelDefinition): Promise<{ name: string }> {
    if (!level?.name) {
      throw new BadRequestException('Level name is required');
    }

    const dir = path.join(process.cwd(), 'tmp', 'bouncer-levels');
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${level.name}.json`);
    await fs.writeFile(filePath, JSON.stringify(level, null, 2), 'utf8');

    return { name: level.name };
  }

  @Post('levels')
  async saveLevel(@Req() req: AuthedRequest, @Body() body: LevelDefinition) {
    if (!req.user?.id) throw new UnauthorizedException('Login required to save levels');
    if (!body?.name) throw new BadRequestException('Level name is required');

    console.log('Saving Level: ', body.name);
    const saved = await this.bouncerService.saveLevel(req.user.id, body.name, body);
  }

  // list all system levels, plus all levels created by the user if logged in
  @Get('levels')
  async listLevels(@Req() req: AuthedRequest) {
    let levels = req.user
      ? await this.bouncerService.listLevelsByUser(req.user.id, true)
      : await this.bouncerService.listSystemLevels();
      
    return levels;
  }

  @Get('levels/system/:levelName')
  async getSystemLevel(@Param('levelName') levelName: string) {
    if (!levelName) throw new BadRequestException("Level name must be specified");
    return this.bouncerService.getSystemLevel(levelName);
  }

  @Get('levels/:ownerUserId/:levelName')
  async getLevelByUser(@Param('ownerUserId') userId: string, @Param('levelName') levelName: string) {
    if (!userId) throw new BadRequestException("UserId must be specified");
    if (!levelName) throw new BadRequestException("LevelName must be specified");
    
    return this.bouncerService.getLevelByUser(userId, levelName);
  }

}
