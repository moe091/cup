import { Test, TestingModule } from '@nestjs/testing';
import { BouncerController } from './bouncer.controller';
import { LobbyService } from '../lobby/lobby.service';

describe('BouncerController', () => {
  let controller: BouncerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BouncerController],
      providers: [
        {
          provide: LobbyService,
          useValue: {
            findLobbyByMatchId: jest.fn(),
            createLobby: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<BouncerController>(BouncerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
