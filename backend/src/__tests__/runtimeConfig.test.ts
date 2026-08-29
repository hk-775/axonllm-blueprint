import { loadRuntimeConfig } from '../runtimeConfig';

describe('runtime configuration', () => {
  test('uses a current Bedrock inference profile by default', () => {
    const config = loadRuntimeConfig({});

    expect(config.nodeEnv).toBe('development');
    expect(config.region).toBe('us-east-1');
    expect(config.defaultModelId).toBe('us.amazon.nova-2-lite-v1:0');
    expect(config.models[0].modelName).toBe('Nova 2 Lite');
    expect(config.accessMode).toBe('development');
    expect(config.rateLimitMaxRequests).toBe(12);
  });

  test('deduplicates the model allowlist and honors the selected default', () => {
    const config = loadRuntimeConfig({
      BEDROCK_MODEL_ID: 'us.anthropic.claude-sonnet-4-6',
      BEDROCK_MODEL_IDS:
        'us.amazon.nova-2-lite-v1:0,us.anthropic.claude-sonnet-4-6',
      AWS_REGION: 'us-west-2',
    });

    expect(config.region).toBe('us-west-2');
    expect(config.defaultModelId).toBe(
      'us.anthropic.claude-sonnet-4-6',
    );
    expect(config.models.map((model) => model.modelId)).toEqual([
      'us.anthropic.claude-sonnet-4-6',
      'us.amazon.nova-2-lite-v1:0',
    ]);
  });

  test('rejects invalid ports', () => {
    expect(() => loadRuntimeConfig({ PORT: 'zero' })).toThrow(
      'PORT must be a positive integer.',
    );
  });

  test('refuses an unauthenticated production startup by default', () => {
    expect(() => loadRuntimeConfig({ NODE_ENV: 'production' })).toThrow(
      'Production startup requires',
    );
  });

  test('accepts an authenticated proxy with bounded proxy settings', () => {
    const config = loadRuntimeConfig({
      NODE_ENV: 'production',
      BLUEPRINT_TRUST_AUTH_PROXY: 'true',
      BLUEPRINT_AUTH_HEADER: 'X-Verified-User',
      BLUEPRINT_TRUST_PROXY_HOPS: '1',
      BLUEPRINT_RATE_LIMIT_MAX_REQUESTS: '25',
    });

    expect(config.accessMode).toBe('trusted-proxy');
    expect(config.authHeaderName).toBe('x-verified-user');
    expect(config.trustProxyHops).toBe(1);
    expect(config.rateLimitMaxRequests).toBe(25);
  });

  test('requires explicit acknowledgement for unauthenticated production', () => {
    const config = loadRuntimeConfig({
      NODE_ENV: 'production',
      BLUEPRINT_ALLOW_UNAUTHENTICATED: 'true',
    });

    expect(config.accessMode).toBe('explicit-unauthenticated');
  });
});
