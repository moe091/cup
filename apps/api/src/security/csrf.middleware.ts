import { ForbiddenException, Injectable, type NestMiddleware } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { CSRF_HEADER_NAME, CSRF_SESSION_KEY } from './security.constants';

type RequestWithSession = Request & {
  session?: Record<string, unknown> & {
    save?: (callback: (err?: Error | null) => void) => void;
  };
};

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: RequestWithSession, _res: Response, next: NextFunction): void {
    if (!req.session) {
      throw new ForbiddenException('Missing session.');
    }

    if (!req.session[CSRF_SESSION_KEY]) {
      req.session[CSRF_SESSION_KEY] = randomBytes(32).toString('hex');
    }

    if (!this.requiresCsrfValidation(req)) {
      next();
      return;
    }

    const headerToken = req.get(CSRF_HEADER_NAME);
    const sessionToken = req.session[CSRF_SESSION_KEY];

    if (typeof sessionToken !== 'string' || !headerToken || headerToken !== sessionToken) {
      throw new ForbiddenException('Invalid CSRF token.');
    }

    next();
  }

  private requiresCsrfValidation(req: Request): boolean {
    const method = req.method.toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return false;
    }

    const path = req.originalUrl.split('?')[0];
    return path !== '/api/auth/google/callback' && path !== '/api/auth/discord/callback';
  }
}
