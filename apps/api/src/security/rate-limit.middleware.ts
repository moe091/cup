import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { RATE_LIMIT_RULES, RATE_LIMIT_WINDOW_MS } from './security.constants';

type RateBucket = {
  requests: number;
  resetAt: number;
};

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly buckets = new Map<string, RateBucket>();

  use(req: Request, res: Response, next: NextFunction): void {
    const routeKey = `${req.method.toUpperCase()}:${req.originalUrl.split('?')[0]}`;
    const limit = RATE_LIMIT_RULES[routeKey];

    if (!limit) {
      next();
      return;
    }

    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const bucketKey = `${routeKey}:${ip}`;
    const current = this.buckets.get(bucketKey);

    if (!current || current.resetAt <= now) {
      this.buckets.set(bucketKey, {
        requests: 1,
        resetAt: now + RATE_LIMIT_WINDOW_MS,
      });
      next();
      return;
    }

    if (current.requests >= limit) {
      res.status(429).json({ message: 'Too many requests. Please wait and try again.' });
      return;
    }

    current.requests += 1;
    this.buckets.set(bucketKey, current);
    next();
  }
}
