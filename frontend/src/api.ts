const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
const API_BASE = (configuredApiBase || '/api').replace(/\/$/, '');

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface InferenceParams {
  temperature: number;
  maxTokens: number;
  topP: number;
}

export interface ChatResponseData {
  response: string;
  sessionId: string;
  modelId: string;
  intent:
    | 'iac-generation'
    | 'config-analysis'
    | 'troubleshooting'
    | 'general';
  stopReason: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface SessionResponse {
  sessionId: string;
}

export interface ModelInfo {
  modelId: string;
  modelName: string;
  provider: string;
}

export interface ConfigResponse {
  config: InferenceParams;
  modelId: string;
  region: string;
  limits: {
    maxMessageChars: number;
    maxSessionMessages: number;
  };
}

export interface HealthResponse {
  status: 'ok';
  service: string;
  version: string;
  bedrock: {
    region: string;
    configuredModels: number;
  };
  sessions: {
    storage: 'memory';
    active: number;
  };
}

interface ApiErrorBody {
  error?: string;
  message?: string;
  code?: string;
  requestId?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error || body.message || `Request failed with status ${status}.`);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.requestId = body.requestId;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = (await response
      .json()
      .catch(() => ({}))) as ApiErrorBody;
    throw new ApiError(response.status, body);
  }

  return response.json() as Promise<T>;
}

export function postChat(
  sessionId: string,
  message: string,
  config: Partial<InferenceParams>,
  modelId: string,
): Promise<ChatResponseData> {
  return request<ChatResponseData>('/chat', {
    method: 'POST',
    body: JSON.stringify({ sessionId, message, config, modelId }),
  });
}

export function createSession(): Promise<SessionResponse> {
  return request<SessionResponse>('/sessions', { method: 'POST' });
}

export function deleteSession(id: string): Promise<{ message: string }> {
  return request<{ message: string }>(
    `/sessions/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}

export function getModels(): Promise<{ models: ModelInfo[] }> {
  return request<{ models: ModelInfo[] }>('/models');
}

export function getConfig(): Promise<ConfigResponse> {
  return request<ConfigResponse>('/config');
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health');
}
