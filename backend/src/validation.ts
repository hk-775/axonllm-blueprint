import { PARAM_RANGES } from './constants';
import type {
  ChatRequest,
  InferenceParams,
  ValidationResult,
} from './types';
import { HttpError } from './errors';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateInferenceParams(
  params: Partial<InferenceParams>,
): ValidationResult {
  if (params.temperature !== undefined) {
    const { min, max } = PARAM_RANGES.temperature;
    if (
      !Number.isFinite(params.temperature) ||
      params.temperature < min ||
      params.temperature > max
    ) {
      return {
        valid: false,
        error: `temperature must be a finite number between ${min} and ${max}`,
      };
    }
  }

  if (params.maxTokens !== undefined) {
    const { min, max } = PARAM_RANGES.maxTokens;
    if (
      !Number.isInteger(params.maxTokens) ||
      params.maxTokens < min ||
      params.maxTokens > max
    ) {
      return {
        valid: false,
        error: `maxTokens must be an integer between ${min} and ${max}`,
      };
    }
  }

  if (params.topP !== undefined) {
    const { min, max } = PARAM_RANGES.topP;
    if (
      !Number.isFinite(params.topP) ||
      params.topP < min ||
      params.topP > max
    ) {
      return {
        valid: false,
        error: `topP must be a finite number between ${min} and ${max}`,
      };
    }
  }

  return { valid: true };
}

export function parseChatRequest(
  body: unknown,
  allowedModelIds: ReadonlySet<string>,
  maxMessageChars: number,
): ChatRequest {
  if (!isRecord(body)) {
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  }

  if (typeof body.message !== 'string' || body.message.trim().length === 0) {
    throw new HttpError(400, 'INVALID_MESSAGE', 'Message cannot be empty.');
  }

  const message = body.message.trim();
  if (message.length > maxMessageChars) {
    throw new HttpError(
      413,
      'MESSAGE_TOO_LARGE',
      `Message must be ${maxMessageChars} characters or fewer.`,
    );
  }

  if (
    body.sessionId !== undefined &&
    (typeof body.sessionId !== 'string' || body.sessionId.trim().length === 0)
  ) {
    throw new HttpError(
      400,
      'INVALID_SESSION_ID',
      'sessionId must be a non-empty string.',
    );
  }

  if (
    body.modelId !== undefined &&
    (typeof body.modelId !== 'string' ||
      !allowedModelIds.has(body.modelId))
  ) {
    throw new HttpError(
      400,
      'MODEL_NOT_ALLOWED',
      'The requested model is not in the server allowlist.',
    );
  }

  let config: Partial<InferenceParams> | undefined;
  if (body.config !== undefined) {
    if (!isRecord(body.config)) {
      throw new HttpError(
        400,
        'INVALID_CONFIG',
        'config must be an object.',
      );
    }

    const permittedKeys = new Set(['temperature', 'maxTokens', 'topP']);
    const unknownKey = Object.keys(body.config).find(
      (key) => !permittedKeys.has(key),
    );
    if (unknownKey) {
      throw new HttpError(
        400,
        'INVALID_CONFIG',
        `Unsupported inference parameter: ${unknownKey}.`,
      );
    }

    config = body.config as Partial<InferenceParams>;
    const validation = validateInferenceParams(config);
    if (!validation.valid) {
      throw new HttpError(
        400,
        'INVALID_CONFIG',
        validation.error ?? 'Invalid inference configuration.',
      );
    }
  }

  return {
    message,
    sessionId: body.sessionId as string | undefined,
    modelId: body.modelId as string | undefined,
    config,
  };
}
