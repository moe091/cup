import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { AuthedRequest, LoginRequest, LogoutRequest, SessionRequest } from './auth.types';
import type { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { OAuthErrorRedirectFilter } from './oauth-error-redirect.filter';
import { CSRF_SESSION_KEY } from 'src/security/security.constants';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('csrf')
  csrf(@Req() req: SessionRequest) {
    const rawToken = req.session?.[CSRF_SESSION_KEY] as unknown;
    if (typeof rawToken !== 'string') {
      throw new ForbiddenException('Unable to initialize CSRF token.');
    }

    return { csrfToken: rawToken };
  }

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
  @UseFilters(OAuthErrorRedirectFilter)
  async googleCallback(@Req() req: AuthedRequest, @Res() res: Response) {
    console.log('AuthController.googleCallback called, req.user = ', req.user);

    if (!req.user) {
      throw new UnauthorizedException();
    }

    await this.loginSession(req as LoginRequest, req.user);

    res.redirect('http://localhost:5173/profile'); //TODO:: redirect to previous page
  }

  @Get('discord')
  @UseGuards(AuthGuard('discord'))
  discord() {
    // guard redirects to Discord OAuth
  }

  @Get('discord/callback')
  @UseGuards(AuthGuard('discord'))
  @UseFilters(OAuthErrorRedirectFilter)
  async discordCallback(@Req() req: AuthedRequest, @Res() res: Response) {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    await this.loginSession(req as LoginRequest, req.user);
    res.redirect('http://localhost:5173/profile'); //TODO:: redirect to previous page
  }

  @Post('local/signup')
  async localSignup(@Body() body: unknown, @Req() req: LoginRequest) {
    const sessionUser = await this.authService.signupLocal(body);
    await this.loginSession(req, sessionUser);

    return { ok: true, user: sessionUser };
  }

  @Post('local/login')
  async localLogin(@Body() body: unknown, @Req() req: LoginRequest) {
    const sessionUser = await this.authService.loginLocal(body);
    await this.loginSession(req, sessionUser);

    return { ok: true, user: sessionUser };
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

  private async loginSession(req: LoginRequest, user: NonNullable<AuthedRequest['user']>): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      req.logIn(user, (err?: Error | null) => {
        if (err) {
          reject(err);
          return;
        }

        resolve();
      });
    }).catch((err: unknown) => {
      throw new InternalServerErrorException(err instanceof Error ? err.message : 'Failed to initialize session');
    });
  }
}
