import { describe, expect, it } from 'vitest';
import { publicCreateSession, publicGetConfig, publicGetModels, publicPostChat } from './publicDemo';

describe('published synthetic adapter', () => {
  it('provides browser-local configuration without a backend', async () => {
    const [models, config, session] = await Promise.all([
      publicGetModels(),
      publicGetConfig(),
      publicCreateSession(),
    ]);
    expect(models.models).toHaveLength(2);
    expect(config.region).toBe('Browser local');
    expect(session.sessionId).toMatch(/^public-session-/);
  });

  it.each([
    ['Design a secure platform', 'general'],
    ['Create Terraform for DynamoDB', 'iac-generation'],
    ['Review AccessControl: PublicRead', 'config-analysis'],
    ['Troubleshoot AccessDeniedException', 'troubleshooting'],
  ])('returns deterministic synthetic %s guidance', async (message, intent) => {
    const result = await publicPostChat('public-session-test', message, {}, 'public-demo-nova');
    expect(result.intent).toBe(intent);
    expect(result.synthetic).toBe(true);
    expect(result.response).toContain('Synthetic browser-local response');
  });
});
