import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CommunityChannelDto, CommunitySummaryDto, MyCommunitiesResponseDto } from '@cup/shared-types';
import { PrismaService } from 'src/prisma/prisma.service';
import { userInfo } from 'os';

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

    let viewerPermissionLevel = 0;

    if (viewerUserId) {
      const membership = await this.prisma.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: comm.id,
            userId: viewerUserId,
          },
        },
        select: {
          permissionLevel: true,
        },
      });

      viewerPermissionLevel = membership?.permissionLevel ?? 0;
    }

    const channels = await this.prisma.channel.findMany({
      where: {
        communityId: comm.id,
        requiredPermissionLevel: {
          lte: viewerPermissionLevel,
        },
      },
      orderBy: [{createdAt: 'asc'}, {id: 'asc'}],
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

  async getMyCommunities(userId: string): Promise<MyCommunitiesResponseDto> {
    const memberships = await this.prisma.communityMember.findMany({
      where: {
        userId: userId,
      },
      select: {
        permissionLevel: true,
        joinedAt: true,
        community: {
          select: {
            id: true,
            slug: true,
            name: true,
            iconKey: true,
          },
        },
      },
      orderBy: [{ joinedAt: 'desc' }, { communityId: 'asc' }],
    });

    return memberships
      .filter((membership) => membership.community.slug)
      .map((membership) => ({
        id: membership.community.id,
        slug: membership.community.slug as string,
        name: membership.community.name,
        iconKey: membership.community.iconKey,
        permissionLevel: membership.permissionLevel,
        joinedAt: membership.joinedAt.toISOString(),
      }));
    }

}
