import { Test, TestingModule } from '@nestjs/testing';
import { LobbyService } from './lobby.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('LobbyService', () => {
  let service: LobbyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LobbyService,
        {
          provide: PrismaService,
          useValue: {
            lobby: {
              create: jest.fn(),
              findFirst: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<LobbyService>(LobbyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
