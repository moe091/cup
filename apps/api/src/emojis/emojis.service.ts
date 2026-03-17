import { BadRequestException, Injectable } from '@nestjs/common';
import type { CustomEmojiDto, EmojiCatalogResponseDto } from '@cup/shared-types';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class EmojisService {
  constructor(private readonly prisma: PrismaService) {}

  async getCatalog(viewerUserId: string | undefined, communityIdRaw: string | undefined): Promise<EmojiCatalogResponseDto> {
    const communityId = this.normalizeCommunityId(communityIdRaw);

    const scopeFilters: Array<{ scopeType: 'GLOBAL' | 'COMMUNITY' | 'USER'; scopeId?: string }> = [{
      scopeType: 'GLOBAL',
    }];

    if (communityId) {
      scopeFilters.push({
        scopeType: 'COMMUNITY',
        scopeId: communityId,
      });
    }

    if (viewerUserId) {
      scopeFilters.push({
        scopeType: 'USER',
        scopeId: viewerUserId,
      });
    }

    const emojis = await this.prisma.customEmoji.findMany({
      where: {
        deletedAt: null,
        OR: scopeFilters,
      },
      orderBy: [{ scopeType: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    });

    return {
      emojis: emojis.map<CustomEmojiDto>((emoji) => ({
        id: emoji.id,
        name: emoji.name,
        scopeType: emoji.scopeType,
        scopeId: emoji.scopeId,
        assetUrl: emoji.assetUrl,
        createdByUserId: emoji.createdByUserId,
        createdAt: emoji.createdAt.toISOString(),
        updatedAt: emoji.updatedAt.toISOString(),
        deletedAt: emoji.deletedAt ? emoji.deletedAt.toISOString() : null,
      })),
    };
  }

  private normalizeCommunityId(communityIdRaw: string | undefined): string | null {
    if (communityIdRaw === undefined) {
      return null;
    }

    const communityId = communityIdRaw.trim();
    if (!communityId) {
      throw new BadRequestException('communityId cannot be empty when provided');
    }

    return communityId;
  }
}
