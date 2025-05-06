import { type FileMap } from './constants';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('content-optimizer');

// Token estimation constants
const AVERAGE_TOKENS_PER_CHAR = 0.25; // Rough estimate: 4 characters per token on average
const MAX_TOKENS_PER_FILE = 2000; // Default max tokens per file

// File type definitions for specialized handling
type FileType =
  | 'javascript'
  | 'typescript'
  | 'jsx'
  | 'tsx'
  | 'html'
  | 'css'
  | 'json'
  | 'markdown'
  | 'python'
  | 'unknown';

interface OptimizationOptions {
  maxTokensPerFile?: number;
  preserveImports?: boolean;
  preserveExports?: boolean;
  preserveClassDefinitions?: boolean;
  preserveFunctionDefinitions?: boolean;
  preserveComments?: boolean;
  tokenBudget?: number;
  relevanceThreshold?: number;
}

const defaultOptions: OptimizationOptions = {
  maxTokensPerFile: MAX_TOKENS_PER_FILE,
  preserveImports: true,
  preserveExports: true,
  preserveClassDefinitions: true,
  preserveFunctionDefinitions: true,
  preserveComments: true,
  tokenBudget: 6000, // Total token budget for all files
  relevanceThreshold: 0.5, // Minimum relevance score to include a section
};

/**
 * Detect file type based on file path
 */
function detectFileType(filePath: string): FileType {
  const extension = filePath.split('.').pop()?.toLowerCase() || '';

  switch (extension) {
    case 'js':
      return 'javascript';
    case 'ts':
      return 'typescript';
    case 'jsx':
      return 'jsx';
    case 'tsx':
      return 'tsx';
    case 'html':
    case 'htm':
      return 'html';
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return 'css';
    case 'json':
      return 'json';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'py':
      return 'python';
    default:
      return 'unknown';
  }
}

/**
 * Estimate token count for a string
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length * AVERAGE_TOKENS_PER_CHAR);
}

/**
 * Extract imports from JavaScript/TypeScript files
 */
function extractImports(content: string): string {
  const importRegex = /^import\s+.*?;?\s*$/gm;
  const imports = content.match(importRegex) || [];

  return imports.join('\n');
}

/**
 * Extract exports from JavaScript/TypeScript files
 */
function extractExports(content: string): string {
  const exportRegex = /^export\s+.*?;?\s*$/gm;
  const exports = content.match(exportRegex) || [];

  return exports.join('\n');
}

/**
 * Extract class definitions from code
 */
function extractClassDefinitions(content: string): string[] {
  const classRegex =
    /^(export\s+)?(abstract\s+)?(class\s+\w+\s*(?:extends\s+\w+)?\s*(?:implements\s+\w+)?\s*\{[\s\S]*?\n\})/gm;
  return (content.match(classRegex) || []).map((match) => match.trim());
}

/**
 * Extract function definitions from code
 */
function extractFunctionDefinitions(content: string): string[] {
  // This regex is simplified and may not catch all function patterns
  const functionRegex =
    /^(export\s+)?(async\s+)?(function\*?\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\n\}|const\s+\w+\s*=\s*(\([^)]*\)|async\s*\([^)]*\))\s*=>\s*\{[\s\S]*?\n\})/gm;
  return (content.match(functionRegex) || []).map((match) => match.trim());
}

/**
 * Extract interface and type definitions from TypeScript files
 */
function extractTypeDefinitions(content: string): string[] {
  const typeRegex = /^(export\s+)?(interface|type)\s+\w+(\s*<[^>]*>)?\s*(\{[\s\S]*?\n\}|=[\s\S]*?;)/gm;
  return (content.match(typeRegex) || []).map((match) => match.trim());
}

/**
 * Optimize file content based on file type and options
 */
