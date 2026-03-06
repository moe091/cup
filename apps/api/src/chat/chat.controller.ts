import { UnauthorizedException, Req, Post, Controller } from '@nestjs/common';
import type { AuthedRequest } from '../auth/auth.types';
import { ChatService } from './chat.service';

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
}
