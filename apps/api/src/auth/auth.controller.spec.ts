import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthedRequest, LogoutRequest } from './auth.types';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return a SessionUser when /me is called with an authenticated request', () => {
    const req = {
      user: {
        id: 'user-id-123',
        email: 'fake@example.com',
        displayName: 'Fake User',
      },
    } as AuthedRequest;

    const result = controller.me(req);

    expect(result).toEqual({
      id: 'user-id-123',
      email: 'fake@example.com',
      displayName: 'Fake User',
    });
  });

  it('should throw UnauthorizedException when /me is called without an authenticated request', () => {
    const req = {} as AuthedRequest;

    expect(() => controller.me(req)).toThrow(UnauthorizedException);
  });

  it('should logout, destroy session, and clear session cookie', async () => {
    const req = {
      logOut: (callback: (err?: Error | null) => void) => callback(null),
      session: {
        destroy: (callback: (err?: Error | null) => void) => callback(null),
      },
    } as LogoutRequest;

    const res = {
      clearCookie: jest.fn(),
    } as unknown as Response;

    const result = await controller.logout(req, res);

    expect(result).toEqual({ ok: true });
    expect(res.clearCookie).toHaveBeenCalledWith('connect.sid', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
    });
  });

  it('should throw InternalServerErrorException when req.logOut fails', async () => {
    const req = {
      logOut: (callback: (err?: Error | null) => void) => callback(new Error('logout failed')),
      session: {
        destroy: (callback: (err?: Error | null) => void) => callback(null),
      },
    } as LogoutRequest;

    const res = {
      clearCookie: jest.fn(),
    } as unknown as Response;

    await expect(controller.logout(req, res)).rejects.toThrow(InternalServerErrorException);
  });

  it('should throw InternalServerErrorException when session destroy fails', async () => {
    const req = {
      logOut: (callback: (err?: Error | null) => void) => callback(null),
      session: {
        destroy: (callback: (err?: Error | null) => void) => callback(new Error('session destroy failed')),
      },
    } as LogoutRequest;

    const res = {
      clearCookie: jest.fn(),
    } as unknown as Response;

    await expect(controller.logout(req, res)).rejects.toThrow(InternalServerErrorException);
  });
});