function optimizeFileContent(
  filePath: string,
  content: string,
  options: OptimizationOptions = defaultOptions,
  query?: string,
): string {
  const fileType = detectFileType(filePath);
  const maxTokens = options.maxTokensPerFile || MAX_TOKENS_PER_FILE;

  // If content is already under token limit, return as is
  if (estimateTokenCount(content) <= maxTokens) {
    return content;
  }

  // Start with an empty result
  let result = '';

  // Add file type specific optimizations
  switch (fileType) {
    case 'javascript':
    case 'typescript':
    case 'jsx':
    case 'tsx': {
      // Preserve imports if specified
      if (options.preserveImports) {
        const imports = extractImports(content);
        result += imports + '\n\n';
      }

      // Extract important code structures
      const classes = options.preserveClassDefinitions ? extractClassDefinitions(content) : [];
      const functions = options.preserveFunctionDefinitions ? extractFunctionDefinitions(content) : [];
      const types = fileType === 'typescript' || fileType === 'tsx' ? extractTypeDefinitions(content) : [];

      // Combine all extracted elements
      const extractedElements = [...classes, ...functions, ...types];

      // If we have a query, try to prioritize elements that might be related
      if (query) {
        extractedElements.sort((a, b) => {
          const aRelevance = query
            .toLowerCase()
            .split(' ')
            .filter((term) => term.length > 3)
            .reduce((score, term) => score + (a.toLowerCase().includes(term) ? 1 : 0), 0);

          const bRelevance = query
            .toLowerCase()
            .split(' ')
            .filter((term) => term.length > 3)
            .reduce((score, term) => score + (b.toLowerCase().includes(term) ? 1 : 0), 0);

          return bRelevance - aRelevance;
        });
      }

      // Add elements until we reach token limit
      let currentTokens = estimateTokenCount(result);

      for (const element of extractedElements) {
        const elementTokens = estimateTokenCount(element);

        if (currentTokens + elementTokens <= maxTokens) {
          result += element + '\n\n';
          currentTokens += elementTokens;
        } else {
          // If element is too large, add a placeholder
          result += `// Content truncated: ${element.split('\n')[0]}...\n\n`;
        }
      }

      // Preserve exports if specified
      if (options.preserveExports) {
        const exports = extractExports(content);
        const exportTokens = estimateTokenCount(exports);

        if (currentTokens + exportTokens <= maxTokens) {
          result += exports;
        }
      }

      break;
    }

    case 'json': {
      try {
        // For JSON files, parse and include only top-level structure
        const jsonObj = JSON.parse(content);
        const topLevel = Object.keys(jsonObj).reduce(
          (obj, key) => {
            const value = jsonObj[key];

            if (Array.isArray(value) && value.length > 3) {
              obj[key] = [...value.slice(0, 2), '... (truncated)'];
            } else if (typeof value === 'object' && value !== null) {
              obj[key] = '{...}';
            } else {
              obj[key] = value;
            }

            return obj;
          },
          {} as Record<string, any>,
        );

        result = JSON.stringify(topLevel, null, 2);
      } catch (e) {
        logger.error(`Failed to parse JSON file ${filePath}`, e);
        result = content.substring(0, Math.floor(maxTokens / AVERAGE_TOKENS_PER_CHAR));
      }
      break;
    }

    case 'html': {
      /*
       * For HTML, keep the structure but truncate content
       * This is a simplified approach
       */
      result = content
        .replace(/>([^<]{100,})</g, '>...<') // Truncate long text content
        .replace(/<!--[\s\S]*?-->/g, '<!-- Comments removed -->'); // Remove comments

      if (estimateTokenCount(result) > maxTokens) {
        // If still too large, keep only the head and beginning of body
        const headMatch = content.match(/<head>[\s\S]*?<\/head>/i);
        const bodyStartMatch = content.match(/<body[^>]*>([\s\S]{0,1000})/i);

        result = '<!DOCTYPE html>\n<html>\n';

        if (headMatch) {
          result += headMatch[0] + '\n';
        }

        result += '<body>\n';

        if (bodyStartMatch) {
          result += bodyStartMatch[1] + '\n...\n';
        }

        result += '</body>\n</html>';
      }

      break;
    }

    default: {
      // For other file types, simple truncation with a note
      const charLimit = Math.floor(maxTokens / AVERAGE_TOKENS_PER_CHAR);
      result = content.substring(0, charLimit) + '\n\n// Content truncated due to size limitations';
      break;
    }
  }

  return result;
}

/**
 * Optimize a collection of files based on token budget and relevance
 */
export function optimizeFilesContent(
  files: FileMap,
  options: OptimizationOptions = defaultOptions,
  query?: string,
): FileMap {
  const optimizedFiles: FileMap = {};
  const tokenBudget = options.tokenBudget || 6000;
  let usedTokens = 0;

  // First pass: calculate token counts and relevance scores
  const fileMetrics = Object.entries(files)
    .filter(([_, dirent]) => dirent && dirent.type === 'file')
    .map(([path, dirent]) => {
      const content = (dirent as any).content || '';
      const tokenCount = estimateTokenCount(content);

      // Calculate relevance score if query is provided
      let relevanceScore = 1.0;

      if (query) {
        relevanceScore = query
          .toLowerCase()
          .split(' ')
          .filter((term) => term.length > 3)
          .reduce((score, term) => {
            return score + (content.toLowerCase().includes(term) ? 0.2 : 0);
          }, 0.5);
      }

      return {
        path,
        dirent,
        tokenCount,
        relevanceScore,
      };
    });

  // Sort by relevance score (descending)
  fileMetrics.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Second pass: optimize and include files until budget is reached
  for (const { path, dirent, tokenCount } of fileMetrics) {
    if (dirent && dirent.type === 'file') {
      const content = (dirent as any).content || '';

      // If this file would exceed our budget, optimize it
      if (usedTokens + tokenCount > tokenBudget) {
        // Calculate remaining tokens
        const remainingTokens = Math.max(0, tokenBudget - usedTokens);

        if (remainingTokens > 200) {
          // Only include if we have meaningful space left
          const fileOptions = {
            ...options,
            maxTokensPerFile: remainingTokens,
          };

          const optimizedContent = optimizeFileContent(path, content, fileOptions, query);
          const optimizedTokenCount = estimateTokenCount(optimizedContent);

          optimizedFiles[path] = {
            ...dirent,
            content: optimizedContent,
          };

          usedTokens += optimizedTokenCount;
        }

        // Stop once we've used our budget
        if (usedTokens >= tokenBudget) {
          break;
        }
      } else {
        // Include the full file if it fits in the budget
        optimizedFiles[path] = dirent;
        usedTokens += tokenCount;
      }
    }
  }

  logger.info(`Optimized files: ${Object.keys(optimizedFiles).length}, Total tokens: ${usedTokens}/${tokenBudget}`);

  return optimizedFiles;
}
