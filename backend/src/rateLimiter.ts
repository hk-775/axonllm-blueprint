import type {
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from 'express';
import { HttpError } from './errors';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  maxKeys: number;
  keyGenerator?: (request: Request, response: Response) => string;
  now?: () => number;
}

export function createRateLimiter(
  options: RateLimiterOptions,
): RequestHandler {
  const buckets = new Map<string, RateLimitBucket>();
  const now = options.now ?? Date.now;
  const keyGenerator =
    options.keyGenerator ??
    ((request: Request) =>
      request.ip || request.socket.remoteAddress || 'unknown');

  function pruneExpired(timestamp: number): void {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= timestamp) {
        buckets.delete(key);
      }
    }
  }

  function reserveKeyCapacity(timestamp: number): void {
    if (buckets.size < options.maxKeys) {
      return;
    }

    pruneExpired(timestamp);
    if (buckets.size < options.maxKeys) {
      return;
    }

    const oldestKey = buckets.keys().next().value as string | undefined;
    if (oldestKey) {
      buckets.delete(oldestKey);
    }
  }

  return (
    request: Request,
    response: Response,
    next: NextFunction,
  ): void => {
    const timestamp = now();
    const key = keyGenerator(request, response) || 'unknown';
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= timestamp) {
      reserveKeyCapacity(timestamp);
      bucket = {
        count: 0,
        resetAt: timestamp + options.windowMs,
      };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, options.maxRequests - bucket.count);
    const resetSeconds = Math.max(
      1,
      Math.ceil((bucket.resetAt - timestamp) / 1000),
    );

    response.setHeader('RateLimit-Limit', options.maxRequests);
    response.setHeader('RateLimit-Remaining', remaining);
    response.setHeader('RateLimit-Reset', resetSeconds);

    if (bucket.count > options.maxRequests) {
      response.setHeader('Retry-After', resetSeconds);
      next(
        new HttpError(
          429,
          'RATE_LIMITED',
          'Too many model requests. Wait briefly and try again.',
        ),
      );
      return;
    }

    next();
  };
}
