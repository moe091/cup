import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { Profile } from 'passport-google-oauth20';

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
    };
  };

  beforeEach(async () => {
    prismaServiceMock = {
      oAuthAccount: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should validate and create a new Google user', async () => {
    const profile = {
      id: 'google-id-123',
      emails: [{ value: 'fake@example.com' }],
      displayName: 'Fake User',
    } as Profile;

    prismaServiceMock.oAuthAccount.findUnique.mockResolvedValue(null);
    prismaServiceMock.user.create.mockResolvedValue({
      id: 'user-id-123',
      email: 'fake@example.com',
      displayName: 'Fake User',
    });
    prismaServiceMock.oAuthAccount.create.mockResolvedValue({});

    const user = await service.validateGoogleUser(profile);

    // it should return a user that matches what prisma.user.create returned
    expect(user).toEqual({
      id: 'user-id-123',
      email: 'fake@example.com',
      displayName: 'Fake User',
    });

    //check that a new user was created
    expect(prismaServiceMock.user.create).toHaveBeenCalledWith({
      data: {
        email: 'fake@example.com',
        displayName: 'Fake User',
      },
    });

    expect(prismaServiceMock.oAuthAccount.create).toHaveBeenCalledWith({
      data: {
        provider: 'google',
        providerAccountId: 'google-id-123',
        userId: 'user-id-123',
      },
    });
  });
});
