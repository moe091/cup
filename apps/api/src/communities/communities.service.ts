import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CommunityChannelDto,
  CommunitySettingsDto,
  CommunitySummaryDto,
  CommunityJoinMode,
  CreateCommunityRequestDto,
  CreateCommunityResponseDto,
  DeleteCommunityResponseDto,
  GetPublicCommunitiesQueryDto,
  JoinCommunityResponseDto,
  LeaveCommunityResponseDto,
  MyCommunitiesResponseDto,
  CommunityIconUploadTargetRequestDto,
  CommunityIconUploadTargetResponseDto,
  PublicCommunitiesResponseDto,
  UpdateCommunityIconRequestDto,
  UpdateCommunitySettingsRequestDto,
  CreateChannelRequestDTO,
  CreateChannelResponseDTO,
  UpdateChannelRequestDTO,
  UpdateChannelResponseDTO,
  DeleteChannelResponseDTO,
} from '@cup/shared-types';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import { DEFAULT_COMMUNITY_PERMISSION_CONFIG, readCommunityPermissionConfig } from './community-permissions';

const COMMUNITY_NAME_MAX_LENGTH = 60;
const COMMUNITY_DESCRIPTION_MAX_LENGTH = 240;
const DEFAULT_PUBLIC_CHANNEL_LEVEL = 0;
const DEFAULT_NON_PUBLIC_CHANNEL_LEVEL = 1;
const PUBLIC_COMMUNITY_DEFAULT_LIMIT = 20;
const PUBLIC_COMMUNITY_MAX_LIMIT = 50;
const CHANNEL_NAME_MAX_LENGTH = 60;
const MIN_PERMISSION_LEVEL = 0;
const MAX_PERMISSION_LEVEL = 10;

@Injectable()
export class CommunitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async createCommunity(userId: string, payload: CreateCommunityRequestDto): Promise<CreateCommunityResponseDto> {
    const parsed = this.parseCreateCommunityPayload(payload);
    const slug = await this.generateUniqueCommunitySlug(parsed.name);
    const defaultRequiredPermissionLevel =
      parsed.joinMode === 'PUBLIC' ? DEFAULT_PUBLIC_CHANNEL_LEVEL : DEFAULT_NON_PUBLIC_CHANNEL_LEVEL;

