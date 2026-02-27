import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Profile } from 'passport-google-oauth20';
import type { Profile as DiscordProfile } from 'passport-discord';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from './auth.service';
import * as passwordUtil from './password.util';

jest.mock('./password.util', () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prismaServiceMock: {
    oAuthAccount: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
    user: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
    };
  };

  const hashPasswordMock = jest.mocked(passwordUtil.hashPassword);
  const verifyPasswordMock = jest.mocked(passwordUtil.verifyPassword);

  beforeEach(async () => {
    prismaServiceMock = {
      oAuthAccount: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should signup local user', async () => {
    hashPasswordMock.mockResolvedValue('hashed-password');
    prismaServiceMock.user.findUnique.mockResolvedValue(null);
    prismaServiceMock.user.create.mockResolvedValue({
      id: 'user-id-123',
      username: 'fakeuser',
      email: null,
      displayName: null,
    });

    const result = await service.signupLocal({
      username: 'fakeuser',
      password: 'password123',
      verifyPassword: 'password123',
    });

    expect(prismaServiceMock.user.create).toHaveBeenCalledWith({
      data: {
        username: 'fakeuser',
        passwordHash: 'hashed-password',
        email: null,
        displayName: null,
      },
    });
    expect(result).toEqual({
      id: 'user-id-123',
      username: 'fakeuser',
      email: null,
      displayName: null,
    });
  });

  it('should reject signup when passwords do not match', async () => {
    await expect(
      service.signupLocal({
        username: 'fakeuser',
        password: 'password123',
        verifyPassword: 'password1234',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject signup when username already exists', async () => {
    prismaServiceMock.user.findUnique.mockResolvedValueOnce({ id: 'existing-user' });

    await expect(
      service.signupLocal({
        username: 'fakeuser',
        password: 'password123',
        verifyPassword: 'password123',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should login with username', async () => {
    prismaServiceMock.user.findFirst.mockResolvedValue({
      id: 'user-id-123',
      username: 'fakeuser',
      email: 'fake@example.com',
      displayName: 'Fake User',
      passwordHash: 'hashed-password',
    });
    verifyPasswordMock.mockResolvedValue(true);

    const result = await service.loginLocal({ identifier: 'fakeuser', password: 'password123' });

    expect(result).toEqual({
      id: 'user-id-123',
      username: 'fakeuser',
      email: 'fake@example.com',
      displayName: 'Fake User',
    });
  });

  it('should login with email identifier', async () => {
    prismaServiceMock.user.findFirst.mockResolvedValue({
      id: 'user-id-123',
      username: 'fakeuser',
      email: 'fake@example.com',
      displayName: 'Fake User',
      passwordHash: 'hashed-password',
    });
    verifyPasswordMock.mockResolvedValue(true);

    const result = await service.loginLocal({ identifier: 'fake@example.com', password: 'password123' });

    expect(result).toEqual({
      id: 'user-id-123',
      username: 'fakeuser',
      email: 'fake@example.com',
      displayName: 'Fake User',
    });
  });

  it('should reject login with invalid credentials', async () => {
    prismaServiceMock.user.findFirst.mockResolvedValue(null);

    await expect(service.loginLocal({ identifier: 'missing-user', password: 'password123' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should validate and create a new Google user', async () => {
    const profile = {
      id: 'google-id-123',
      emails: [{ value: 'fake@example.com' }],
      displayName: 'Fake User',
    } as Profile;

    prismaServiceMock.oAuthAccount.findUnique.mockResolvedValue(null);
    prismaServiceMock.user.findUnique.mockResolvedValue(null);
    prismaServiceMock.user.create.mockResolvedValue({
      id: 'user-id-123',
      username: 'fake_user',
      email: 'fake@example.com',
      displayName: 'Fake User',
    });
    prismaServiceMock.oAuthAccount.create.mockResolvedValue({});

    const user = await service.validateGoogleUser(profile);

    expect(user).toEqual({
      id: 'user-id-123',
      username: 'fake_user',
      email: 'fake@example.com',
      displayName: 'Fake User',
    });

    expect(prismaServiceMock.user.create).toHaveBeenCalledWith({
      data: {
        username: 'fake_user',
        usernameAutoGenerated: true,
        email: 'fake@example.com',
        displayName: 'Fake User',
      },
    });
  });

  it('should validate and create a new Discord user', async () => {
    const profile = {
      id: 'discord-id-123',
      username: 'DiscordUser',
      global_name: 'Discord Display',
      email: null,
    } as DiscordProfile;

    prismaServiceMock.oAuthAccount.findUnique.mockResolvedValue(null);
    prismaServiceMock.user.findUnique.mockResolvedValue(null);
    prismaServiceMock.user.create.mockResolvedValue({
      id: 'user-id-456',
      username: 'discorduser',
      email: null,
      displayName: 'Discord Display',
    });
    prismaServiceMock.oAuthAccount.create.mockResolvedValue({});

    const user = await service.validateDiscordUser(profile);

    expect(user).toEqual({
      id: 'user-id-456',
      username: 'discorduser',
      email: null,
      displayName: 'Discord Display',
    });

    expect(prismaServiceMock.user.create).toHaveBeenCalledWith({
      data: {
        username: 'discorduser',
        usernameAutoGenerated: true,
        email: null,
        displayName: 'Discord Display',
      },
    });
  });

  it('should throw conflict when Discord email already exists', async () => {
    const profile = {
      id: 'discord-id-999',
      username: 'DiscordUser',
      global_name: 'Discord Display',
      email: 'fake@example.com',
    } as DiscordProfile;

    prismaServiceMock.oAuthAccount.findUnique.mockResolvedValue(null);
    prismaServiceMock.user.findUnique.mockResolvedValue({ id: 'existing-user-id' });

    await expect(service.validateDiscordUser(profile)).rejects.toThrow(ConflictException);
  });
});
