import fc from 'fast-check';
import { SessionManager } from '../sessionManager';
import { ConversationMessage } from '../types';

const messageArb: fc.Arbitrary<ConversationMessage> = fc.record({
  role: fc.constantFrom('user' as const, 'assistant' as const),
  content: fc.string({ minLength: 1 }),
});

/**
 * Property 4: Session clearing removes all messages
 *
 * For any session containing N messages (where N > 0), clearing the session
 * should result in a session with zero messages and a new session ID.
 *
 * **Validates: Requirements 2.5**
 */
describe('SessionManager Property Tests', () => {
  test('Property 4: Session clearing removes all messages', () => {
    fc.assert(
      fc.property(
        fc.array(messageArb, { minLength: 1, maxLength: 50 }),
        (messages) => {
          const manager = new SessionManager();
          const session = manager.createSession();
          const originalId = session.id;

          // Add all messages to the session
          for (const msg of messages) {
            manager.addMessage(session.id, msg);
          }

          // Verify messages were added
          const beforeClear = manager.getSession(originalId);
          expect(beforeClear).toBeDefined();
          expect(beforeClear!.messages).toHaveLength(messages.length);

          // Clear the session
          manager.clearSession(originalId);

          // Verify old session is gone
          expect(manager.getSession(originalId)).toBeUndefined();

          // Create a new session and verify it has zero messages and a new ID
          const newSession = manager.createSession();
          expect(newSession.messages).toHaveLength(0);
          expect(newSession.id).not.toBe(originalId);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('conversation history is bounded to the configured maximum', () => {
    const manager = new SessionManager({ maxMessages: 2 });
    const session = manager.createSession();

    manager.addMessage(session.id, { role: 'user', content: 'one' });
    manager.addMessage(session.id, { role: 'assistant', content: 'two' });
    manager.addMessage(session.id, { role: 'user', content: 'three' });

    expect(manager.getSession(session.id)?.messages).toEqual([
      { role: 'assistant', content: 'two' },
      { role: 'user', content: 'three' },
    ]);
  });

  test('does not reveal or clear a session owned by another principal', () => {
    const manager = new SessionManager();
    const session = manager.createSession('tenant-a');

    expect(manager.getSession(session.id, 'tenant-b')).toBeUndefined();
    manager.clearSession(session.id, 'tenant-b');
    expect(manager.getSession(session.id, 'tenant-a')).toBeDefined();
  });
});
