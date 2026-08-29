import fc from 'fast-check';
import { PromptEngine } from '../promptEngine';
import type { ConversationMessage } from '../types';

const historyArbitrary: fc.Arbitrary<ConversationMessage[]> = fc.array(
  fc.record({
    role: fc.constantFrom('user' as const, 'assistant' as const),
    content: fc.string({ minLength: 1, maxLength: 500 }),
  }),
  { maxLength: 40 },
);

describe('PromptEngine conversation assembly', () => {
  test('returns a new history ending with the current user request', () => {
    fc.assert(
      fc.property(
        historyArbitrary,
        fc.string({ minLength: 1, maxLength: 2_000 }),
        (history, currentRequest) => {
          const originalHistory = structuredClone(history);
          const assembled = new PromptEngine().assembleMessages(
            history,
            currentRequest,
          );

          expect(assembled).toEqual([
            ...originalHistory,
            { role: 'user', content: currentRequest },
          ]);
          expect(assembled).not.toBe(history);
          expect(history).toEqual(originalHistory);
        },
      ),
      { numRuns: 100 },
    );
  });
});
