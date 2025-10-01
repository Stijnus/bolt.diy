import { type Message } from 'ai';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, MODEL_REGEX, PROVIDER_REGEX } from '~/utils/constants';
import { IGNORE_PATTERNS, type FileMap } from './constants';
import ignore from 'ignore';
import type { ContextAnnotation } from '~/types/context';
import { estimateTokenCount, truncateToTokenLimit } from '~/lib/common/prompts/token-optimizer';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('llm-utils');

export function extractPropertiesFromMessage(message: Omit<Message, 'id'>): {
  model: string;
  provider: string;
  content: string;
} {
  const textContent = Array.isArray(message.content)
    ? message.content.find((item) => item.type === 'text')?.text || ''
    : message.content;

  const modelMatch = textContent.match(MODEL_REGEX);
  const providerMatch = textContent.match(PROVIDER_REGEX);

  /*
   * Extract model
   * const modelMatch = message.content.match(MODEL_REGEX);
   */
  const model = modelMatch ? modelMatch[1] : DEFAULT_MODEL;

  /*
   * Extract provider
   * const providerMatch = message.content.match(PROVIDER_REGEX);
   */
  const provider = providerMatch ? providerMatch[1] : DEFAULT_PROVIDER.name;

  const cleanedContent = Array.isArray(message.content)
    ? (message.content.find((item) => item.type === 'text')?.text || '')
        .replace(MODEL_REGEX, '')
        .replace(PROVIDER_REGEX, '')
    : textContent.replace(MODEL_REGEX, '').replace(PROVIDER_REGEX, '');

  return { model, provider, content: cleanedContent };
}

export function simplifyBoltActions(input: string): string {
  // Using regex to match boltAction tags that have type="file"
  const regex = /(<boltAction[^>]*type="file"[^>]*>)([\s\S]*?)(<\/boltAction>)/g;

  // Replace each matching occurrence
  return input.replace(regex, (_0, openingTag, _2, closingTag) => {
    return `${openingTag}\n          ...\n        ${closingTag}`;
  });
}

export function createFilesContext(files: FileMap, useRelativePath?: boolean, maxTokens: number = 20000) {
  const ig = ignore().add(IGNORE_PATTERNS);
  let filePaths = Object.keys(files);
  filePaths = filePaths.filter((x) => {
    const relPath = x.replace('/home/project/', '');
    return !ig.ignores(relPath);
  });

  const fileContexts: string[] = [];
  let currentTokens = 0;
  const overhead = 100; // Tokens for XML wrapper tags
  const maxFileTokens = 5000; // Max tokens per individual file

  logger.info(`Creating file context with budget of ${maxTokens} tokens for ${filePaths.length} files`);

  for (const path of filePaths) {
    const dirent = files[path];

    if (!dirent || dirent.type !== 'file') {
      continue;
    }

    // Check if we've exceeded our token budget
    if (currentTokens >= maxTokens - overhead) {
      logger.warn(`Token budget exceeded after ${fileContexts.length} files (${currentTokens}/${maxTokens} tokens)`);
      break;
    }

    let fileContent = dirent.content;
    const fileTokens = estimateTokenCount(fileContent);

    // Truncate large files
    if (fileTokens > maxFileTokens) {
      logger.debug(`Truncating large file ${path} from ${fileTokens} to ${maxFileTokens} tokens`);
      fileContent = truncateToTokenLimit(fileContent, maxFileTokens);
    }

    let filePath = path;

    if (useRelativePath) {
      filePath = path.replace('/home/project/', '');
    }

    const fileContext = `<boltAction type="file" filePath="${filePath}">${fileContent}</boltAction>`;
    const contextTokens = estimateTokenCount(fileContext);

    // Check if adding this file would exceed budget
    if (currentTokens + contextTokens > maxTokens - overhead) {
      logger.warn(
        `Skipping file ${path} (${contextTokens} tokens) - would exceed budget (${currentTokens + contextTokens}/${maxTokens})`,
      );
      break;
    }

    fileContexts.push(fileContext);
    currentTokens += contextTokens;
  }

  logger.info(`Created context with ${fileContexts.length} files using ${currentTokens} tokens`);

  return `<boltArtifact id="code-content" title="Code Content" >\n${fileContexts.join('\n')}\n</boltArtifact>`;
}

export function extractCurrentContext(messages: Message[]) {
  const lastAssistantMessage = messages.filter((x) => x.role == 'assistant').slice(-1)[0];

  if (!lastAssistantMessage) {
    return { summary: undefined, codeContext: undefined };
  }

  let summary: ContextAnnotation | undefined;
  let codeContext: ContextAnnotation | undefined;

  if (!lastAssistantMessage.annotations?.length) {
    return { summary: undefined, codeContext: undefined };
  }

  for (let i = 0; i < lastAssistantMessage.annotations.length; i++) {
    const annotation = lastAssistantMessage.annotations[i];

    if (!annotation || typeof annotation !== 'object') {
      continue;
    }

    if (!(annotation as any).type) {
      continue;
    }

    const annotationObject = annotation as any;

    if (annotationObject.type === 'codeContext') {
      codeContext = annotationObject;
      break;
    } else if (annotationObject.type === 'chatSummary') {
      summary = annotationObject;
      break;
    }
  }

  return { summary, codeContext };
}
