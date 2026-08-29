import { randomUUID } from 'node:crypto';
import {
  DEFAULT_BEDROCK_MODEL_ID,
  DEFAULT_CONFIG,
  REQUEST_LIMITS,
} from './constants';
import type {
  ConversationMessage,
  InferenceParams,
  Session,
} from './types';

export interface SessionManagerOptions {
  defaultConfig: InferenceParams;
  defaultModelId: string;
  maxMessages: number;
  maxSessions: number;
  sessionTtlMs: number;
}

const DEFAULT_OPTIONS: SessionManagerOptions = {
  defaultConfig: DEFAULT_CONFIG,
  defaultModelId: DEFAULT_BEDROCK_MODEL_ID,
  maxMessages: REQUEST_LIMITS.maxSessionMessages,
  maxSessions: REQUEST_LIMITS.maxSessions,
  sessionTtlMs: REQUEST_LIMITS.sessionTtlMs,
};

export class SessionManager {
  private readonly sessions = new Map<string, Session>();
  private readonly options: SessionManagerOptions;

  constructor(options: Partial<SessionManagerOptions> = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      defaultConfig: {
        ...DEFAULT_OPTIONS.defaultConfig,
        ...options.defaultConfig,
      },
    };
  }

  createSession(ownerId = 'anonymous'): Session {
    this.pruneExpired();
    this.evictOldestIfFull();

    const now = new Date();
    const session: Session = {
      id: randomUUID(),
      ownerId,
      messages: [],
      config: { ...this.options.defaultConfig },
      modelId: this.options.defaultModelId,
      createdAt: now,
      lastAccessedAt: now,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  getSession(
    sessionId: string,
    ownerId = 'anonymous',
  ): Session | undefined {
    this.pruneExpired();
    const session = this.sessions.get(sessionId);
    if (session?.ownerId === ownerId) {
      session.lastAccessedAt = new Date();
      return session;
    }
    return undefined;
  }

  addMessage(sessionId: string, message: ConversationMessage): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.messages.push({ ...message });
    if (session.messages.length > this.options.maxMessages) {
      session.messages.splice(
        0,
        session.messages.length - this.options.maxMessages,
      );
    }
    session.lastAccessedAt = new Date();
  }

  updateSettings(
    sessionId: string,
    config: InferenceParams,
    modelId: string,
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.config = { ...config };
    session.modelId = modelId;
    session.lastAccessedAt = new Date();
  }

  clearSession(sessionId: string, ownerId = 'anonymous'): void {
    const session = this.sessions.get(sessionId);
    if (session?.ownerId === ownerId) {
      this.sessions.delete(sessionId);
    }
  }

  get size(): number {
    this.pruneExpired();
    return this.sessions.size;
  }

  private pruneExpired(): void {
    const cutoff = Date.now() - this.options.sessionTtlMs;
    for (const [sessionId, session] of this.sessions) {
      if (session.lastAccessedAt.getTime() < cutoff) {
        this.sessions.delete(sessionId);
      }
    }
  }

  private evictOldestIfFull(): void {
    if (this.sessions.size < this.options.maxSessions) {
      return;
    }

    let oldest: Session | undefined;
    for (const session of this.sessions.values()) {
      if (!oldest || session.lastAccessedAt < oldest.lastAccessedAt) {
        oldest = session;
      }
    }

    if (oldest) {
      this.sessions.delete(oldest.id);
    }
  }
}
