import { createScopedLogger } from '~/utils/logger';
import type { FileMap } from './constants';
import { getCache } from './cache';

const logger = createScopedLogger('file-index');

/**
 * File metadata extracted for semantic indexing
 */
interface FileMetadata {
  path: string;
  keywords: string[]; // Extracted from filename, imports, exports
  imports: string[]; // Import statements
  exports: string[]; // Export statements
  score: number; // Relevance score
}

/**
 * Semantic file index for intelligent file selection
 */
export class SemanticFileIndex {
  private _index: Map<string, FileMetadata>;
  private _cache = getCache();

  constructor() {
    this._index = new Map();
  }

  /**
   * Build index from file map
   */
  buildIndex(files: FileMap): void {
    const startTime = Date.now();
    let indexed = 0;

    for (const [path, dirent] of Object.entries(files)) {
      if (!dirent || dirent.type !== 'file') {
        continue;
      }

      const metadata = this._extractMetadata(path, dirent.content);
      this._index.set(path, metadata);
      indexed++;
    }

    const elapsed = Date.now() - startTime;
    logger.info(`Built semantic index for ${indexed} files in ${elapsed}ms`);
  }

  /**
   * Score files by relevance to a query
   */
  scoreFiles(query: string, recentlyChanged: string[] = []): Array<{ path: string; score: number }> {
    const queryTerms = this._extractTerms(query.toLowerCase());
    const scored: Array<{ path: string; score: number }> = [];

    for (const [path, metadata] of this._index.entries()) {
      let score = 0;

      // 1. Keyword matching (40% weight)
      for (const term of queryTerms) {
        for (const keyword of metadata.keywords) {
          if (keyword.includes(term) || term.includes(keyword)) {
            score += 10; // Exact/partial match
          }
        }
      }

      // 2. Import/Export matching (30% weight)
      const allSymbols = [...metadata.imports, ...metadata.exports];

      for (const term of queryTerms) {
        for (const symbol of allSymbols) {
          if (symbol.toLowerCase().includes(term)) {
            score += 15; // Symbol match (high value)
          }
        }
      }

      // 3. Recently changed files (25% weight)
      if (recentlyChanged.includes(path)) {
        score += 25; // Recently modified
      }

      // 4. File type bonus (5% weight)
      if (path.endsWith('.ts') || path.endsWith('.tsx')) {
        score += 2;
      }

      if (path.endsWith('.js') || path.endsWith('.jsx')) {
        score += 2;
      }

      if (score > 0) {
        scored.push({ path, score });
      }
    }

    return scored.sort((a, b) => b.score - a.score);
  }

  /**
   * Get top N most relevant files
   */
  getTopFiles(query: string, topN: number = 15, recentlyChanged: string[] = []): string[] {
    const scored = this.scoreFiles(query, recentlyChanged);

    return scored.slice(0, topN).map((item) => item.path);
  }

  /**
   * Extract metadata from file
   */
  private _extractMetadata(path: string, content: string): FileMetadata {
    const keywords = this._extractKeywords(path);
    const imports = this._extractImports(content);
    const exports = this._extractExports(content);

    return {
      path,
      keywords,
      imports,
      exports,
      score: 0,
    };
  }

  /**
   * Extract keywords from file path
   */
  private _extractKeywords(path: string): string[] {
    const keywords: string[] = [];

    // Extract from filename
    const filename = path.split('/').pop() || '';
    const nameWithoutExt = filename.replace(/\.(ts|tsx|js|jsx|vue|svelte|py|go|rs|java|cpp|c)$/, '');

    // Split by common delimiters
    const parts = nameWithoutExt.split(/[-_.]/).filter((p) => p.length > 2);

    keywords.push(...parts);

    // Extract from path segments
    const segments = path.split('/').filter((s) => s.length > 2 && s !== 'home' && s !== 'project');

    keywords.push(...segments);

    return keywords.map((k) => k.toLowerCase());
  }

  /**
   * Extract import statements
   *
   * Matches various import patterns:
   * - import { foo, bar } from '...'
   * - import foo from '...'
   * - import * as foo from '...'
   * - const foo = require('...')
   */
  private _extractImports(content: string): string[] {
    const imports: string[] = [];

    /*
     * Match: import { foo, bar } from '...'
     * Match: import foo from '...'
     * Match: import * as foo from '...'
     */
    const importRegex = /import\s+(?:{([^}]+)}|(\w+)|\*\s+as\s+(\w+))\s+from\s+['"]([^'"]+)['"]/g;

    let match;

    while ((match = importRegex.exec(content)) !== null) {
      if (match[1]) {
        // Named imports: { foo, bar }
        const named = match[1]
          .split(',')
          .map((s) => s.trim().split(/\s+as\s+/)[0])
          .filter((s) => s.length > 0);
        imports.push(...named);
      } else if (match[2]) {
        // Default import
        imports.push(match[2]);
      } else if (match[3]) {
        // Namespace import
        imports.push(match[3]);
      }
    }

