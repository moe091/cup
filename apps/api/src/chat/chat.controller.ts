import { UnauthorizedException, Req, Post, Controller, Get, Param, Query, BadRequestException } from '@nestjs/common';
import type { AuthedRequest } from '../auth/auth.types';
import { ChatService } from './chat.service';
import type { ChannelHistoryQueryRaw } from './chat.types';
import { ChannelHistoryResponseDto } from '@cup/shared-types';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('token')
  token(@Req() req: AuthedRequest) {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return this.chatService.issueConnectionToken(req.user.id);
  }

  @Get('channels/:channelId/messages')
  async channelHistory(
    @Param('channelId') channelIdRaw: string,
    @Query() query: ChannelHistoryQueryRaw,
    @Req() req: AuthedRequest,
  ): Promise<ChannelHistoryResponseDto> {
    const channelId = channelIdRaw.trim();
    if (!channelId) {
      throw new BadRequestException('valid channelId is required');
    }

    const parsedQuery = this.chatService.parseChannelHistoryQuery(query);
    const channelHistoryResponse = this.chatService.getChannelHistory(channelId, req.user?.id, parsedQuery);

    return channelHistoryResponse;
  }
}
