import { useCallback, useState } from 'react';
import {
  ApiError,
  createSession,
  deleteSession,
  postChat,
  type ChatResponseData,
  type ConversationMessage,
  type InferenceParams,
} from '../api';

export interface ChatSettings {
  modelId: string;
  config: InferenceParams;
}

export interface UseChatReturn {
  messages: ConversationMessage[];
  sessionId: string | null;
  loading: boolean;
  error: string | null;
  lastRun: ChatResponseData | null;
  sendMessage: (text: string) => Promise<void>;
  retryLast: () => Promise<void>;
  newSession: () => Promise<void>;
  clearError: () => void;
}

export function useChat(settings: ChatSettings): UseChatReturn {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(
    null,
  );
  const [lastRun, setLastRun] = useState<ChatResponseData | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const runMessage = useCallback(
    async (text: string, appendUserMessage: boolean) => {
      if (!settings.modelId) {
        setError('No Bedrock model is configured.');
        return;
      }

      setError(null);
      setLoading(true);

      try {
        let activeSessionId = sessionId;
        if (!activeSessionId) {
          const session = await createSession();
          activeSessionId = session.sessionId;
          setSessionId(activeSessionId);
        }

        if (appendUserMessage) {
          setMessages((current) => [
            ...current,
            { role: 'user', content: text },
          ]);
        }

        const result = await postChat(
          activeSessionId,
          text,
          settings.config,
          settings.modelId,
        );

        setMessages((current) => [
          ...current,
          { role: 'assistant', content: result.response },
        ]);
        setLastRun(result);
        setLastFailedMessage(null);
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : 'An unexpected request error occurred.';
        const suffix =
          caught instanceof ApiError && caught.requestId
            ? ` Request ID: ${caught.requestId}`
            : '';
        setError(`${message}${suffix}`);
        setLastFailedMessage(text);
      } finally {
        setLoading(false);
      }
    },
    [sessionId, settings],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      await runMessage(text, true);
    },
    [runMessage],
  );

  const retryLast = useCallback(async () => {
    if (lastFailedMessage) {
      await runMessage(lastFailedMessage, false);
    }
  }, [lastFailedMessage, runMessage]);

  const newSession = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      if (sessionId) {
        await deleteSession(sessionId).catch(() => undefined);
      }
      const session = await createSession();
      setSessionId(session.sessionId);
      setMessages([]);
      setLastRun(null);
      setLastFailedMessage(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Failed to create a new session.',
      );
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  return {
    messages,
    sessionId,
    loading,
    error,
    lastRun,
    sendMessage,
    retryLast,
    newSession,
    clearError,
  };
}