    // Match: const foo = require('...')
    const requireRegex = /(?:const|let|var)\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\)/g;

    while ((match = requireRegex.exec(content)) !== null) {
      if (match[1]) {
        imports.push(match[1]);
      }
    }

    return imports;
  }

  /**
   * Extract export statements
   *
   * Matches various export patterns:
   * - export function foo
   * - export class Foo
   * - export const foo
   * - export { foo, bar }
   * - export default Foo
   */
  private _extractExports(content: string): string[] {
    const exports: string[] = [];

    /*
     * Match: export function foo
     * Match: export class Foo
     * Match: export const foo
     */
    const exportRegex = /export\s+(?:function|class|const|let|var|async\s+function)\s+(\w+)/g;

    let match;

    while ((match = exportRegex.exec(content)) !== null) {
      if (match[1]) {
        exports.push(match[1]);
      }
    }

    // Match: export { foo, bar }
    const namedExportRegex = /export\s+{([^}]+)}/g;

    while ((match = namedExportRegex.exec(content)) !== null) {
      if (match[1]) {
        const named = match[1]
          .split(',')
          .map((s) => s.trim().split(/\s+as\s+/)[0])
          .filter((s) => s.length > 0);
        exports.push(...named);
      }
    }

    // Match: export default Foo
    const defaultExportRegex = /export\s+default\s+(?:function\s+)?(\w+)/g;

    while ((match = defaultExportRegex.exec(content)) !== null) {
      if (match[1] && match[1] !== 'function') {
        exports.push(match[1]);
      }
    }

    return exports;
  }

  /**
   * Extract search terms from query
   */
  private _extractTerms(query: string): string[] {
    // Remove common words
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'as',
      'is',
      'was',
      'are',
      'were',
      'been',
      'be',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'should',
      'could',
      'may',
      'might',
      'can',
      'this',
      'that',
      'these',
      'those',
      'i',
      'you',
      'he',
      'she',
      'it',
      'we',
      'they',
      'what',
      'where',
      'when',
      'why',
      'how',
      'which',
      'who',
      'whom',
    ]);

    const terms = query
      .toLowerCase()
      .split(/[\s\.,!?;:()\[\]{}<>'"]+/)
      .filter((term) => term.length > 2 && !stopWords.has(term));

    return terms;
  }

  /**
   * Clear the index
   */
  clear(): void {
    this._index.clear();
    logger.debug('Cleared semantic file index');
  }

  /**
   * Get index size
   */
  size(): number {
    return this._index.size;
  }
}

/**
 * Cached semantic file index with auto-invalidation
 */
export class CachedSemanticIndex {
  private _lastFileHash: string | null = null;
  private _index: SemanticFileIndex | null = null;

  /**
   * Get or build index for files
   */
  getIndex(files: FileMap, fileHash: string): SemanticFileIndex {
    const cache = getCache();

    // Check if we can reuse existing index
    if (this._index && this._lastFileHash === fileHash) {
      logger.debug('Reusing existing semantic index');

      return this._index;
    }

    // Check cache
    const cacheKey = `fileindex:${fileHash}`;
    const cachedIndex = cache.get<{ index: Map<string, FileMetadata> }>(cacheKey);

    if (cachedIndex) {
      logger.info('Loaded semantic index from cache');
      this._index = new SemanticFileIndex();

      // Restore index from cache
      (this._index as any)._index = new Map(cachedIndex.index);
      this._lastFileHash = fileHash;

      return this._index;
    }

    // Build new index
    logger.info('Building new semantic index');
    this._index = new SemanticFileIndex();
    this._index.buildIndex(files);
    this._lastFileHash = fileHash;

    // Cache the index (10-minute TTL)
    cache.set(cacheKey, { index: Array.from((this._index as any)._index.entries()) }, 10 * 60 * 1000);

    return this._index;
  }

  /**
   * Invalidate cache
   */
  invalidate(): void {
    this._lastFileHash = null;
    this._index = null;
    logger.debug('Invalidated semantic index cache');
  }
}

/**
 * Singleton cached index instance
 */
let cachedIndexInstance: CachedSemanticIndex | undefined;

/**
 * Get or create cached index instance
 */
export function getCachedSemanticIndex(): CachedSemanticIndex {
  if (!cachedIndexInstance) {
    cachedIndexInstance = new CachedSemanticIndex();
  }

  return cachedIndexInstance;
}

/**
 * Helper function to score and filter files using semantic index
 */
export function selectFilesSemantically(
  query: string,
  files: FileMap,
  fileHash: string,
  topN: number = 15,
  recentlyChanged: string[] = [],
): string[] {
  const cachedIndex = getCachedSemanticIndex();
  const index = cachedIndex.getIndex(files, fileHash);

  return index.getTopFiles(query, topN, recentlyChanged);
}
