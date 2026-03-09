import { Controller, Get, Param, Req } from '@nestjs/common';
import type { CommunityChannelDto, CommunitySummaryDto } from '@cup/shared-types';
import type { AuthedRequest } from 'src/auth/auth.types';
import { CommunitiesService } from './communities.service';

@Controller('communities')
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Get(':slug')
  getCommunityBySlug(@Param('slug') slug: string): Promise<CommunitySummaryDto> {
    return this.communitiesService.getCommunityBySlug(slug);
  }

  @Get(':slug/channels')
  getCommunityChannelsBySlug(@Param('slug') slug: string, @Req() req: AuthedRequest): Promise<CommunityChannelDto[]> {
    return this.communitiesService.getCommunityChannelsBySlug(slug, req.user?.id);
  }
}
