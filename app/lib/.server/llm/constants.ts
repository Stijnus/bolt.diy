/*
 * DEPRECATED: This fallback should only be used when dynamic capability detection fails
 * The ModelCapabilityService should be used instead for accurate, real-time limits
 */
export const MAX_TOKENS_FALLBACK = 8192; // Conservative fallback for safety

/*
 * DEPRECATED: Provider-specific limits are now handled by ModelCapabilityService
 * These are kept as emergency fallbacks only
 */
export const PROVIDER_COMPLETION_LIMITS: Record<string, number> = {
  OpenAI: 4096,
  Github: 4096,
  Anthropic: 4096, // Conservative fallback - actual limits vary by model
  Google: 8192,
  Cohere: 4000,
  DeepSeek: 8192,
  Groq: 8192,
  HuggingFace: 4096,
  Mistral: 8192,
  Ollama: 8192,
  OpenRouter: 8192,
  Perplexity: 8192,
  Together: 8192,
  xAI: 8192,
  LMStudio: 8192,
  OpenAILike: 8192,
  AmazonBedrock: 8192,
  Hyperbolic: 8192,
};

/*
 * Reasoning models that require maxCompletionTokens instead of maxTokens
 * These models use internal reasoning tokens and have different API parameter requirements
 */
export function isReasoningModel(modelName: string): boolean {
  const result = /^(o1|o3|gpt-5)/i.test(modelName);

  // DEBUG: Test regex matching
  console.log(`REGEX TEST: "${modelName}" matches reasoning pattern: ${result}`);

  return result;
}

// limits the number of model responses that can be returned in a single request
export const MAX_RESPONSE_SEGMENTS = 2;

export interface File {
  type: 'file';
  content: string;
  isBinary: boolean;
  isLocked?: boolean;
  lockedByFolder?: string;
}

export interface Folder {
  type: 'folder';
  isLocked?: boolean;
  lockedByFolder?: string;
}

type Dirent = File | Folder;

export type FileMap = Record<string, Dirent | undefined>;

export const IGNORE_PATTERNS = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'build/**',
  '.next/**',
  'coverage/**',
  '.cache/**',
  '.vscode/**',
  '.idea/**',
  '**/*.log',
  '**/.DS_Store',
  '**/npm-debug.log*',
  '**/yarn-debug.log*',
  '**/yarn-error.log*',
  '**/*lock.json',
  '**/*lock.yml',
];
