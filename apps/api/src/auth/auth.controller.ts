import {
  Controller,
  Get,
  InternalServerErrorException,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { AuthedRequest, LogoutRequest } from './auth.types';
import type { Response } from 'express';
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
  async googleCallback(@Req() req: AuthedRequest, @Res() res: Response) {
    console.log('AuthController.googleCallback called, req.user = ', req.user);

    if (!req.user) {
      throw new UnauthorizedException();
    }

    // prettier-ignore
    await new Promise<void>((resolve, reject) => {
      (req).logIn(req.user!, (err: Error) =>
        err ? reject(err) : resolve(err),
      );
    });

    res.redirect('http://localhost:5173/games'); //TODO:: redirect to previous page
  }

  @Post('logout')
  async logout(@Req() req: LogoutRequest, @Res({ passthrough: true }) res: Response) {
    await new Promise<void>((resolve, reject) => {
      req.logOut((err?: Error | null) => {
        if (err) {
          reject(err);
          return;
        }

        resolve();
      });
    }).catch((err: unknown) => {
      throw new InternalServerErrorException(err instanceof Error ? err.message : 'Failed to logout');
    });

    if (req.session) {
      await new Promise<void>((resolve, reject) => {
        req.session?.destroy((err?: Error | null) => {
          if (err) {
            reject(err);
            return;
          }

          resolve();
        });
      }).catch((err: unknown) => {
        throw new InternalServerErrorException(err instanceof Error ? err.message : 'Failed to destroy session');
      });
    }

    res.clearCookie('connect.sid', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return { ok: true };
  }
}
