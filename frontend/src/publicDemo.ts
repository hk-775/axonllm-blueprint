import type {
  ChatResponseData,
  ConfigResponse,
  HealthResponse,
  InferenceParams,
  ModelInfo,
  SessionResponse,
} from './api';

const MODELS: ModelInfo[] = [
  {
    modelId: 'public-demo-nova',
    modelName: 'Nova 2 Lite · synthetic profile',
    provider: 'Browser-local preview',
  },
  {
    modelId: 'public-demo-claude',
    modelName: 'Claude Sonnet · synthetic profile',
    provider: 'Browser-local preview',
  },
];

const CONFIG: ConfigResponse = {
  config: { temperature: 0.3, maxTokens: 2048, topP: 0.9 },
  modelId: MODELS[0].modelId,
  region: 'Browser local',
  limits: { maxMessageChars: 12_000, maxSessionMessages: 24 },
};

let sessionSequence = 0;

function intentFor(message: string): ChatResponseData['intent'] {
  const lower = message.toLowerCase();
  if (/(troubleshoot|diagnose|accessdenied|failure|not working)/.test(lower)) {
    return 'troubleshooting';
  }
  if (/(review|audit|publicread|misconfiguration)/.test(lower)) {
    return 'config-analysis';
  }
  if (/(terraform|cloudformation|cdk|generate|create|write)/.test(lower)) {
    return 'iac-generation';
  }
  return 'general';
}

const RESPONSES: Record<ChatResponseData['intent'], string> = {
  general: `> **Synthetic browser-local response.** No model or cloud service was called.

## Proposed architecture

1. Put ingestion behind an authenticated, rate-limited edge.
2. Separate tenant identity, event transport, processing, and durable storage.
3. Encrypt data in transit and at rest with workload-scoped access.
4. Add replay, dead-letter handling, tracing, and cost alarms before scale.

## Trust boundaries

- Treat every producer payload as untrusted.
- Keep workload roles separate by account and environment.
- Require human review before applying generated infrastructure.

## Validation

Confirm throughput, recovery objectives, residency, and failure-isolation requirements, then run native IaC validation and a staged load test.`,
  'iac-generation': `> **Synthetic browser-local response.** This snippet is illustrative and was not generated or validated by a model.

\`\`\`hcl
terraform {
  required_version = ">= 1.8.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

resource "aws_dynamodb_table" "requests" {
  name         = var.table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"
  range_key    = "request_id"

  attribute { name = "tenant_id"; type = "S" }
  attribute { name = "request_id"; type = "S" }

  point_in_time_recovery { enabled = true }
  server_side_encryption { enabled = true }
}
\`\`\`

Review IAM, network placement, retention, provider constraints, and destructive changes before applying.`,
  'config-analysis': `> **Synthetic browser-local response.** No configuration was uploaded.

## Critical

**Public bucket ACL** — \`AccessControl: PublicRead\` can expose every object.

## Remediation

- Remove the public ACL.
- Enable all four S3 Block Public Access controls.
- Use CloudFront Origin Access Control for private delivery.
- Add encryption, access logging, lifecycle rules, and explicit ownership.

Run \`cfn-lint\`, policy checks, and a change set review before deployment.`,
  troubleshooting: `> **Synthetic browser-local response.** These are read-only checks first.

1. Confirm the caller identity and Region.
2. Verify the execution role allows the exact Bedrock model or inference-profile resource.
3. Check organization SCPs, permission boundaries, and session policies.
4. Confirm the model is enabled and available in the selected Region.
5. Inspect CloudTrail and application request IDs without logging prompt content.

After the denied policy layer is identified, make the narrowest change and test with a non-production request.`,
};

function waitBriefly(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 320));
}

export async function publicPostChat(
  sessionId: string,
  message: string,
  _config: Partial<InferenceParams>,
  modelId: string,
): Promise<ChatResponseData> {
  await waitBriefly();
  const intent = intentFor(message);
  return {
    response: RESPONSES[intent],
    sessionId,
    modelId,
    intent,
    stopReason: 'synthetic_complete',
    usage: {
      inputTokens: Math.max(1, Math.ceil(message.length / 4)),
      outputTokens: Math.ceil(RESPONSES[intent].length / 4),
    },
    synthetic: true,
  };
}

export async function publicCreateSession(): Promise<SessionResponse> {
  sessionSequence += 1;
  return { sessionId: `public-session-${sessionSequence}` };
}

export async function publicDeleteSession(): Promise<{ message: string }> {
  return { message: 'Browser-local session cleared.' };
}

export async function publicGetModels(): Promise<{ models: ModelInfo[] }> {
  return { models: MODELS.map((model) => ({ ...model })) };
}

export async function publicGetConfig(): Promise<ConfigResponse> {
  return { ...CONFIG, config: { ...CONFIG.config }, limits: { ...CONFIG.limits } };
}

export async function publicGetHealth(): Promise<HealthResponse> {
  return {
    status: 'ok',
    service: 'AxonLLM Blueprint public preview',
    version: '0.1.0-beta.1 · synthetic',
    bedrock: { region: 'not connected', configuredModels: MODELS.length },
    sessions: { storage: 'memory', active: 0 },
  };
}
