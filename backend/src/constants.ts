import type { InferenceParams } from './types';

export const PRODUCT_NAME = 'AxonLLM Blueprint';
export const PRODUCT_VERSION = '0.1.0-beta.1';

export const DEFAULT_CONFIG: InferenceParams = {
  temperature: 0.3,
  maxTokens: 2048,
  topP: 0.9,
};

export const DEFAULT_BEDROCK_MODEL_ID = 'us.amazon.nova-2-lite-v1:0';

export const PARAM_RANGES = {
  temperature: { min: 0, max: 1, default: DEFAULT_CONFIG.temperature },
  maxTokens: { min: 1, max: 4096, default: DEFAULT_CONFIG.maxTokens },
  topP: { min: 0, max: 1, default: DEFAULT_CONFIG.topP },
} as const;

export const REQUEST_LIMITS = {
  maxMessageChars: 50_000,
  maxSessionMessages: 24,
  maxSessions: 500,
  sessionTtlMs: 4 * 60 * 60 * 1000,
  maxRateLimitKeys: 10_000,
  staticFallbackRateLimitWindowMs: 60_000,
  staticFallbackRateLimitMaxRequests: 300,
} as const;
