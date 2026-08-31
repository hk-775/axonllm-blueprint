import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import type {
  ChatResponseData,
  ConversationMessage,
} from '../api';
import { MarkdownRenderer } from './MarkdownRenderer';

export interface ChatInterfaceProps {
  messages?: ConversationMessage[];
  loading?: boolean;
  error?: string | null;
  sessionId?: string | null;
  lastRun?: ChatResponseData | null;
  draftPrompt?: string;
  draftPromptVersion?: number;
  maxMessageChars?: number;
  onSend?: (text: string) => void | Promise<void>;
  onNewSession?: () => void | Promise<void>;
  onRetry?: () => void | Promise<void>;
}

const INTENT_LABELS: Record<ChatResponseData['intent'], string> = {
  'iac-generation': 'IaC generation',
  'config-analysis': 'Configuration review',
  troubleshooting: 'Troubleshooting',
  general: 'Architecture guidance',
};

export function ChatInterface({
  messages = [],
  loading = false,
  error = null,
  sessionId = null,
  lastRun = null,
  draftPrompt = '',
  draftPromptVersion = 0,
  maxMessageChars = 50_000,
  onSend,
  onNewSession,
  onRetry,
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (draftPrompt) {
      setInput(draftPrompt);
    }
  }, [draftPrompt, draftPromptVersion]);

  useEffect(() => {
    if (
      messagesEndRef.current &&
      typeof messagesEndRef.current.scrollIntoView === 'function'
    ) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  const submit = (): void => {
    const text = input.trim();
    if (!text || loading || text.length > maxMessageChars) {
      return;
    }
    setInput('');
    void onSend?.(text);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    submit();
  };

  const handleComposerKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>,
  ): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <section className="conversation" aria-label="Blueprint conversation">
      <header className="conversation__header">
        <div>
          <div className="eyebrow">Design session</div>
          <h1>Infrastructure workbench</h1>
        </div>
        <div className="conversation__actions">
          <span className="session-chip" title={sessionId ?? 'Created on first request'}>
            <span className="session-chip__dot" />
            {sessionId ? 'Session active' : 'Ready'}
          </span>
          <button
            className="button button--quiet"
            type="button"
            onClick={() => void onNewSession?.()}
            disabled={loading}
            aria-label="New Session"
          >
            New session
          </button>
        </div>
      </header>

      <div
        className="conversation__log"
        role="log"
        aria-label="Conversation"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <div className="welcome">
            <div className="welcome__signal">
              <span />
              <span />
              <span />
            </div>
            <p className="eyebrow">Blueprint is listening</p>
            <h2>Turn an infrastructure brief into a reviewable plan.</h2>
            <p>
              Design an architecture, generate IaC, inspect a configuration,
              or work through an operational failure. Outputs stay advisory
              until you review and deploy them.
            </p>
            <div className="welcome__capabilities" aria-label="Capabilities">
              <span>Architecture</span>
              <span>CloudFormation</span>
              <span>Terraform</span>
              <span>CDK</span>
              <span>Review</span>
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <article
            key={`${message.role}-${index}`}
            className={`message message--${message.role}`}
            data-testid={`message-${message.role}`}
          >
            <div className="message__identity" aria-hidden="true">
              {message.role === 'user' ? 'YO' : 'AX'}
            </div>
            <div className="message__body">
              <div className="message__label">
                {message.role === 'user' ? 'You' : 'Blueprint'}
              </div>
              {message.role === 'assistant' ? (
                <MarkdownRenderer content={message.content} />
              ) : (
                <p className="message__plain">{message.content}</p>
              )}
            </div>
          </article>
        ))}

        {loading && (
          <div
            className="message message--assistant"
            data-testid="loading-indicator"
            aria-label="Blueprint is reasoning"
          >
            <div className="message__identity" aria-hidden="true">
              AX
            </div>
            <div className="message__body">
              <div className="message__label">Blueprint</div>
              <div className="reasoning">
                <span />
                <span />
                <span />
                <p>Tracing constraints and building a response</p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="request-error" data-testid="error-message" role="alert">
            <div>
              <strong>Request did not complete</strong>
              <p>{error}</p>
            </div>
            <button
              className="button button--danger"
              type="button"
              onClick={() => void onRetry?.()}
              disabled={loading}
              aria-label="Retry"
            >
              Retry
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <footer className="composer-shell">
        {lastRun && (
          <div className="run-strip" aria-label="Last model run">
            <span>{INTENT_LABELS[lastRun.intent]}</span>
            {lastRun.synthetic ? (
              <>
                <span>Synthetic preview</span>
                <span>Browser local</span>
                <span>No model call</span>
              </>
            ) : (
              <>
                <span>{lastRun.usage.inputTokens.toLocaleString()} input</span>
                <span>{lastRun.usage.outputTokens.toLocaleString()} output</span>
                <span>{lastRun.stopReason.replaceAll('_', ' ')}</span>
              </>
            )}
          </div>
        )}
        <form className="composer" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="blueprint-message">
            Infrastructure request
          </label>
          <textarea
            id="blueprint-message"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Describe the system, constraint, configuration, or failure..."
            rows={3}
            maxLength={maxMessageChars + 1}
            aria-label="Message input"
          />
          <div className="composer__footer">
            <span>
              Enter to send <i>·</i> Shift + Enter for a new line
            </span>
            <div className="composer__submit">
              {input.length > maxMessageChars && (
                <span className="composer__limit">Request is too long</span>
              )}
              <button
                className="button button--primary"
                type="submit"
                disabled={
                  loading ||
                  input.trim().length === 0 ||
                  input.length > maxMessageChars
                }
                aria-label="Send message"
              >
                Run blueprint
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M3 10h13M11 5l5 5-5 5" />
                </svg>
              </button>
            </div>
          </div>
        </form>
        <p className="advisory">
          Review generated infrastructure and run native validation before
          deployment.
        </p>
      </footer>
    </section>
  );
}

export default ChatInterface;
