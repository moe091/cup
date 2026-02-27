import { ForbiddenException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CSRF_HEADER_NAME, CSRF_SESSION_KEY } from './security.constants';
import { CsrfMiddleware } from './csrf.middleware';

type SessionRequest = Request & {
  session?: Record<string, unknown>;
};

describe('CsrfMiddleware', () => {
  let middleware: CsrfMiddleware;

  beforeEach(() => {
    middleware = new CsrfMiddleware();
  });

  it('throws when session is missing', () => {
    const req = {
      method: 'POST',
      originalUrl: '/api/auth/local/login',
      get: jest.fn(),
    } as unknown as SessionRequest;

    expect(() => middleware.use(req, {} as Response, jest.fn())).toThrow(ForbiddenException);
  });

  it('initializes csrf token and allows safe methods', () => {
    const next = jest.fn();
    const req = {
      method: 'GET',
      originalUrl: '/api/auth/me',
      session: {},
      get: jest.fn(),
    } as unknown as SessionRequest;

    middleware.use(req, {} as Response, next);

    expect(typeof req.session?.[CSRF_SESSION_KEY]).toBe('string');
    expect(next).toHaveBeenCalled();
  });

  it('allows mutating request with matching csrf header', () => {
    const next = jest.fn();
    const req = {
      method: 'POST',
      originalUrl: '/api/auth/local/signup',
      session: {
        [CSRF_SESSION_KEY]: 'token-value',
      },
      get: (headerName: string) => (headerName === CSRF_HEADER_NAME ? 'token-value' : undefined),
    } as unknown as SessionRequest;

    middleware.use(req, {} as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('throws for mutating request with invalid csrf token', () => {
    const req = {
      method: 'PATCH',
      originalUrl: '/api/users/me',
      session: {
        [CSRF_SESSION_KEY]: 'token-value',
      },
      get: () => 'wrong-token',
    } as unknown as SessionRequest;

    expect(() => middleware.use(req, {} as Response, jest.fn())).toThrow(ForbiddenException);
  });

  it('exempts oauth callback routes from csrf validation', () => {
    const next = jest.fn();
    const req = {
      method: 'POST',
      originalUrl: '/api/auth/google/callback',
      session: {
        [CSRF_SESSION_KEY]: 'token-value',
      },
      get: jest.fn(),
    } as unknown as SessionRequest;

    middleware.use(req, {} as Response, next);

    expect(next).toHaveBeenCalled();
  });
});
