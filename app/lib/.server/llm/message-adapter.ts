import { type Messages } from './stream-text';

// Define a Message type based on the Messages array type
type Message = Messages extends Array<infer T> ? T : never;
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('message-adapter');

/**
 * Message format expected by the AI SDK v4.3+
 */
export interface CoreMessage {
  role: 'user' | 'assistant' | 'system' | 'function' | 'tool' | 'data';
  content: string | Array<{ type: string; [key: string]: any }>;
  id?: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

/**
 * Ensures that a message object has all required properties for the AI SDK
 */
export function validateMessage(message: any): boolean {
  if (!message) {
    return false;
  }

  // Check for required properties
  if (!message.role || typeof message.role !== 'string') {
    logger.warn('Message missing valid role property');
    return false;
  }

  // Check if role is one of the allowed values
  const validRoles = ['user', 'assistant', 'system', 'function', 'tool', 'data'];

  if (!validRoles.includes(message.role)) {
    logger.warn(`Invalid role: ${message.role}. Must be one of: ${validRoles.join(', ')}`);
    return false;
  }

  // Check for content property
  if (message.content === undefined) {
    logger.warn('Message missing content property');
    return false;
  }

  // If content is an array, validate each item
  if (Array.isArray(message.content)) {
    for (const item of message.content) {
      if (!item.type || typeof item.type !== 'string') {
        logger.warn('Content array item missing valid type property');
        return false;
      }
    }
  }

  return true;
}

/**
 * Adapts a message to ensure it's compatible with the AI SDK
 */
export function adaptMessage(message: any): CoreMessage {
  if (!message) {
    logger.error('Cannot adapt null or undefined message');
    throw new Error('Cannot adapt null or undefined message');
  }

  // Create a base message with required properties
  const adaptedMessage: CoreMessage = {
    role: message.role || 'user',
    content: message.content || '',
  };

  // Ensure role is one of the allowed values
  const validRoles = ['user', 'assistant', 'system', 'function', 'tool', 'data'];

  if (!validRoles.includes(adaptedMessage.role)) {
    logger.warn(`Converting invalid role: ${adaptedMessage.role} to 'user'`);
    adaptedMessage.role = 'user';
  }

  // Copy optional properties if they exist
  if (message.id) {
    adaptedMessage.id = message.id;
  }

  if (message.name) {
    adaptedMessage.name = message.name;
  }

  if (message.tool_call_id) {
    adaptedMessage.tool_call_id = message.tool_call_id;
  }

  if (message.tool_calls) {
    adaptedMessage.tool_calls = message.tool_calls;
  }

  return adaptedMessage;
}

/**
 * Converts an array of messages to the format expected by the AI SDK
 */
export function adaptMessages(messages: Message[]): CoreMessage[] {
  if (!Array.isArray(messages)) {
    logger.error('Messages must be an array');
    throw new Error('Messages must be an array');
  }

  return messages.map((message) => {
    try {
      return adaptMessage(message);
    } catch (error) {
      logger.error('Error adapting message:', error);

      // Return a fallback message if adaptation fails
      return {
        role: 'user',
        content: typeof message.content === 'string' ? message.content : 'Error processing message',
      };
    }
  });
}
