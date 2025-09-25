import type { UIMessage } from 'ai';

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
  return {
    id: message.id,
    role: message.role,
    parts: [{ type: 'text', text: message.content }],
    ...(message.createdAt && { createdAt: message.createdAt }),
  };
}

/**
 * Convert UIMessage to Message format for @ai-sdk/react
 */
export function convertUIMessageToMessage(message: UIMessage): ReactMessage {
  const textContent = message.parts?.find(part => part.type === 'text')?.text || '';
  return {
    id: message.id,
    role: message.role,
    content: textContent,
    ...(message.createdAt && { createdAt: message.createdAt }),
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