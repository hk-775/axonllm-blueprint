import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import cors, { type CorsOptions } from 'cors';
import express, {
  type ErrorRequestHandler,
  type Request,
  type Response,
} from 'express';
import { rateLimit } from 'express-rate-limit';
import { BedrockClient } from './bedrockClient';
import {
  DEFAULT_CONFIG,
  PRODUCT_NAME,
  PRODUCT_VERSION,
  REQUEST_LIMITS,
} from './constants';
import { HttpError } from './errors';
import { PromptEngine } from './promptEngine';
import { createRateLimiter } from './rateLimiter';
import { SessionManager } from './sessionManager';
import type {
  InferenceParams,
  RuntimeConfig,
} from './types';
import { parseChatRequest } from './validation';

export interface AppDependencies {
  sessionManager?: SessionManager;
  promptEngine?: PromptEngine;
  bedrockClientFactory?: (
    modelId: string,
    inferenceParams: InferenceParams,
  ) => Pick<BedrockClient, 'converse'>;
}

export interface BlueprintApp {
  app: express.Express;
  sessionManager: SessionManager;
}

function buildCorsOptions(config: RuntimeConfig): CorsOptions {
  const allowedOrigins = new Set(config.corsOrigins);

  return {
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    maxAge: 600,
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(
        new HttpError(
          403,
          'ORIGIN_NOT_ALLOWED',
          'The request origin is not allowed by CORS policy.',
        ),
      );
    },
  };
}

function buildSecurityHeaders(config: RuntimeConfig): express.RequestHandler {
  const contentSecurityPolicy = [
    "default-src 'self'",
    "base-uri 'none'",
    "connect-src 'self'",
    "font-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
  ].join('; ');

  return (_request, response, next) => {
    response.setHeader('Content-Security-Policy', contentSecurityPolicy);
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');

    if (config.nodeEnv === 'production') {
      response.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000',
      );
    }

    next();
  };
}

function buildPrincipalMiddleware(
  config: RuntimeConfig,
): express.RequestHandler {
  return (request, response, next) => {
    let identitySource: string;

    if (config.trustedAuthProxy) {
      const identity = request.get(config.authHeaderName)?.trim();
      if (!identity || identity.length > 256) {
        next(
          new HttpError(
            401,
            'AUTHENTICATION_REQUIRED',
            'An authenticated identity is required.',
          ),
        );
        return;
      }
      identitySource = `proxy:${identity}`;
    } else {
      identitySource = `network:${request.ip || request.socket.remoteAddress || 'unknown'}`;
    }

    response.locals.principalId = createHash('sha256')
      .update(identitySource)
      .digest('hex');
    next();
  };
}

function principalId(response: Response): string {
  return String(response.locals.principalId ?? 'anonymous');
}

function configureStaticFrontend(
  app: express.Express,
  staticDir: string | undefined,
): void {
  if (!staticDir) {
    return;
  }

  const indexPath = path.join(staticDir, 'index.html');
  if (!existsSync(indexPath)) {
    throw new Error(`STATIC_DIR does not contain index.html: ${staticDir}`);
  }

  app.use(
    express.static(staticDir, {
      dotfiles: 'deny',
      index: false,
      maxAge: '1h',
    }),
  );

  const staticFallbackRateLimiter = rateLimit({
    windowMs: REQUEST_LIMITS.staticFallbackRateLimitWindowMs,
    limit: REQUEST_LIMITS.staticFallbackRateLimitMaxRequests,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    identifier: 'static-fallback',
    skip: (request) =>
      request.method !== 'GET' ||
      request.path.startsWith('/api/'),
  });

  app.use(
    staticFallbackRateLimiter,
    (request, response, next) => {
      if (
        request.method === 'GET' &&
        !request.path.startsWith('/api/')
      ) {
        response.sendFile(indexPath);
        return;
      }
      next();
    },
  );
}

