import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Profile } from 'passport-google-oauth20';
import type { Profile as DiscordProfile } from 'passport-discord';
import type { SessionUser } from '@cup/shared-types';
import { PrismaService } from 'src/prisma/prisma.service';
import { hashPassword, verifyPassword } from './password.util';

type LocalSignupInput = {
  username: string;
  password: string;
  verifyPassword: string;
  email?: string;
  displayName?: string;
};

type LocalLoginInput = {
  identifier: string;
  password: string;
};

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async signupLocal(input: unknown): Promise<SessionUser> {
    const validatedInput = this.parseSignupInput(input);

    if (validatedInput.password !== validatedInput.verifyPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    await this.ensureUsernameAvailable(validatedInput.username);
    if (validatedInput.email) {
      await this.ensureEmailAvailable(validatedInput.email);
    }

    const passwordHash = await hashPassword(validatedInput.password);
    const createdUser = await this.prisma.user.create({
      data: {
        username: validatedInput.username,
        passwordHash,
        email: validatedInput.email ?? null,
        displayName: validatedInput.displayName ?? null,
      },
    });

    return this.toSessionUser(createdUser);
  }

  async loginLocal(input: unknown): Promise<SessionUser> {
    const validatedInput = this.parseLoginInput(input);

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: validatedInput.identifier }, { email: validatedInput.identifier }],
      },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        passwordHash: true,
      },
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await verifyPassword(validatedInput.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.toSessionUser(user);
  }

  async validateGoogleUser(profile: Profile): Promise<SessionUser> {
    const providerId = profile.id;
    const email = profile.emails?.[0]?.value ?? null;
    const displayName = profile.displayName?.trim() || 'NewUser';
    const usernameSeed = profile.displayName?.trim() || email?.split('@')[0] || 'NewUser';

    return this.validateOAuthUser({
      provider: 'google',
      providerAccountId: providerId,
      email,
      displayName,
      usernameSeed,
    });
  }

  async validateDiscordUser(profile: DiscordProfile): Promise<SessionUser> {
    const email = profile.email ?? null;
    const displayName = profile.global_name?.trim() || profile.username?.trim() || 'NewUser';
    const usernameSeed = profile.username?.trim() || profile.global_name?.trim() || 'NewUser';

    return this.validateOAuthUser({
      provider: 'discord',
      providerAccountId: profile.id,
      email,
      displayName,
      usernameSeed,
    });
  }

  private toSessionUser(user: {
    id: string;
    username: string;
    email: string | null;
    displayName: string | null;
  }): SessionUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
    };
  }

  private parseSignupInput(input: unknown): LocalSignupInput {
    const raw = this.parseObject(input);
    const username = this.validateUsername(raw.username, 'username');
    const password = this.validatePassword(raw.password, 'password');
    const verifyPassword = this.validatePassword(raw.verifyPassword, 'verifyPassword');
    const email = this.validateOptionalEmail(raw.email);
    const displayName = this.validateOptionalDisplayName(raw.displayName);

    return { username, password, verifyPassword, email, displayName };
  }

  private parseLoginInput(input: unknown): LocalLoginInput {
    const raw = this.parseObject(input);
    const identifier = this.validateIdentifier(raw.identifier);
    const password = this.validatePassword(raw.password, 'password');

    return { identifier, password };
  }

  private parseObject(input: unknown): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid request body');
    }

    return input as Record<string, unknown>;
  }

  private validateUsername(value: unknown, fieldName: string): string {
    if (typeof value !== 'string') {
      throw new BadRequestException(`${fieldName} is required`);
    }

    const username = value.trim();
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
      throw new BadRequestException('username must be 3-24 characters using letters, numbers, or _');
    }

    return username;
  }

  private validatePassword(value: unknown, fieldName: string): string {
    if (typeof value !== 'string') {
      throw new BadRequestException(`${fieldName} is required`);
    }

    if (value.length < 8) {
      throw new BadRequestException(`${fieldName} must be at least 8 characters`);
    }

    return value;
  }

  private validateIdentifier(value: unknown): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('identifier is required');
    }

    const identifier = value.trim();
    if (!identifier) {
      throw new BadRequestException('identifier is required');
    }

    if (identifier.length > 254) {
      throw new BadRequestException('identifier is too long');
    }

    return identifier;
  }

  private validateOptionalEmail(value: unknown): string | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException('email must be a string');
    }

    const email = value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('email format is invalid');
    }

    return email;
  }

  private validateOptionalDisplayName(value: unknown): string | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException('displayName must be a string');
    }

    const displayName = value.trim();
    if (!displayName) {
      return undefined;
    }

    if (displayName.length > 50) {
      throw new BadRequestException('displayName must be 50 characters or less');
    }

    return displayName;
  }

  private async ensureUsernameAvailable(username: string): Promise<void> {
    const existingUser = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('username is already taken');
    }
  }

  private async ensureEmailAvailable(email: string): Promise<void> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('email is already in use');
    }
  }

  private async generateDefaultUsername(seed: string): Promise<string> {
    const normalizedSeed = this.normalizeUsernameSeed(seed);
    const maxBaseLength = 20;
    const base = normalizedSeed.length > maxBaseLength ? normalizedSeed.slice(0, maxBaseLength) : normalizedSeed;
    let sequence = 1;

    while (true) {
      const candidate = sequence === 1 ? base : `${base}${sequence}`;
      const existing = await this.prisma.user.findUnique({
        where: { username: candidate },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }

      sequence += 1;
    }
  }

  private normalizeUsernameSeed(seed: string): string {
    const normalized = seed
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (!normalized) {
      return 'newuser';
    }

    return normalized.length < 3 ? `${normalized}user` : normalized;
  }

  private async validateOAuthUser(input: {
    provider: string;
    providerAccountId: string;
    email: string | null;
    displayName: string;
    usernameSeed: string;
  }): Promise<SessionUser> {
    const existingUser = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: input.provider,
          providerAccountId: input.providerAccountId,
        },
      },
      include: { user: true },
    });

    if (existingUser) {
      return this.toSessionUser(existingUser.user);
    }

    if (input.email) {
      const existingEmailUser = await this.prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });

      if (existingEmailUser) {
        throw new ConflictException('An account linked to this email already exists.');
      }
    }

    const username = await this.generateDefaultUsername(input.usernameSeed);
    let newUser: { id: string; username: string; email: string | null; displayName: string | null };

    try {
      newUser = await this.prisma.user.create({
        data: {
          username,
          usernameAutoGenerated: true,
          email: input.email,
          displayName: input.displayName,
        },
      });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new ConflictException('An account linked to this email already exists.');
      }

      throw error;
    }

    await this.prisma.oAuthAccount.create({
      data: {
        provider: input.provider,
        providerAccountId: input.providerAccountId,
        userId: newUser.id,
      },
    });

    return this.toSessionUser(newUser);
  }
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002';
}
