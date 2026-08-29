import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import * as fc from 'fast-check';
import { ChatInterface } from '../ChatInterface';
import type { ConversationMessage } from '../../api';

// Generate plain alphanumeric content that won't be transformed by Markdown rendering.
// Markdown strips whitespace-only content and transforms special characters (#, *, etc.),
// so we use safe characters to test the core property: message count and order.
const safeContentArb = fc
  .array(
    fc.constantFrom('a', 'b', 'c', 'd', 'e', '1', '2', '3', ' '),
    { minLength: 2, maxLength: 80 },
  )
  .map((characters) => characters.join(''))
  .filter((value) => value.trim().length > 0);

const messageArb: fc.Arbitrary<ConversationMessage> = fc.record({
  role: fc.constantFrom('user' as const, 'assistant' as const),
  content: safeContentArb,
});

describe('Property 2: All conversation messages are rendered', () => {
  it('renders exactly one element per message in order', () => {
    fc.assert(
      fc.property(
        fc.array(messageArb, { minLength: 0, maxLength: 50 }),
        (messages) => {
          const { container, unmount } = render(
            <ChatInterface messages={messages} />
          );

          // Query within the container to avoid cross-iteration DOM leakage
          const userEls = container.querySelectorAll('[data-testid="message-user"]');
          const assistantEls = container.querySelectorAll('[data-testid="message-assistant"]');
          const totalRendered = userEls.length + assistantEls.length;

          // Verify total count matches
          expect(totalRendered).toBe(messages.length);

          // Verify order by collecting all message elements in DOM order
          const allMessageEls = container.querySelectorAll('[data-testid^="message-"]');
          // Filter to only user/assistant messages (exclude other data-testid="message-*" if any)
          const messageEls = Array.from(allMessageEls).filter(
            (el) =>
              el.getAttribute('data-testid') === 'message-user' ||
              el.getAttribute('data-testid') === 'message-assistant'
          );
          expect(messageEls.length).toBe(messages.length);

          messages.forEach((msg, i) => {
            expect(messageEls[i].getAttribute('data-testid')).toBe(
              `message-${msg.role}`
            );
            // textContent traverses into MarkdownRenderer children for assistant messages.
            // Markdown rendering may normalize whitespace, so compare trimmed content.
            const renderedText = messageEls[i].textContent || '';
            expect(renderedText).toContain(msg.content.trim());
          });

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
