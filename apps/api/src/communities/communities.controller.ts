import { Controller, Get, Param, Req, UnauthorizedException } from '@nestjs/common';
import type { CommunityChannelDto, CommunitySummaryDto, MyCommunitiesResponseDto } from '@cup/shared-types';
import type { AuthedRequest } from 'src/auth/auth.types';
import { CommunitiesService } from './communities.service';

@Controller('communities')
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Get('me')
  getMyCommunities(@Req() req: AuthedRequest): Promise<MyCommunitiesResponseDto> {
    if (!req.user)
      throw new UnauthorizedException();

    return this.communitiesService.getMyCommunities(req.user.id);
  }

  @Get(':slug')
  getCommunityBySlug(@Param('slug') slug: string): Promise<CommunitySummaryDto> {
    return this.communitiesService.getCommunityBySlug(slug);
  }

  @Get(':slug/channels')
  getCommunityChannelsBySlug(@Param('slug') slug: string, @Req() req: AuthedRequest): Promise<CommunityChannelDto[]> {
    return this.communitiesService.getCommunityChannelsBySlug(slug, req.user?.id);
  }
  
}
