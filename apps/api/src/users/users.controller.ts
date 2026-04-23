import { Body, Controller, Get, Patch, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { AuthedRequest } from 'src/auth/auth.types';
import { UsersService } from './users.service';
import type { AvatarUploadTargetRequest } from '@cup/shared-types';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@Req() req: AuthedRequest) {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return this.usersService.getMe(req.user.id);
  }

  @Patch('me/username')
  async updateUsername(@Req() req: AuthedRequest, @Body() body: unknown) {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return this.usersService.updateUsername(req.user.id, body);
  }

  @Patch('me/display-name')
  async updateDisplayName(@Req() req: AuthedRequest, @Body() body: unknown) {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return this.usersService.updateDisplayName(req.user.id, body);
  }

  @Patch('me/email')
  async updateEmail(@Req() req: AuthedRequest, @Body() body: unknown) {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return this.usersService.updateEmail(req.user.id, body);
  }

  @Patch('me/avatar')
  async updateAvatarKey(@Req() req: AuthedRequest, @Body() body: unknown) {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return this.usersService.updateAvatarKey(req.user.id, body);
  }

  @Post('me/avatar/upload-target')
  async requestAvatarUploadTarget(@Req() req: AuthedRequest, @Body() body: AvatarUploadTargetRequest) {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return this.usersService.requestAvatarUploadTarget(req.user.id, body);
  }
}
