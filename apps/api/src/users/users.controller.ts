import { Body, Controller, Get, Patch, Req, UnauthorizedException } from '@nestjs/common';
import type { AuthedRequest } from 'src/auth/auth.types';
import { UsersService } from './users.service';

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

  @Patch('me')
  async updateMe(@Req() req: AuthedRequest, @Body() body: unknown) {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return this.usersService.updateMe(req.user.id, body);
  }
}
