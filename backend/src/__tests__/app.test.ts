import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../app';
import type { RuntimeConfig } from '../types';

const runtimeConfig: RuntimeConfig = {
  nodeEnv: 'test',
  region: 'us-east-1',
  port: 3001,
  corsOrigins: ['http://localhost:5173'],
  models: [
    {
      modelId: 'us.amazon.nova-2-lite-v1:0',
      modelName: 'Nova 2 Lite',
      provider: 'Amazon',
    },
  ],
  defaultModelId: 'us.amazon.nova-2-lite-v1:0',
  verifyBedrockOnStartup: false,
  accessMode: 'development',
  trustedAuthProxy: false,
  authHeaderName: 'x-blueprint-user',
  trustProxyHops: 0,
  rateLimitWindowMs: 60_000,
  rateLimitMaxRequests: 100,
};

async function listen(
  config: RuntimeConfig,
): Promise<{ server: Server; baseUrl: string }> {
  const { app } = createApp(config, {
    bedrockClientFactory: () => ({
      async converse() {
        return {
          content: 'Validated response',
          stopReason: 'end_turn',
          usage: { inputTokens: 12, outputTokens: 4 },
        };
      },
    }),
  });

  const server = await new Promise<Server>((resolve) => {
    const listeningServer = app.listen(0, '127.0.0.1', () => {
      resolve(listeningServer);
    });
  });
  const address = server.address() as AddressInfo;
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

describe('Blueprint API', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    ({ server, baseUrl } = await listen(runtimeConfig));
  });

  afterAll(async () => {
    await close(server);
  });

  test('reports health without invoking a model', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.service).toBe('AxonLLM Blueprint');
    expect(body.bedrock.region).toBe('us-east-1');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-security-policy')).toContain(
      "default-src 'self'",
    );
  });

  test('rejects empty chat messages', async () => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '   ' }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('INVALID_MESSAGE');
  });

  test('rejects model IDs outside the server allowlist', async () => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Design a private API',
        modelId: 'untrusted.model-id',
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('MODEL_NOT_ALLOWED');
  });

  test('returns a bounded, typed chat response', async () => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Create a Terraform VPC',
        config: { maxTokens: 1024 },
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.response).toBe('Validated response');
    expect(body.intent).toBe('iac-generation');
    expect(body.modelId).toBe('us.amazon.nova-2-lite-v1:0');
    expect(body.sessionId).toEqual(expect.any(String));
  });

  test('rate limits repeated model requests by principal', async () => {
    const limited = await listen({
      ...runtimeConfig,
      rateLimitMaxRequests: 1,
    });

    try {
      const request = () =>
        fetch(`${limited.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Review this architecture.' }),
        });

      expect((await request()).status).toBe(200);
      const blocked = await request();
      const body = await blocked.json();

      expect(blocked.status).toBe(429);
      expect(body.code).toBe('RATE_LIMITED');
      expect(blocked.headers.get('retry-after')).toEqual(expect.any(String));
    } finally {
      await close(limited.server);
    }
  });

  test('rate limits static frontend fallback reads', async () => {
    const staticDir = await mkdtemp(
      path.join(tmpdir(), 'axonllm-blueprint-static-'),
    );
    await writeFile(
      path.join(staticDir, 'index.html'),
      '<!doctype html><title>Blueprint test shell</title>',
      'utf8',
    );
    const staticApp = await listen({
      ...runtimeConfig,
      staticDir,
    });

    try {
      const response = await fetch(
        `${staticApp.baseUrl}/workspace`,
      );

      expect(response.status).toBe(200);
      expect(await response.text()).toContain(
        'Blueprint test shell',
      );
      expect(response.headers.get('ratelimit')).toContain(
        '"static-fallback"',
      );
    } finally {
      await close(staticApp.server);
      await rm(staticDir, { recursive: true, force: true });
    }
  });

  test('requires trusted proxy identity and isolates sessions', async () => {
    const protectedApi = await listen({
      ...runtimeConfig,
      accessMode: 'trusted-proxy',
      trustedAuthProxy: true,
    });

    try {
      const unauthenticated = await fetch(
        `${protectedApi.baseUrl}/api/models`,
      );
      expect(unauthenticated.status).toBe(401);

      const sessionResponse = await fetch(
        `${protectedApi.baseUrl}/api/sessions`,
        {
          method: 'POST',
          headers: { 'X-Blueprint-User': 'alice@example.test' },
        },
      );
      const session = await sessionResponse.json();
      expect(sessionResponse.status).toBe(201);

      const crossTenant = await fetch(
        `${protectedApi.baseUrl}/api/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Blueprint-User': 'bob@example.test',
          },
          body: JSON.stringify({
            sessionId: session.sessionId,
            message: 'Read the other tenant session.',
          }),
        },
      );
      const body = await crossTenant.json();

      expect(crossTenant.status).toBe(404);
      expect(body.code).toBe('SESSION_NOT_FOUND');
    } finally {
      await close(protectedApi.server);
    }
  });
});
