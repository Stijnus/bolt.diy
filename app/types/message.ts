import type { Message as AIMessage } from 'ai';

export interface ExtendedMessage extends AIMessage {
  reasoning?: string;
  sources?: Array<{ url: string; title?: string }>;
}
