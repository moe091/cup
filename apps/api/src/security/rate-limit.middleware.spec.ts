import type { Request, Response } from 'express';
import { RateLimitMiddleware } from './rate-limit.middleware';

describe('RateLimitMiddleware', () => {
  let middleware: RateLimitMiddleware;

  beforeEach(() => {
    middleware = new RateLimitMiddleware();
  });

  function createRequest(path: string): Request {
    return {
      method: 'POST',
      originalUrl: path,
      ip: '127.0.0.1',
      socket: {
        remoteAddress: '127.0.0.1',
      },
    } as unknown as Request;
  }

  function createResponse() {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    return {
      status,
      json,
    };
  }

  it('allows requests on routes without rate limits', () => {
    const next = jest.fn();
    const req = {
      method: 'GET',
      originalUrl: '/api/auth/me',
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;
    const res = createResponse() as unknown as Response;

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('returns 429 after exceeding route limit', () => {
    const path = '/api/auth/local/login';
    const next = jest.fn();
    const res = createResponse();

    for (let i = 0; i < 10; i += 1) {
      middleware.use(createRequest(path), res as unknown as Response, next);
    }

    middleware.use(createRequest(path), res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ message: 'Too many requests. Please wait and try again.' });
  });
});
