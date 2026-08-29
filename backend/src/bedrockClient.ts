import {
  BedrockRuntimeClient,
  BedrockRuntimeServiceException,
  ConverseCommand,
  type ConverseCommandInput,
  type ConverseCommandOutput,
  type Message,
  type SystemContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import { HttpError, isErrorWithName } from './errors';
import type {
  ConversationMessage,
  InferenceParams,
  ModelInfo,
  ModelResponse,
} from './types';

export interface BedrockClientConfig {
  region: string;
  modelId: string;
  inferenceParams: InferenceParams;
  models?: ModelInfo[];
}

interface BedrockSender {
  send(command: ConverseCommand): Promise<ConverseCommandOutput>;
}

export class BedrockClient {
  private readonly client: BedrockSender;
  private readonly config: BedrockClientConfig;

  constructor(
    config: BedrockClientConfig,
    client?: BedrockSender,
  ) {
    this.config = {
      ...config,
      inferenceParams: { ...config.inferenceParams },
      models: config.models?.map((model) => ({ ...model })),
    };
    this.client =
      client ??
      new BedrockRuntimeClient({
        region: config.region,
        maxAttempts: 5,
        retryMode: 'adaptive',
      });
  }

  buildConverseInput(
    messages: ConversationMessage[],
    systemPrompt: string,
  ): ConverseCommandInput {
    const sdkMessages: Message[] = messages.map((message) => ({
      role: message.role,
      content: [{ text: message.content }],
    }));

    const system: SystemContentBlock[] = [{ text: systemPrompt }];

    return {
      modelId: this.config.modelId,
      messages: sdkMessages,
      system,
      inferenceConfig: {
        temperature: this.config.inferenceParams.temperature,
        maxTokens: this.config.inferenceParams.maxTokens,
        topP: this.config.inferenceParams.topP,
      },
    };
  }

  async converse(
    messages: ConversationMessage[],
    systemPrompt: string,
  ): Promise<ModelResponse> {
    try {
      const response = await this.client.send(
        new ConverseCommand(this.buildConverseInput(messages, systemPrompt)),
      );

      const content = (response.output?.message?.content ?? [])
        .flatMap((block) => ('text' in block && block.text ? [block.text] : []))
        .join('\n')
        .trim();

      if (!content) {
        throw new HttpError(
          502,
          'EMPTY_MODEL_RESPONSE',
          'Bedrock returned an empty text response.',
        );
      }

      return {
        content,
        stopReason: response.stopReason ?? 'unknown',
        usage: {
          inputTokens: response.usage?.inputTokens ?? 0,
          outputTokens: response.usage?.outputTokens ?? 0,
        },
      };
    } catch (error: unknown) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw this.translateError(error);
    }
  }

  listAvailableModels(): ModelInfo[] {
    if (this.config.models && this.config.models.length > 0) {
      return this.config.models.map((model) => ({ ...model }));
    }

    return [
      {
        modelId: this.config.modelId,
        modelName: this.config.modelId,
        provider: 'Configured',
      },
    ];
  }

  async verifyConnectivity(): Promise<boolean> {
    try {
      await this.client.send(
        new ConverseCommand({
          modelId: this.config.modelId,
          messages: [{ role: 'user', content: [{ text: 'Reply with OK.' }] }],
          inferenceConfig: { maxTokens: 2 },
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  private translateError(error: unknown): HttpError {
    const name = isErrorWithName(error) ? error.name : 'UnknownError';
    const message =
      error instanceof Error ? error.message.toLowerCase() : '';
    const statusCode =
      error instanceof BedrockRuntimeServiceException
        ? error.$metadata.httpStatusCode
        : undefined;

    if (
      name === 'CredentialsProviderError' ||
      name === 'InvalidIdentityToken' ||
      name === 'ExpiredTokenException' ||
      message.includes('credentials')
    ) {
      return new HttpError(
        503,
        'AWS_CREDENTIALS_ERROR',
        'AWS credentials are unavailable or expired. Configure the standard AWS credential chain and try again.',
      );
    }

    if (name === 'AccessDeniedException' || statusCode === 403) {
      return new HttpError(
        403,
        'BEDROCK_ACCESS_DENIED',
        `Model ${this.config.modelId} is not accessible. Check Bedrock model access and IAM permissions.`,
      );
    }

    if (name === 'ResourceNotFoundException' || statusCode === 404) {
      return new HttpError(
        404,
        'BEDROCK_MODEL_NOT_FOUND',
        `Model ${this.config.modelId} was not found in ${this.config.region}.`,
      );
    }

    if (name === 'ThrottlingException' || statusCode === 429) {
      return new HttpError(
        429,
        'BEDROCK_THROTTLED',
        'Bedrock is throttling requests after automatic retries. Wait briefly and try again.',
      );
    }

    if (name === 'ValidationException' || statusCode === 400) {
      return new HttpError(
        400,
        'BEDROCK_VALIDATION_ERROR',
        'Bedrock rejected the request. Check the selected model and inference parameters.',
      );
    }

    if (name === 'ModelTimeoutException') {
      return new HttpError(
        504,
        'BEDROCK_TIMEOUT',
        'The model took too long to respond. Reduce the output-token limit or simplify the request.',
      );
    }

    if (
      name === 'ServiceUnavailableException' ||
      name === 'InternalServerException' ||
      (statusCode !== undefined && statusCode >= 500)
    ) {
      return new HttpError(
        503,
        'BEDROCK_UNAVAILABLE',
        'Amazon Bedrock is temporarily unavailable. Try again later.',
      );
    }

    return new HttpError(
      502,
      'BEDROCK_REQUEST_FAILED',
      'The Bedrock request failed unexpectedly.',
    );
  }
}
