import { Test, TestingModule } from '@nestjs/testing';
import { BouncerController } from './bouncer.controller';
import { LobbyService } from '../lobby/lobby.service';
import { BouncerService } from './bouncer.service';
import {
  NotFoundException,
  GoneException,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import type { AuthedRequest } from 'src/auth/auth.types';
import type { LevelDefinition } from '@cup/bouncer-shared';
import type { Lobby } from 'src/generated/prisma/client';
import { LobbyStatus } from 'src/generated/prisma/enums';
import type { BouncerLevel } from 'src/generated/prisma/client';
import { BouncerLevelVisibility } from 'src/generated/prisma/enums';
import type { Response } from 'express';

describe('BouncerController', () => {
  let controller: BouncerController;
  let lobbyService: jest.Mocked<LobbyService>;
  let bouncerService: jest.Mocked<BouncerService>;

  beforeEach(async () => {
    const mockLobbyService = {
      findLobbyByMatchId: jest.fn(),
      createLobby: jest.fn(),
      getTicket: jest.fn(),
    };
    const mockBouncerService = {
      saveLevel: jest.fn(),
      listLevelsByUser: jest.fn(),
      listSystemLevels: jest.fn(),
      getLevelById: jest.fn(),
      getSystemLevel: jest.fn(),
      getLevelByUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BouncerController],
      providers: [
        { provide: LobbyService, useValue: mockLobbyService },
        { provide: BouncerService, useValue: mockBouncerService },
      ],
    }).compile();

    controller = module.get<BouncerController>(BouncerController);
    lobbyService = mockLobbyService as unknown as jest.Mocked<LobbyService>;
    bouncerService = mockBouncerService as unknown as jest.Mocked<BouncerService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('joinMatch', () => {
    const mockMatchId = 'test-match-123';
    const mockUserId = 'user-123';
    const mockReq = { user: { id: mockUserId, displayName: 'TestUser' } } as AuthedRequest;

    it('should successfully join an open lobby', async () => {
      const mockLobby: Lobby = {
        matchId: mockMatchId,
        gameId: 'bouncer',
        socketUrl: 'ws://localhost:3001',
        status: LobbyStatus.OPEN,
        maxPlayers: 4,
        createdByUserId: mockUserId,
        createdByGuestId: null,
        meta: null,
        expiresAt: new Date(Date.now() + 60000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockTicket = 'jwt-ticket-123';

      lobbyService.findLobbyByMatchId.mockResolvedValue(mockLobby);
      lobbyService.getTicket.mockReturnValue(mockTicket);

      const result = await controller.joinMatch(mockMatchId, mockReq);

      expect(lobbyService.findLobbyByMatchId).toHaveBeenCalledWith('bouncer', mockMatchId);
      expect(lobbyService.getTicket).toHaveBeenCalledWith(mockLobby, mockUserId, 'TestUser');
      expect(result).toEqual({
        matchId: mockMatchId,
        socketUrl: 'ws://localhost:3001',
        ticket: mockTicket,
      });
    });

    it('should throw NotFoundException when lobby does not exist', async () => {
      lobbyService.findLobbyByMatchId.mockResolvedValue(null);

      await expect(controller.joinMatch(mockMatchId, mockReq)).rejects.toThrow(NotFoundException);
    });

    it('should throw GoneException when lobby has expired', async () => {
      const mockLobby: Lobby = {
        matchId: mockMatchId,
        gameId: 'bouncer',
        socketUrl: 'ws://localhost:3001',
        status: LobbyStatus.OPEN,
        maxPlayers: 4,
        createdByUserId: null,
        createdByGuestId: 'guest-123',
        meta: null,
        expiresAt: new Date(Date.now() - 60000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      lobbyService.findLobbyByMatchId.mockResolvedValue(mockLobby);

      await expect(controller.joinMatch(mockMatchId, mockReq)).rejects.toThrow(GoneException);
    });

    it('should throw ConflictException when lobby is not open', async () => {
      const mockLobby: Lobby = {
        matchId: mockMatchId,
        gameId: 'bouncer',
        socketUrl: 'ws://localhost:3001',
        status: LobbyStatus.IN_PROGRESS,
        maxPlayers: 4,
        createdByUserId: null,
        createdByGuestId: 'guest-123',
        meta: null,
        expiresAt: new Date(Date.now() + 60000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      lobbyService.findLobbyByMatchId.mockResolvedValue(mockLobby);

      await expect(controller.joinMatch(mockMatchId, mockReq)).rejects.toThrow(ConflictException);
    });

    it('should work with guest user when no authenticated user', async () => {
      const mockLobby: Lobby = {
        matchId: mockMatchId,
        gameId: 'bouncer',
        socketUrl: 'ws://localhost:3001',
        status: LobbyStatus.OPEN,
        maxPlayers: 4,
        createdByUserId: null,
        createdByGuestId: 'guest-123',
        meta: null,
        expiresAt: new Date(Date.now() + 60000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockGuestReq = { cookies: { guestId: 'guest-123' } } as unknown as AuthedRequest;

      lobbyService.findLobbyByMatchId.mockResolvedValue(mockLobby);
      lobbyService.getTicket.mockReturnValue('jwt-ticket-123');

      await controller.joinMatch(mockMatchId, mockGuestReq);

      expect(lobbyService.getTicket).toHaveBeenCalledWith(mockLobby, 'guest-123', 'Guest');
    });
  });

  describe('createMatch', () => {
    const mockReq = { user: { id: 'user-123' } } as AuthedRequest;
    const mockRes = { cookie: jest.fn() } as unknown as jest.Mocked<Response>;

    beforeEach(() => {
      process.env.BOUNCER_SERVER_URL = 'ws://localhost:3001';
      process.env.NODE_ENV = 'test';
      jest.clearAllMocks();
    });

    it('should create a match for authenticated user', async () => {
      const mockResponse = { matchId: 'new-match-123', socketUrl: 'ws://localhost:3001' };
      lobbyService.createLobby.mockResolvedValue(mockResponse);

      const result = await controller.createMatch(mockReq, mockRes);

      expect(lobbyService.createLobby).toHaveBeenCalledWith({
        gameId: 'bouncer',
        socketUrl: 'ws://localhost:3001',
        maxPlayers: 4,
        createdByUserId: 'user-123',
        createdByGuestId: undefined,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should create a match for guest user and set guest cookie', async () => {
      const mockGuestReq = { user: null, cookies: {} } as unknown as AuthedRequest;
      const mockResponse = { matchId: 'new-match-123', socketUrl: 'ws://localhost:3001' };
      lobbyService.createLobby.mockResolvedValue(mockResponse);

      await controller.createMatch(mockGuestReq, mockRes);

      expect(mockRes.cookie).toHaveBeenCalledWith('guestId', expect.any(String), {
        httpOnly: true,
        secure: false,
        maxAge: 604800000,
      });
      expect(lobbyService.createLobby).toHaveBeenCalledWith({
        gameId: 'bouncer',
        socketUrl: 'ws://localhost:3001',
        maxPlayers: 4,
        createdByUserId: undefined,
        createdByGuestId: expect.any(String),
      });
    });

    it('should use existing guest cookie if present', async () => {
      const mockGuestReq = { user: null, cookies: { guestId: 'existing-guest-123' } } as unknown as AuthedRequest;
      const mockResponse = { matchId: 'new-match-123', socketUrl: 'ws://localhost:3001' };
      lobbyService.createLobby.mockResolvedValue(mockResponse);

      await controller.createMatch(mockGuestReq, mockRes);

      expect(mockRes.cookie).not.toHaveBeenCalled();
      expect(lobbyService.createLobby).toHaveBeenCalledWith({
        gameId: 'bouncer',
        socketUrl: 'ws://localhost:3001',
        maxPlayers: 4,
        createdByUserId: undefined,
        createdByGuestId: 'existing-guest-123',
      });
    });
  });

  describe('saveLevel', () => {
    const mockLevel: LevelDefinition = {
      name: 'Test Level',
    } as LevelDefinition; // Casting since we don't need all properties for this test
    const mockReq = { user: { id: 'user-123' } } as AuthedRequest;

    it('should save level for authenticated user', async () => {
      bouncerService.saveLevel.mockResolvedValue('level-id-123');

      await controller.saveLevel(mockReq, mockLevel);

      expect(bouncerService.saveLevel).toHaveBeenCalledWith('user-123', 'Test Level', mockLevel);
    });

    it('should throw UnauthorizedException for unauthenticated user', async () => {
      const mockGuestReq = { user: null } as unknown as AuthedRequest;

      await expect(controller.saveLevel(mockGuestReq, mockLevel)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException when level name is missing', async () => {
      const invalidLevel = { ...mockLevel, name: '' };

      await expect(controller.saveLevel(mockReq, invalidLevel)).rejects.toThrow(BadRequestException);
    });
  });

  describe('listLevels', () => {
    it('should list user levels when authenticated', async () => {
      const mockReq = { user: { id: 'user-123' } } as AuthedRequest;
      const mockLevels = [
        {
          id: '1',
          name: 'Level 1',
          visibility: BouncerLevelVisibility.PRIVATE,
          ownerUserId: 'user-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          data: {},
        },
      ];
      bouncerService.listLevelsByUser.mockResolvedValue(mockLevels);

      const result = await controller.listLevels(mockReq);

      expect(bouncerService.listLevelsByUser).toHaveBeenCalledWith('user-123', true);
      expect(result).toEqual(mockLevels);
    });

    it('should list system levels when unauthenticated', async () => {
      const mockReq = { user: null } as unknown as AuthedRequest;
      const mockLevels = [
        {
          id: '1',
          name: 'System Level',
          visibility: BouncerLevelVisibility.SYSTEM,
          ownerUserId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          data: {},
        },
      ];
      bouncerService.listSystemLevels.mockResolvedValue(mockLevels);

      const result = await controller.listLevels(mockReq);

      expect(bouncerService.listSystemLevels).toHaveBeenCalled();
      expect(result).toEqual(mockLevels);
    });
  });

  describe('getLevelById', () => {
    it('should return level by id', async () => {
      const mockLevel: BouncerLevel = {
        id: 'level-123',
        name: 'Test Level',
        ownerUserId: 'user-123',
        visibility: BouncerLevelVisibility.PRIVATE,
        createdAt: new Date(),
        updatedAt: new Date(),
        data: {},
      };
      bouncerService.getLevelById.mockResolvedValue(mockLevel);

      const result = await controller.getLevelById('level-123');

      expect(bouncerService.getLevelById).toHaveBeenCalledWith('level-123');
      expect(result).toEqual(mockLevel);
    });

    it('should propagate NotFoundException from service', async () => {
      bouncerService.getLevelById.mockRejectedValue(new NotFoundException());

      await expect(controller.getLevelById('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSystemLevel', () => {
    it('should return system level by name', async () => {
      const mockLevel: BouncerLevel = {
        id: 'level-123',
        name: 'Test Level',
        ownerUserId: null,
        visibility: BouncerLevelVisibility.SYSTEM,
        createdAt: new Date(),
        updatedAt: new Date(),
        data: {},
      };
      bouncerService.getSystemLevel.mockResolvedValue(mockLevel);

      const result = await controller.getSystemLevel('Test Level');

      expect(bouncerService.getSystemLevel).toHaveBeenCalledWith('Test Level');
      expect(result).toEqual(mockLevel);
    });

    it('should throw BadRequestException when level name is missing', async () => {
      await expect(controller.getSystemLevel('')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getLevelByUser', () => {
    it('should return user level by userId and levelName', async () => {
      const mockLevel: BouncerLevel = {
        id: 'level-123',
        name: 'Test Level',
        ownerUserId: 'user-123',
        visibility: BouncerLevelVisibility.PRIVATE,
        createdAt: new Date(),
        updatedAt: new Date(),
        data: {},
      };
      bouncerService.getLevelByUser.mockResolvedValue(mockLevel);

      const result = await controller.getLevelByUser('user-123', 'Test Level');

      expect(bouncerService.getLevelByUser).toHaveBeenCalledWith('user-123', 'Test Level');
      expect(result).toEqual(mockLevel);
    });

    it('should throw BadRequestException when userId is missing', async () => {
      await expect(controller.getLevelByUser('', 'Test Level')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when levelName is missing', async () => {
      await expect(controller.getLevelByUser('user-123', '')).rejects.toThrow(BadRequestException);
    });
  });
});
