import { ChannelHistoryResponseDto, ChatTokenResponse } from '@cup/shared-types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { ChannelHistoryQueryParsed, ChannelHistoryQueryRaw } from './chat.types';
import { PrismaService } from 'src/prisma/prisma.service';
import type { Prisma } from 'src/generated/prisma/client';

const CHAT_TOKEN_TTL_SECONDS = 10 * 60;
const DEFAULT_MSG_LIMIT = 25;
const MAX_MSG_LIMIT = 200;

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  issueConnectionToken(userId: string): ChatTokenResponse {
    const secret = process.env.CHAT_TOKEN_SECRET;
    if (!secret) {
      throw new InternalServerErrorException('CHAT_TOKEN_SECRET is not configured');
    }

    const token = jwt.sign({ sub: userId, ver: 1 }, secret, {
      algorithm: 'HS256',
      expiresIn: CHAT_TOKEN_TTL_SECONDS,
      audience: 'chat',
      issuer: 'cup-api',
    });

    return {
      token,
      expiresInSeconds: CHAT_TOKEN_TTL_SECONDS,
    };
  }

  async getChannelHistory(
    channelId: string,
    userId: string | undefined,
    query: ChannelHistoryQueryParsed,
  ): Promise<ChannelHistoryResponseDto> {
    await this.assertCanViewChannel(channelId, userId);
    const where: Prisma.MessageWhereInput = {
      channelId,
    };

    if (query.beforeCreatedAt && query.beforeId) {
      //if we have beforeCreatedAt and beforeId(parsing ensures that we either have both or neither)
      where.OR = [
        { createdAt: { lt: query.beforeCreatedAt } }, //either createdAt is before query.createdAt
        {
          // OR createdAt EQUALS query.createdAt, and id is before query.id(basically, if 2 records have same createdAt, then use Id to determine order)
          AND: [{ createdAt: query.beforeCreatedAt }, { id: { lt: query.beforeId } }],
        },
      ];
    }

    const rows = await this.prisma.message.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1, //grab an extra row to see if more records exist, used to set 'hasMore' below
      select: {
        id: true,
        channelId: true,
        authorUserId: true,
        author: {
          select: {
            displayName: true,
            username: true,
          },
        },
        body: true,
        createdAt: true,
        editedAt: true,
        deletedAt: true,
      },
    });

    const hasMore = rows.length > query.limit; //if we got that 1 extra row then we know there are more records
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
    const last = pageRows[pageRows.length - 1];
    const nextCursor =
      hasMore && last
        ? {
            beforeCreatedAt: last.createdAt.toISOString(),
            beforeId: last.id,
          }
        : null;

    return {
      messages: pageRows.map((row) => ({
        id: row.id,
        channelId: row.channelId,
        authorUserId: row.authorUserId,
        authorDisplayName: row.author.displayName ?? row.author.username,
        body: row.body,
        createdAt: row.createdAt.toISOString(),
        editedAt: row.editedAt ? row.editedAt.toISOString() : null,
        deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      })),
      nextCursor,
    };
  }

  async assertCanViewChannel(channelId: string, viewerUserId?: string): Promise<void> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true, visibility: true },
    });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }
    if (channel.visibility === 'PUBLIC') {
      return;
    }
    if (!viewerUserId) {
      throw new ForbiddenException('You do not have access to this channel');
    }
    const membership = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId: viewerUserId,
        },
      },
      select: { channelId: true },
    });
    if (!membership) {
      throw new ForbiddenException('You do not have access to this channel');
    }
  }

  parseChannelHistoryQuery(query: ChannelHistoryQueryRaw): ChannelHistoryQueryParsed {
    const limitRaw = query.limit?.trim();
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : DEFAULT_MSG_LIMIT;

    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MSG_LIMIT)
      throw new BadRequestException(`limit must be an integer between 1 and ${MAX_MSG_LIMIT}`);

    const beforeCreatedAtRaw = query.beforeCreatedAt?.trim();
    const beforeIdRaw = query.beforeId?.trim();

    if (!!beforeCreatedAtRaw !== !!beforeIdRaw) {
      throw new BadRequestException('beforeCreatedAt and beforeId must both be provided(or neither)');
    }

    if (!beforeCreatedAtRaw || !beforeIdRaw) {
      return { limit };
    }

    const beforeCreatedAt = new Date(beforeCreatedAtRaw!);
    if (Number.isNaN(beforeCreatedAt.getTime())) {
      throw new BadRequestException('beforeCreatedAt must be a valid ISO timestamp');
    }

    return {
      limit,
      beforeCreatedAt,
      beforeId: beforeIdRaw!,
    };
  }

  async resolveAuthorDisplayName(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        displayName: true,
        username: true,
      },
    });
    if (!user) {
      return null;
    }
    return user.displayName ?? user.username;
  }

  async createMessage(args: {
    channelId: string;
    authorUserId: string;
    body: string;
  }) {
    const channelId = args.channelId.trim();
    const authorUserId = args.authorUserId.trim();
    const body = args.body.trim();
    if (!channelId) {
      throw new BadRequestException("channelId is required");
    }
    if (!authorUserId) {
      throw new BadRequestException("authorUserId is required");
    }
    if (!body) {
      throw new BadRequestException("Message body is required");
    }
    return this.prisma.message.create({
      data: {
        channelId,
        authorUserId,
        body,
      },
      select: {
        id: true,
        channelId: true,
        authorUserId: true,
        body: true,
        createdAt: true,
      },
    });
  }
}
