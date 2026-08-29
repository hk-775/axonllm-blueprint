export type ConversationRole = 'user' | 'assistant';

export interface ConversationMessage {
  role: ConversationRole;
  content: string;
}

export interface InferenceParams {
  temperature: number;
  maxTokens: number;
  topP: number;
}

export interface ModelResponse {
  content: string;
  stopReason: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface ModelInfo {
  modelId: string;
  modelName: string;
  provider: string;
}

export interface Session {
  id: string;
  ownerId: string;
  messages: ConversationMessage[];
  config: InferenceParams;
  modelId: string;
  createdAt: Date;
  lastAccessedAt: Date;
}

export interface ChatRequest {
  sessionId?: string;
  message: string;
  config?: Partial<InferenceParams>;
  modelId?: string;
}

export interface ChatResponse {
  response: string;
  sessionId: string;
  modelId: string;
  intent: QueryIntent;
  stopReason: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export type QueryIntent =
  | 'iac-generation'
  | 'config-analysis'
  | 'troubleshooting'
  | 'general';

export type IacFormat = 'cloudformation' | 'terraform' | 'cdk';

export interface PromptContext {
  intent: QueryIntent;
  iacFormat?: IacFormat;
}

export interface AnalysisFinding {
  severity: 'critical' | 'warning' | 'informational';
  description: string;
  remediation: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface RuntimeConfig {
  nodeEnv: string;
  region: string;
  port: number;
  corsOrigins: string[];
  models: ModelInfo[];
  defaultModelId: string;
  staticDir?: string;
  verifyBedrockOnStartup: boolean;
  accessMode:
    | 'development'
    | 'trusted-proxy'
    | 'explicit-unauthenticated';
  trustedAuthProxy: boolean;
  authHeaderName: string;
  trustProxyHops: number;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
}
