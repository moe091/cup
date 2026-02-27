import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthedRequest, LoginRequest, LogoutRequest } from './auth.types';
import { CSRF_SESSION_KEY } from 'src/security/security.constants';

describe('AuthController', () => {
  let controller: AuthController;
  let authServiceMock: {
    signupLocal: jest.Mock;
    loginLocal: jest.Mock;
  };

  beforeEach(async () => {
    authServiceMock = {
      signupLocal: jest.fn(),
      loginLocal: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authServiceMock }],
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
        username: 'fakeuser',
        email: 'fake@example.com',
        displayName: 'Fake User',
      },
    } as AuthedRequest;

    const result = controller.me(req);

    expect(result).toEqual({
      id: 'user-id-123',
      username: 'fakeuser',
      email: 'fake@example.com',
      displayName: 'Fake User',
    });
  });

  it('should throw UnauthorizedException when /me is called without an authenticated request', () => {
    const req = {} as AuthedRequest;

    expect(() => controller.me(req)).toThrow(UnauthorizedException);
  });

  it('should return csrf token from session', () => {
    const req = {
      session: {
        [CSRF_SESSION_KEY]: 'csrf-token-value',
      },
    } as unknown as AuthedRequest;

    const result = controller.csrf(req);

    expect(result).toEqual({ csrfToken: 'csrf-token-value' });
  });

  it('should throw forbidden when csrf token missing', () => {
    const req = {
      session: {},
    } as unknown as AuthedRequest;

    expect(() => controller.csrf(req)).toThrow(ForbiddenException);
  });

  it('should signup local user and initialize session', async () => {
    const body = {
      username: 'fakeuser',
      password: 'password123',
      verifyPassword: 'password123',
    };
    const sessionUser = {
      id: 'user-id-123',
      username: 'fakeuser',
      email: null,
      displayName: null,
    };

    authServiceMock.signupLocal.mockResolvedValue(sessionUser);

    const req = {
      body,
      logIn: (user: unknown, callback: (err?: Error | null) => void) => {
        expect(user).toEqual(sessionUser);
        callback(null);
      },
    } as LoginRequest;

    const result = await controller.localSignup(body, req);

    expect(authServiceMock.signupLocal).toHaveBeenCalledWith(body);
    expect(result).toEqual({ ok: true, user: sessionUser });
  });

  it('should login local user and initialize session', async () => {
    const body = {
      identifier: 'fakeuser',
      password: 'password123',
    };
    const sessionUser = {
      id: 'user-id-123',
      username: 'fakeuser',
      email: null,
      displayName: null,
    };

    authServiceMock.loginLocal.mockResolvedValue(sessionUser);

    const req = {
      body,
      logIn: (user: unknown, callback: (err?: Error | null) => void) => {
        expect(user).toEqual(sessionUser);
        callback(null);
      },
    } as LoginRequest;

    const result = await controller.localLogin(body, req);

    expect(authServiceMock.loginLocal).toHaveBeenCalledWith(body);
    expect(result).toEqual({ ok: true, user: sessionUser });
  });

  it('should redirect Google callback to profile after login', async () => {
    const req = {
      user: {
        id: 'user-id-123',
        username: 'fakeuser',
        email: 'fake@example.com',
        displayName: 'Fake User',
      },
      logIn: (_user: unknown, callback: (err?: Error | null) => void) => callback(null),
    } as unknown as AuthedRequest;

    const res = {
      redirect: jest.fn(),
    } as unknown as Response;

    await controller.googleCallback(req, res);

    expect(res.redirect).toHaveBeenCalledWith('http://localhost:5173/profile');
  });

  it('should redirect Discord callback to profile after login', async () => {
    const req = {
      user: {
        id: 'user-id-789',
        username: 'discorduser',
        email: null,
        displayName: 'Discord User',
      },
      logIn: (_user: unknown, callback: (err?: Error | null) => void) => callback(null),
    } as unknown as AuthedRequest;

    const res = {
      redirect: jest.fn(),
    } as unknown as Response;

    await controller.discordCallback(req, res);

    expect(res.redirect).toHaveBeenCalledWith('http://localhost:5173/profile');
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