    const created = await this.prisma.$transaction(async (tx) => {
      const community = await tx.community.create({
        data: {
          name: parsed.name,
          description: parsed.description,
          slug,
          joinMode: parsed.joinMode,
          ownerUserId: userId,
          iconKey: null,
          permissionConfig: DEFAULT_COMMUNITY_PERMISSION_CONFIG,
        },
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          joinMode: true,
          iconKey: true,
        },
      });

      await tx.communityMember.create({
        data: {
          communityId: community.id,
          userId,
          primaryRole: 'owner',
          permissionLevel: 10,
        },
      });

      await tx.channel.createMany({
        data: [
          {
            communityId: community.id,
            name: 'General',
            kind: 'COMMUNITY',
            visibility: 'PUBLIC',
            requiredPermissionLevel: defaultRequiredPermissionLevel,
            createdByUserId: userId,
          },
          {
            communityId: community.id,
            name: 'Welcome',
            kind: 'COMMUNITY',
            visibility: 'PUBLIC',
            requiredPermissionLevel: defaultRequiredPermissionLevel,
            createdByUserId: userId,
          },
        ],
      });

      return community;
    });

    return {
      id: created.id,
      slug: created.slug,
      name: created.name,
      description: created.description,
      joinMode: created.joinMode as CommunityJoinMode,
      iconKey: created.iconKey,
    };
  }

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

    if (!comm) {
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

  async getCommunitySettingsBySlug(slug: string, viewerUserId?: string): Promise<CommunitySettingsDto> {
    const normalizedSlug = slug.trim();
    if (!normalizedSlug) {
      throw new BadRequestException('Community slug is required');
    }

    const community = await this.prisma.community.findUnique({
      where: { slug: normalizedSlug },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        joinMode: true,
        iconKey: true,
        permissionConfig: true,
      },
    });

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    let viewerPermissionLevel = 0;
    if (viewerUserId) {
      const membership = await this.prisma.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: community.id,
            userId: viewerUserId,
          },
        },
        select: { permissionLevel: true },
      });
      viewerPermissionLevel = membership?.permissionLevel ?? 0;
    }

    const permissionConfig = readCommunityPermissionConfig(community.permissionConfig);

    return {
      id: community.id,
      slug: community.slug,
      name: community.name,
      description: community.description,
      joinMode: community.joinMode as CommunityJoinMode,
      iconKey: community.iconKey,
      permissionConfig,
      viewerPermissionLevel,
      canEditGeneral: viewerPermissionLevel >= permissionConfig.editGeneral,
    };
  }

  async updateCommunitySettingsBySlug(
    requesterUserId: string,
    slug: string,
    payload: UpdateCommunitySettingsRequestDto,
  ): Promise<CommunitySettingsDto> {
    const normalizedSlug = slug.trim();
    if (!normalizedSlug) {
      throw new BadRequestException('Community slug is required');
    }

    const parsed = this.parseCreateCommunityPayload(payload);

    const community = await this.prisma.community.findUnique({
      where: { slug: normalizedSlug },
      select: { id: true, permissionConfig: true },
    });
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    const permissionConfig = readCommunityPermissionConfig(community.permissionConfig);
    const membership = await this.prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: community.id,
          userId: requesterUserId,
        },
      },
      select: { permissionLevel: true },
    });
    const viewerPermissionLevel = membership?.permissionLevel ?? 0;
    if (viewerPermissionLevel < permissionConfig.editGeneral) {
      throw new ForbiddenException('You do not have permission to edit this community');
    }

    const updated = await this.prisma.community.update({
      where: { id: community.id },
      data: {
        name: parsed.name,
        description: parsed.description,
        joinMode: parsed.joinMode,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        joinMode: true,
        iconKey: true,
        permissionConfig: true,
      },
    });

    return {
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      description: updated.description,
      joinMode: updated.joinMode as CommunityJoinMode,
      iconKey: updated.iconKey,
      permissionConfig: readCommunityPermissionConfig(updated.permissionConfig),
      viewerPermissionLevel,
      canEditGeneral: true,
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

  async requestCommunityIconUploadTarget(
    requesterUserId: string,
    communityIdRaw: string,
    payload: CommunityIconUploadTargetRequestDto,
  ): Promise<CommunityIconUploadTargetResponseDto> {
    const communityId = communityIdRaw.trim();
    if (!communityId) {
      throw new BadRequestException('communityId is required');
    }
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('payload must be an object');
    }
    if (typeof payload.mimeType !== 'string') {
      throw new BadRequestException('mimeType must exist and be a string');
    }
    if (typeof payload.sizeBytes !== 'number') {
      throw new BadRequestException('sizeBytes must exist and be a number');
    }
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { id: true, ownerUserId: true },
    });
    if (!community) {
      throw new NotFoundException('Community not found');
    }
    if (community.ownerUserId !== requesterUserId) {
      throw new ForbiddenException('Only the community owner can upload community icon');
    }

    const MAX_ICON_SIZE_BYTES = 2 * 1024 * 1024;
    if (payload.sizeBytes > MAX_ICON_SIZE_BYTES) {
      throw new BadRequestException(`Community icon must be <= ${MAX_ICON_SIZE_BYTES} bytes`);
    }

    return this.storageService.createCommunityIconUploadTarget(communityId, payload.mimeType);
  }

  async updateCommunityIcon(
    requesterUserId: string,
    communityIdRaw: string,
    payload: UpdateCommunityIconRequestDto,
  ): Promise<CreateCommunityResponseDto> {
    const communityId = communityIdRaw.trim();
    if (!communityId) {
      throw new BadRequestException('communityId is required');
    }

    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Invalid request body');
    }

    if (!Object.hasOwn(payload, 'iconKey')) {
      throw new BadRequestException('iconKey is required');
    }

    if (payload.iconKey !== null && typeof payload.iconKey !== 'string') {
      throw new BadRequestException('iconKey must be a string or null');
    }

    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { id: true, ownerUserId: true },
    });
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    if (community.ownerUserId !== requesterUserId) {
      throw new ForbiddenException('Only the community owner can update community icon');
    }

    const iconKey = payload.iconKey?.trim() ?? null;
    if (iconKey) {
      const envPrefix = process.env.S3_ENV_PREFIX ?? 'dev';
      const requiredPrefix = `${envPrefix}/communities/${communityId}/`;
      if (!iconKey.startsWith(requiredPrefix)) {
        throw new BadRequestException('iconKey is not valid for this community');
      }
    }

    const updated = await this.prisma.community.update({
      where: { id: communityId },
      data: { iconKey },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        joinMode: true,
        iconKey: true,
      },
    });

    return {
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      description: updated.description,
      joinMode: updated.joinMode as CommunityJoinMode,
      iconKey: updated.iconKey,
    };
  }

  async getPublicCommunities(
    query: GetPublicCommunitiesQueryDto,
    viewerUserId?: string,
  ): Promise<PublicCommunitiesResponseDto> {
    const parsedLimit = Number.parseInt(String(query.limit ?? PUBLIC_COMMUNITY_DEFAULT_LIMIT), 10);
    const limit = Number.isNaN(parsedLimit)
      ? PUBLIC_COMMUNITY_DEFAULT_LIMIT
      : Math.min(Math.max(parsedLimit, 1), PUBLIC_COMMUNITY_MAX_LIMIT);
    const search = query.search?.trim();

    const rows = await this.prisma.community.findMany({
      where: {
        joinMode: 'PUBLIC',
        ...(search
          ? {
              OR: [
                {
                  name: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
                {
                  description: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor
        ? {
            cursor: { id: query.cursor },
            skip: 1,
          }
        : {}),
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        joinMode: true,
        iconKey: true,
        createdAt: true,
        _count: {
          select: {
            members: true,
          },
        },
        ...(viewerUserId
          ? {
              members: {
                where: {
                  userId: viewerUserId,
                },
                select: {
                  userId: true,
                },
                take: 1,
              },
            }
          : {}),
      },
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: items.map((community) => ({
        id: community.id,
        slug: community.slug,
        name: community.name,
        description: community.description,
        joinMode: community.joinMode as CommunityJoinMode,
        iconKey: community.iconKey,
        createdAt: community.createdAt.toISOString(),
        memberCount: community._count.members,
        joinedByMe: viewerUserId && 'members' in community ? community.members.length > 0 : false,
      })),
      nextCursor: hasMore ? rows[limit].id : null,
    };
  }

  async joinCommunityBySlug(userId: string, slug: string): Promise<JoinCommunityResponseDto> {
    const normalizedSlug = slug.trim();
    if (!normalizedSlug) {
      throw new BadRequestException('Community slug is required');
    }

    const community = await this.prisma.community.findUnique({
      where: { slug: normalizedSlug },
      select: { id: true, slug: true, joinMode: true },
    });

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    if (community.joinMode !== 'PUBLIC') {
      throw new ForbiddenException('Only public communities can be joined directly');
    }

    const existingMembership = await this.prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: community.id,
          userId,
        },
      },
      select: { userId: true },
    });

    if (existingMembership) {
      return {
        communityId: community.id,
        slug: community.slug,
        joined: false,
      };
    }

    await this.prisma.communityMember.create({
      data: {
        communityId: community.id,
        userId,
        primaryRole: 'member',
        permissionLevel: 1,
      },
    });

    return {
      communityId: community.id,
      slug: community.slug,
      joined: true,
    };
  }

  async leaveCommunityBySlug(userId: string, slug: string): Promise<LeaveCommunityResponseDto> {
    const normalizedSlug = slug.trim();
    if (!normalizedSlug) {
      throw new BadRequestException('Community slug is required');
    }

    const community = await this.prisma.community.findUnique({
      where: { slug: normalizedSlug },
      select: { id: true, slug: true, ownerUserId: true },
    });

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    if (community.ownerUserId === userId) {
      throw new ForbiddenException('Community owner cannot leave their own community');
    }

    const existingMembership = await this.prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: community.id,
          userId,
        },
      },
      select: { userId: true },
    });

    if (!existingMembership) {
      return {
        communityId: community.id,
        slug: community.slug,
        left: false,
      };
    }

    await this.prisma.communityMember.delete({
      where: {
        communityId_userId: {
          communityId: community.id,
          userId,
        },
      },
    });

    return {
      communityId: community.id,
      slug: community.slug,
      left: true,
    };
  }

  async deleteCommunityBySlug(userId: string, slug: string): Promise<DeleteCommunityResponseDto> {
    const normalizedSlug = slug.trim();
    if (!normalizedSlug) {
      throw new BadRequestException('Community slug is required');
    }

    const community = await this.prisma.community.findUnique({
      where: { slug: normalizedSlug },
      select: { id: true, slug: true, ownerUserId: true },
    });

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    if (community.ownerUserId !== userId) {
      throw new ForbiddenException('Only the community owner can delete this community');
    }

    await this.prisma.community.delete({
      where: { id: community.id },
    });

    return {
      communityId: community.id,
      slug: community.slug,
      deleted: true,
    };
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

    return memberships.map((membership) => ({
      id: membership.community.id,
      slug: membership.community.slug,
      name: membership.community.name,
      iconKey: membership.community.iconKey,
      permissionLevel: membership.permissionLevel,
      joinedAt: membership.joinedAt.toISOString(),
    }));
  }

  async createCommunityChannel(
    userId: string,
    slug: string,
    body: CreateChannelRequestDTO,
  ): Promise<CreateChannelResponseDTO> {
    if (!slug) throw new BadRequestException('valid community slug is required');

    if (
      !Number.isFinite(body.requiredPermissionLevel) ||
      body.requiredPermissionLevel > MAX_PERMISSION_LEVEL ||
      body.requiredPermissionLevel < MIN_PERMISSION_LEVEL
    )
      throw new BadRequestException(
        `permission level must be a number from ${MIN_PERMISSION_LEVEL} to ${MAX_PERMISSION_LEVEL}`,
      );

    const channelName = body.name.trim();

    if (!channelName || channelName.length >= CHANNEL_NAME_MAX_LENGTH)
      throw new BadRequestException(`must specify channel name that is ${CHANNEL_NAME_MAX_LENGTH} characters or less`);

    const community = await this.prisma.community.findUnique({
      where: { slug },
      select: { id: true, permissionConfig: true },
    });

    if (!community) throw new NotFoundException('Community not found');

    const perms = readCommunityPermissionConfig(community.permissionConfig); //throws automatically if perm config is malformed

    const member = await this.prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: community.id,
          userId: userId,
        },
      },
      select: { permissionLevel: true },
    });

    if (!member) throw new ForbiddenException('non-community-members cannot create channels in a community');

    if (member.permissionLevel < perms.createChannel)
      throw new ForbiddenException(
        "You don't have the required permission level to create a channel in this community",
      );

    const created = await this.prisma.channel.create({
      data: {
        communityId: community.id,
        name: channelName,
        kind: 'COMMUNITY',
        visibility: 'PUBLIC',
        requiredPermissionLevel: body.requiredPermissionLevel,
        createdByUserId: userId,
      },
      select: {
        id: true,
        name: true,
        requiredPermissionLevel: true,
        createdAt: true,
      },
    });

    return {
      id: created.id,
      name: created.name,
      requiredPermissionLevel: created.requiredPermissionLevel,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async updateCommunityChannel(
    userId: string,
    slug: string,
    channelId: string,
    body: UpdateChannelRequestDTO,
  ): Promise<UpdateChannelResponseDTO> {
    if (!slug) throw new BadRequestException('valid community slug is required');

    if (!channelId) throw new BadRequestException('valid channel id is required');

    const channelName = body.name.trim();

    if (!channelName || channelName.length >= CHANNEL_NAME_MAX_LENGTH)
      throw new BadRequestException(`must specify channel name that is ${CHANNEL_NAME_MAX_LENGTH} characters or less`);

    const community = await this.prisma.community.findUnique({
      where: { slug },
      select: { id: true, permissionConfig: true },
    });

    if (!community) throw new NotFoundException('Community not found');

    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { communityId: true },
    });

    if (!channel || channel.communityId !== community.id) throw new NotFoundException('Channel not found');

    const perms = readCommunityPermissionConfig(community.permissionConfig); //throws automatically if perm config is malformed

    const member = await this.prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: community.id,
          userId: userId,
        },
      },
      select: { permissionLevel: true },
    });

    if (!member) throw new ForbiddenException('non-community-members cannot edit channels in a community');

    if (member.permissionLevel < perms.editChannelName)
      throw new ForbiddenException("You don't have the required permission level to edit channels in this community");

    const updated = await this.prisma.channel.update({
      where: { id: channelId },
      data: {
        name: channelName,
      },
      select: {
        id: true,
        name: true,
        requiredPermissionLevel: true,
        createdAt: true,
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      requiredPermissionLevel: updated.requiredPermissionLevel,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async deleteCommunityChannel(userId: string, slug: string, channelId: string): Promise<DeleteChannelResponseDTO> {
    if (!slug) throw new BadRequestException('valid community slug is required');

    if (!channelId) throw new BadRequestException('valid channel id is required');

    const community = await this.prisma.community.findUnique({
      where: { slug },
      select: { id: true, permissionConfig: true },
    });

    if (!community) throw new NotFoundException('Community not found');

    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { communityId: true },
    });

    if (!channel || channel.communityId !== community.id) throw new NotFoundException('Channel not found');

    const perms = readCommunityPermissionConfig(community.permissionConfig); //throws automatically if perm config is malformed

    const member = await this.prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: community.id,
          userId: userId,
        },
      },
      select: { permissionLevel: true },
    });

    if (!member) throw new ForbiddenException('non-community-members cannot delete channels in a community');

    if (member.permissionLevel < perms.deleteChannel)
      throw new ForbiddenException("You don't have the required permission level to delete channels in this community");

    await this.prisma.channel.delete({
      where: { id: channelId },
    });

    return {
      id: channelId,
      deleted: true,
    };
  }

  private parseCreateCommunityPayload(payload: CreateCommunityRequestDto): {
    name: string;
    joinMode: CommunityJoinMode;
    description: string | null;
  } {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Invalid request body');
    }

    if (typeof payload.name !== 'string') {
      throw new BadRequestException('name is required');
    }

    const name = payload.name.trim();
    if (!name) {
      throw new BadRequestException('name is required');
    }

    if (name.length > COMMUNITY_NAME_MAX_LENGTH) {
      throw new BadRequestException(`name must be ${COMMUNITY_NAME_MAX_LENGTH} characters or less`);
    }

    if (payload.joinMode !== 'PUBLIC' && payload.joinMode !== 'REQUEST' && payload.joinMode !== 'INVITE_ONLY') {
      throw new BadRequestException('joinMode is invalid');
    }

    if (payload.description !== undefined && payload.description !== null && typeof payload.description !== 'string') {
      throw new BadRequestException('description must be a string or null');
    }

    const descriptionRaw = payload.description?.trim() ?? '';
    if (descriptionRaw.length > COMMUNITY_DESCRIPTION_MAX_LENGTH) {
      throw new BadRequestException(`description must be ${COMMUNITY_DESCRIPTION_MAX_LENGTH} characters or less`);
    }

    return {
      name,
      joinMode: payload.joinMode,
      description: descriptionRaw ? descriptionRaw : null,
    };
  }

  private toBaseSlug(name: string): string {
    const normalized = name.toLowerCase().trim();
    const slug = normalized
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return slug || `community-${Date.now()}`;
  }

  private async generateUniqueCommunitySlug(name: string): Promise<string> {
    const baseSlug = this.toBaseSlug(name);
    let slug = baseSlug;
    let suffix = 2;

    while (await this.prisma.community.findUnique({ where: { slug }, select: { id: true } })) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    return slug;
  }
}
