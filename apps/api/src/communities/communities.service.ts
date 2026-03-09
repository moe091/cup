import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CommunityChannelDto, CommunitySummaryDto } from '@cup/shared-types';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CommunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async getCommunityBySlug(slug: string): Promise<CommunitySummaryDto> {
    const normalizedSlug = slug.trim();
    if (!normalizedSlug) {
      throw new BadRequestException('Community slug is required');
    }

    const comm = await this.prisma.community.findUnique({
      where: { slug: normalizedSlug },
      select: {
        id: true,
        name: true,
        description: true,
        slug: true,
        ownerUserId: true,
        createdAt: true,
        owner: {
          select: {
            displayName: true,
            username: true,
          },
        },
        _count: {
          select: {
            channels: true,
          },
        },
      },
    });

    if (!comm || !comm.slug) {
      throw new NotFoundException('Community not found');
    }

    return {
      id: comm.id,
      name: comm.name,
      description: comm.description,
      slug: comm.slug,
      ownerUserId: comm.ownerUserId,
      ownerDisplayName: comm.owner?.displayName ?? comm.owner?.username ?? null,
      createdAt: comm.createdAt.toISOString(),
      channelCount: comm._count.channels,
    };
  }

  async getCommunityChannelsBySlug(slug: string, viewerUserId?: string): Promise<CommunityChannelDto[]> {
    const normalizedSlug = slug.trim();
    if (!normalizedSlug) {
      throw new BadRequestException('Community slug is required');
    }

    const comm = await this.prisma.community.findUnique({
      where: { slug: normalizedSlug },
      select: { id: true },
    });
    if (!comm) {
      throw new NotFoundException('Community not found');
    }

    const channels = viewerUserId
      ? await this.prisma.channel.findMany({
          where: {
            communityId: comm.id,
            OR: [{ visibility: 'PUBLIC' }, { members: { some: { userId: viewerUserId } } }],
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            name: true,
            kind: true,
            visibility: true,
            createdAt: true,
          },
        })
      : await this.prisma.channel.findMany({
          where: {
            communityId: comm.id,
            visibility: 'PUBLIC',
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            name: true,
            kind: true,
            visibility: true,
            createdAt: true,
          },
        });

    return channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      kind: channel.kind,
      visibility: channel.visibility,
      createdAt: channel.createdAt.toISOString(),
    }));
  }
}
