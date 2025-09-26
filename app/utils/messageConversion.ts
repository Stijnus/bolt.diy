import type { JSONValue, UIMessage } from 'ai';

export type MessageLike = UIMessage | (Omit<UIMessage, 'id'> & { id?: string });

// Type for the Message from @ai-sdk/react (useChat hook)
interface ReactMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: Date;
  timestamp?: Date;
  [key: string]: unknown;
}

/**
 * Convert Message from @ai-sdk/react to UIMessage
 */
export function convertMessageToUIMessage(message: ReactMessage): UIMessage {
  const createdAt = 'createdAt' in message ? (message.createdAt as Date | undefined) : undefined;
  const metadata: Record<string, unknown> = {};

  if (createdAt) {
    metadata.createdAt = createdAt;
  }

  return {
    id: message.id,
    role: message.role,
    parts: [{ type: 'text', text: message.content }],
    ...(Object.keys(metadata).length ? { metadata } : {}),
  };
}

/**
 * Convert UIMessage to Message format for @ai-sdk/react
 */
export function convertUIMessageToMessage(message: UIMessage): ReactMessage {
  const textContent = message.parts?.find((part) => part.type === 'text')?.text || '';

  const createdAt =
    typeof message.metadata === 'object' && message.metadata && 'createdAt' in (message.metadata as any)
      ? ((message.metadata as { createdAt?: Date }).createdAt ?? undefined)
      : undefined;

  return {
    id: message.id,
    role: message.role,
    content: textContent,
    ...(createdAt ? { createdAt } : {}),
  };
}

/**
 * Convert array of Messages to UIMessages
 */
export function convertMessagesToUIMessages(messages: ReactMessage[]): UIMessage[] {
  return messages.map(convertMessageToUIMessage);
}

/**
 * Convert array of UIMessages to Messages
 */
export function convertUIMessagesToMessages(messages: UIMessage[]): ReactMessage[] {
  return messages.map(convertUIMessageToMessage);
}

export function getTextFromUIMessage(message: MessageLike): string {
  if (!message.parts?.length) {
    return '';
  }

  return message.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('\n\n');
}

export function getAnnotationsFromUIMessage(message: MessageLike): JSONValue[] {
  if (!message.metadata || typeof message.metadata !== 'object') {
    return [];
  }

  const annotations = (message.metadata as { annotations?: JSONValue[] }).annotations;

  return Array.isArray(annotations) ? annotations : [];
}
