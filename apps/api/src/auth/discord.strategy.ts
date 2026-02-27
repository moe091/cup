import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-discord';
import type { SessionUser } from '@cup/shared-types';
import { AuthService } from './auth.service';

@Injectable()
export class DiscordStrategy extends PassportStrategy(Strategy, 'discord') {
  private readonly logger = new Logger(DiscordStrategy.name);

  constructor(private readonly authService: AuthService) {
    const clientID = process.env.DISCORD_CLIENT_ID || 'disabled-client-id';
    const clientSecret = process.env.DISCORD_CLIENT_SECRET || 'disabled-client-secret';
    const callbackURL = process.env.DISCORD_CALLBACK_URL || 'http://localhost:3000/api/auth/discord/callback';

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['identify', 'email'],
    });

    if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
      this.logger.warn('Discord OAuth is not configured. Set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET.');
    }
  }

  async validate(accessToken: string, refreshToken: string, profile: Profile): Promise<SessionUser> {
    return this.authService.validateDiscordUser(profile);
  }
}