export function createApp(
  config: RuntimeConfig,
  dependencies: AppDependencies = {},
): BlueprintApp {
  const app = express();
  const allowedModelIds = new Set(
    config.models.map((model) => model.modelId),
  );
  const sessionManager =
    dependencies.sessionManager ??
    new SessionManager({
      defaultConfig: DEFAULT_CONFIG,
      defaultModelId: config.defaultModelId,
    });
  const promptEngine = dependencies.promptEngine ?? new PromptEngine();
  const bedrockClientFactory =
    dependencies.bedrockClientFactory ??
    ((modelId: string, inferenceParams: InferenceParams) =>
      new BedrockClient({
        region: config.region,
        modelId,
        inferenceParams,
        models: config.models,
      }));

  app.disable('x-powered-by');
  if (config.trustProxyHops > 0) {
    app.set('trust proxy', config.trustProxyHops);
  }
  app.use(buildSecurityHeaders(config));
  app.use((request, response, next) => {
    const requestId = randomUUID();
    response.locals.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);
    next();
  });
  app.use(cors(buildCorsOptions(config)));
  app.use(express.json({ limit: '256kb' }));
  app.use('/api', (_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.get('/api/health', (_request, response) => {
    response.json({
      status: 'ok',
      service: PRODUCT_NAME,
      version: PRODUCT_VERSION,
      bedrock: {
        region: config.region,
        configuredModels: config.models.length,
      },
      sessions: {
        storage: 'memory',
        active: sessionManager.size,
      },
    });
  });

  app.use('/api', buildPrincipalMiddleware(config));
  app.use(
    '/api/chat',
    createRateLimiter({
      windowMs: config.rateLimitWindowMs,
      maxRequests: config.rateLimitMaxRequests,
      maxKeys: REQUEST_LIMITS.maxRateLimitKeys,
      keyGenerator: (_request, response) => principalId(response),
    }),
  );

  app.get('/api/models', (_request, response) => {
    response.json({ models: config.models });
  });

  app.get('/api/config', (_request, response) => {
    response.json({
      config: DEFAULT_CONFIG,
      modelId: config.defaultModelId,
      region: config.region,
      limits: {
        maxMessageChars: REQUEST_LIMITS.maxMessageChars,
        maxSessionMessages: REQUEST_LIMITS.maxSessionMessages,
      },
    });
  });

  app.post('/api/sessions', (_request, response) => {
    const session = sessionManager.createSession(principalId(response));
    response.status(201).json({ sessionId: session.id });
  });

  app.delete('/api/sessions/:id', (request, response) => {
    const sessionId = request.params.id;
    const ownerId = principalId(response);
    if (
      typeof sessionId !== 'string' ||
      !sessionManager.getSession(sessionId, ownerId)
    ) {
      throw new HttpError(
        404,
        'SESSION_NOT_FOUND',
        'Session not found. Start a new session.',
      );
    }

    sessionManager.clearSession(sessionId, ownerId);
    response.json({ message: 'Session cleared.' });
  });

  app.post('/api/chat', async (request, response) => {
    const parsed = parseChatRequest(
      request.body,
      allowedModelIds,
      REQUEST_LIMITS.maxMessageChars,
    );

    let session;
    const ownerId = principalId(response);
    if (parsed.sessionId) {
      session = sessionManager.getSession(parsed.sessionId, ownerId);
      if (!session) {
        throw new HttpError(
          404,
          'SESSION_NOT_FOUND',
          'Session expired or was not found. Start a new session.',
        );
      }
    } else {
      session = sessionManager.createSession(ownerId);
    }

    const modelId = parsed.modelId ?? session.modelId;
    const inferenceParams = {
      ...session.config,
      ...parsed.config,
    };
    const intent = promptEngine.classifyIntent(parsed.message);
    const systemPrompt = promptEngine.buildSystemPrompt({
      intent,
      iacFormat:
        intent === 'iac-generation'
          ? promptEngine.detectIacFormat(parsed.message)
          : undefined,
    });
    const messages = promptEngine.assembleMessages(
      session.messages,
      parsed.message,
    );

    const bedrockClient = bedrockClientFactory(
      modelId,
      inferenceParams,
    );
    const result = await bedrockClient.converse(messages, systemPrompt);

    sessionManager.addMessage(session.id, {
      role: 'user',
      content: parsed.message,
    });
    sessionManager.addMessage(session.id, {
      role: 'assistant',
      content: result.content,
    });
    sessionManager.updateSettings(
      session.id,
      inferenceParams,
      modelId,
    );

    response.json({
      response: result.content,
      sessionId: session.id,
      modelId,
      intent,
      stopReason: result.stopReason,
      usage: result.usage,
    });
  });

  app.use('/api', (_request, _response, next) => {
    next(
      new HttpError(
        404,
        'ROUTE_NOT_FOUND',
        'The requested API route does not exist.',
      ),
    );
  });

  configureStaticFrontend(app, config.staticDir);

  const errorHandler: ErrorRequestHandler = (
    error: unknown,
    _request,
    response,
    _next,
  ) => {
    const requestId = String(response.locals.requestId ?? '');

    if (
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      (error as { type?: string }).type === 'entity.parse.failed'
    ) {
      response.status(400).json({
        error: 'Request body contains invalid JSON.',
        code: 'INVALID_JSON',
        requestId,
      });
      return;
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      (error as { type?: string }).type === 'entity.too.large'
    ) {
      response.status(413).json({
        error: 'Request body is too large.',
        code: 'REQUEST_TOO_LARGE',
        requestId,
      });
      return;
    }

    if (error instanceof HttpError) {
      response.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        requestId,
      });
      return;
    }

    const errorName = error instanceof Error ? error.name : 'UnknownError';
    console.error(`[blueprint] unhandled request error: ${errorName}`);
    response.status(500).json({
      error: 'An unexpected server error occurred.',
      code: 'INTERNAL_ERROR',
      requestId,
    });
  };

  app.use(errorHandler);

  return { app, sessionManager };
}
