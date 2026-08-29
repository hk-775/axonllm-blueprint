import 'dotenv/config';
import type { Server } from 'node:http';
import { createApp } from './app';
import { BedrockClient } from './bedrockClient';
import { DEFAULT_CONFIG, PRODUCT_NAME } from './constants';
import { loadRuntimeConfig } from './runtimeConfig';

const runtimeConfig = loadRuntimeConfig();
const { app, sessionManager } = createApp(runtimeConfig);

async function start(): Promise<Server> {
  const server = app.listen(runtimeConfig.port, () => {
    console.log(
      `${PRODUCT_NAME} API listening on http://localhost:${runtimeConfig.port}`,
    );
    console.log(
      `Bedrock region: ${runtimeConfig.region}; default model: ${runtimeConfig.defaultModelId}`,
    );
  });

  if (runtimeConfig.verifyBedrockOnStartup) {
    const client = new BedrockClient({
      region: runtimeConfig.region,
      modelId: runtimeConfig.defaultModelId,
      inferenceParams: DEFAULT_CONFIG,
      models: runtimeConfig.models,
    });
    const connected = await client.verifyConnectivity();
    console.log(
      `Bedrock startup check: ${connected ? 'available' : 'unavailable'}`,
    );
  }

  const shutdown = (signal: string): void => {
    console.log(`${signal} received; shutting down.`);
    server.close((error) => {
      if (error) {
        console.error('Failed to close the HTTP server cleanly.');
        process.exitCode = 1;
      }
    });
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));

  return server;
}

export { app, runtimeConfig, sessionManager, start };

if (require.main === module) {
  void start();
}
