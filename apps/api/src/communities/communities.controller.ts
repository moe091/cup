import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import type {
  CommunityChannelDto,
  DeleteCommunityResponseDto,
  CommunityIconUploadTargetRequestDto,
  CommunityIconUploadTargetResponseDto,
  CommunitySummaryDto,
  CreateCommunityRequestDto,
  CreateCommunityResponseDto,
  GetPublicCommunitiesQueryDto,
  JoinCommunityResponseDto,
  LeaveCommunityResponseDto,
  MyCommunitiesResponseDto,
  PublicCommunitiesResponseDto,
  UpdateCommunityIconRequestDto,
} from '@cup/shared-types';
import type { AuthedRequest } from 'src/auth/auth.types';
import { CommunitiesService } from './communities.service';

@Controller('communities')
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Post()
  createCommunity(@Req() req: AuthedRequest, @Body() body: CreateCommunityRequestDto): Promise<CreateCommunityResponseDto> {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return this.communitiesService.createCommunity(req.user.id, body);
  }

  @Get('me')
  getMyCommunities(@Req() req: AuthedRequest): Promise<MyCommunitiesResponseDto> {
    if (!req.user)
      throw new UnauthorizedException();

    return this.communitiesService.getMyCommunities(req.user.id);
  }

  @Get('public')
  getPublicCommunities(
    @Query() query: GetPublicCommunitiesQueryDto,
    @Req() req: AuthedRequest,
  ): Promise<PublicCommunitiesResponseDto> {
    return this.communitiesService.getPublicCommunities(query, req.user?.id);
  }

  @Get(':slug')
  getCommunityBySlug(@Param('slug') slug: string): Promise<CommunitySummaryDto> {
    return this.communitiesService.getCommunityBySlug(slug);
  }

  @Post(':slug/join')
  joinCommunityBySlug(@Param('slug') slug: string, @Req() req: AuthedRequest): Promise<JoinCommunityResponseDto> {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return this.communitiesService.joinCommunityBySlug(req.user.id, slug);
  }

  @Post(':slug/leave')
  leaveCommunityBySlug(@Param('slug') slug: string, @Req() req: AuthedRequest): Promise<LeaveCommunityResponseDto> {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return this.communitiesService.leaveCommunityBySlug(req.user.id, slug);
  }

  @Delete(':slug')
  deleteCommunityBySlug(@Param('slug') slug: string, @Req() req: AuthedRequest): Promise<DeleteCommunityResponseDto> {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return this.communitiesService.deleteCommunityBySlug(req.user.id, slug);
  }

  @Get(':slug/channels')
  getCommunityChannelsBySlug(@Param('slug') slug: string, @Req() req: AuthedRequest): Promise<CommunityChannelDto[]> {
    return this.communitiesService.getCommunityChannelsBySlug(slug, req.user?.id);
  }

  @Post(':communityId/icon/upload-target')
  requestCommunityIconUploadTarget(@Param('communityId') communityId: string, @Req() req: AuthedRequest, @Body() body: CommunityIconUploadTargetRequestDto): Promise<CommunityIconUploadTargetResponseDto> {
    if (!req.user) {
      throw new UnauthorizedException();
    }
    return this.communitiesService.requestCommunityIconUploadTarget(
      req.user.id,
      communityId,
      body,
    );
  }

  @Patch(':communityId/icon')
  updateCommunityIcon(@Param('communityId') communityId: string, @Req() req: AuthedRequest, @Body() body: UpdateCommunityIconRequestDto): Promise<CreateCommunityResponseDto> {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return this.communitiesService.updateCommunityIcon(req.user.id, communityId, body);
  }
}
