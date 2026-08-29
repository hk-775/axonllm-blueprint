import {
  DEFAULT_BEDROCK_MODEL_ID,
  REQUEST_LIMITS,
} from './constants';
import type { ModelInfo, RuntimeConfig } from './types';

const MODEL_LABELS: Record<string, Omit<ModelInfo, 'modelId'>> = {
  'us.amazon.nova-2-lite-v1:0': {
    modelName: 'Nova 2 Lite',
    provider: 'Amazon',
  },
  'us.anthropic.claude-sonnet-4-6': {
    modelName: 'Claude Sonnet 4.6',
    provider: 'Anthropic',
  },
};

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const DEFAULT_AUTH_HEADER = 'x-blueprint-user';

function splitCsv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function modelInfo(modelId: string): ModelInfo {
  const known = MODEL_LABELS[modelId];
  if (known) {
    return { modelId, ...known };
  }

  const normalizedId = modelId
    .replace(/^(us|global)\./, '')
    .replace(/[-_.:]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const providerSegment = modelId
    .replace(/^(us|global)\./, '')
    .split('.')[0];

  return {
    modelId,
    modelName: normalizedId,
    provider:
      providerSegment.charAt(0).toUpperCase() + providerSegment.slice(1),
  };
}

function booleanFlag(
  value: string | undefined,
  fallback: boolean,
  name: string,
): boolean {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }
  throw new Error(`${name} must be true or false.`);
}

function positiveInteger(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function nonNegativeInteger(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return parsed;
}

export function loadRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): RuntimeConfig {
  const configuredModelIds = splitCsv(env.BEDROCK_MODEL_IDS);
  const defaultModelId =
    env.BEDROCK_MODEL_ID?.trim() ||
    configuredModelIds[0] ||
    DEFAULT_BEDROCK_MODEL_ID;

  const modelIds = Array.from(
    new Set([defaultModelId, ...configuredModelIds]),
  );

  if (modelIds.length === 0) {
    throw new Error('At least one Bedrock model ID must be configured.');
  }

  const corsOrigins = splitCsv(env.CORS_ORIGINS);
  const nodeEnv = env.NODE_ENV?.trim() || 'development';
  const trustedAuthProxy = booleanFlag(
    env.BLUEPRINT_TRUST_AUTH_PROXY,
    false,
    'BLUEPRINT_TRUST_AUTH_PROXY',
  );
  const allowUnauthenticated = booleanFlag(
    env.BLUEPRINT_ALLOW_UNAUTHENTICATED,
    false,
    'BLUEPRINT_ALLOW_UNAUTHENTICATED',
  );
  const authHeaderName = (
    env.BLUEPRINT_AUTH_HEADER?.trim() || DEFAULT_AUTH_HEADER
  ).toLowerCase();

  if (!/^[a-z0-9-]+$/.test(authHeaderName)) {
    throw new Error(
      'BLUEPRINT_AUTH_HEADER must be a valid HTTP header name.',
    );
  }

  if (
    nodeEnv === 'production' &&
    !trustedAuthProxy &&
    !allowUnauthenticated
  ) {
    throw new Error(
      'Production startup requires BLUEPRINT_TRUST_AUTH_PROXY=true or an explicit BLUEPRINT_ALLOW_UNAUTHENTICATED=true acknowledgement.',
    );
  }

  const accessMode =
    nodeEnv !== 'production'
      ? 'development'
      : trustedAuthProxy
        ? 'trusted-proxy'
        : 'explicit-unauthenticated';

  return {
    nodeEnv,
    region:
      env.AWS_REGION?.trim() ||
      env.AWS_DEFAULT_REGION?.trim() ||
      'us-east-1',
    port: positiveInteger(env.PORT, 3001, 'PORT'),
    corsOrigins:
      corsOrigins.length > 0 ? corsOrigins : [...DEFAULT_CORS_ORIGINS],
    models: modelIds.map(modelInfo),
    defaultModelId,
    staticDir: env.STATIC_DIR?.trim() || undefined,
    verifyBedrockOnStartup: booleanFlag(
      env.VERIFY_BEDROCK_ON_STARTUP,
      false,
      'VERIFY_BEDROCK_ON_STARTUP',
    ),
    accessMode,
    trustedAuthProxy,
    authHeaderName,
    trustProxyHops: nonNegativeInteger(
      env.BLUEPRINT_TRUST_PROXY_HOPS,
      0,
      'BLUEPRINT_TRUST_PROXY_HOPS',
    ),
    rateLimitWindowMs: positiveInteger(
      env.BLUEPRINT_RATE_LIMIT_WINDOW_MS,
      60_000,
      'BLUEPRINT_RATE_LIMIT_WINDOW_MS',
    ),
    rateLimitMaxRequests: positiveInteger(
      env.BLUEPRINT_RATE_LIMIT_MAX_REQUESTS,
      12,
      'BLUEPRINT_RATE_LIMIT_MAX_REQUESTS',
    ),
  };
}

export const runtimeLimits = REQUEST_LIMITS;
