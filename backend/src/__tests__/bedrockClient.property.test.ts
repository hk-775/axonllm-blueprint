import fc from 'fast-check';
import {
  BedrockClient,
  type BedrockClientConfig,
} from '../bedrockClient';
import type {
  ConversationMessage,
  InferenceParams,
} from '../types';

const conversationArbitrary: fc.Arbitrary<ConversationMessage[]> = fc.array(
  fc.record({
    role: fc.constantFrom('user' as const, 'assistant' as const),
    content: fc.string({ minLength: 1, maxLength: 500 }),
  }),
  { minLength: 1, maxLength: 16 },
);

const inferenceArbitrary: fc.Arbitrary<InferenceParams> = fc.record({
  temperature: fc.double({ min: 0, max: 1, noNaN: true }),
  maxTokens: fc.integer({ min: 1, max: 4096 }),
  topP: fc.double({ min: 0, max: 1, noNaN: true }),
});

describe('Bedrock request mapping', () => {
  test('maps arbitrary conversations and inference controls without mutation', () => {
    fc.assert(
      fc.property(
        conversationArbitrary,
        fc.string({ minLength: 1, maxLength: 1_000 }),
        fc.string({ minLength: 1, maxLength: 120 }),
        inferenceArbitrary,
        (conversation, systemPrompt, modelId, inferenceParams) => {
          const config: BedrockClientConfig = {
            region: 'us-east-1',
            modelId,
            inferenceParams,
          };
          const input = new BedrockClient(config).buildConverseInput(
            conversation,
            systemPrompt,
          );

          expect(input).toMatchObject({
            modelId,
            system: [{ text: systemPrompt }],
            inferenceConfig: inferenceParams,
          });
          expect(input.messages).toEqual(
            conversation.map(({ role, content }) => ({
              role,
              content: [{ text: content }],
            })),
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
