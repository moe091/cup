import {
  Controller,
  Get,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { AuthedRequest } from './auth.types';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  @Get('me')
  me(@Req() req: AuthedRequest) {
    console.log('AuthController.me called, req.user = ', req.user);
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return req.user;
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  google() {
    console.log('AuthController.google called');
    //guard will auto-redirect to google, no body needed
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: AuthedRequest, @Res() res) {
    console.log('AuthController.googleCallback called, req.user = ', req.user);

    if (!req.user) {
      throw new UnauthorizedException();
    }

    await new Promise<void>((resolve, reject) => {
      (req as any).logIn(req.user, (err: unknown) =>
        err ? reject(err) : resolve(),
      );
    });

    res.redirect('http://localhost:5173/game');
  }
}
