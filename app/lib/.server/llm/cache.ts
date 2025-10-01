import { createScopedLogger } from '~/utils/logger';
import type { FileMap } from './constants';

const logger = createScopedLogger('llm-cache');

/**
 * Cache entry with TTL support
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  accessCount: number;
  lastAccess: number;
}

/**
 * Cache statistics for monitoring
 */
interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  evictions: number;
}

/**
 * Generic cache configuration
 */
interface CacheConfig {
  maxSize: number; // Maximum number of entries
  defaultTTL: number; // Default TTL in milliseconds
  cleanupInterval: number; // How often to clean expired entries (ms)
}

/**
 * LRU cache with TTL support for LLM operations
 */
class LLMCache {
  private _cache: Map<string, CacheEntry<any>>;
  private _stats: CacheStats;
  private _config: CacheConfig;
  private _cleanupTimer?: NodeJS.Timeout;

  constructor(config?: Partial<CacheConfig>) {
    this._cache = new Map();
    this._stats = {
      hits: 0,
      misses: 0,
      size: 0,
      evictions: 0,
    };
    this._config = {
      maxSize: config?.maxSize ?? 500, // Default 500 entries
      defaultTTL: config?.defaultTTL ?? 5 * 60 * 1000, // Default 5 minutes
      cleanupInterval: config?.cleanupInterval ?? 60 * 1000, // Default 1 minute
    };

    // Start cleanup timer
    this._startCleanup();

    logger.info(
      `LLM Cache initialized: maxSize=${this._config.maxSize}, defaultTTL=${this._config.defaultTTL}ms, cleanupInterval=${this._config.cleanupInterval}ms`,
    );
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | undefined {
    const entry = this._cache.get(key);

    if (!entry) {
      this._stats.misses++;
      logger.debug(`Cache MISS: ${key}`);

      return undefined;
    }

    // Check if expired
    const now = Date.now();

    if (now - entry.timestamp > entry.ttl) {
      this._cache.delete(key);
      this._stats.misses++;
      logger.debug(`Cache EXPIRED: ${key} (age: ${now - entry.timestamp}ms, ttl: ${entry.ttl}ms)`);

      return undefined;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccess = now;
    this._stats.hits++;

    logger.debug(`Cache HIT: ${key} (age: ${now - entry.timestamp}ms, accesses: ${entry.accessCount})`);

    return entry.value as T;
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const now = Date.now();

    // Check if we need to evict entries
    if (this._cache.size >= this._config.maxSize && !this._cache.has(key)) {
      this._evictLRU();
    }

    this._cache.set(key, {
      value,
      timestamp: now,
      ttl: ttl ?? this._config.defaultTTL,
      accessCount: 0,
      lastAccess: now,
    });

    this._stats.size = this._cache.size;
    logger.debug(`Cache SET: ${key} (ttl: ${ttl ?? this._config.defaultTTL}ms)`);
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    const result = this._cache.delete(key);
    this._stats.size = this._cache.size;

    if (result) {
      logger.debug(`Cache DELETE: ${key}`);
    }

    return result;
  }

  /**
   * Delete all keys matching a pattern
   */
  deletePattern(pattern: string | RegExp): number {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    let deletedCount = 0;

    for (const key of this._cache.keys()) {
      if (regex.test(key)) {
        this._cache.delete(key);
        deletedCount++;
      }
    }

    this._stats.size = this._cache.size;
    logger.debug(`Cache DELETE_PATTERN: ${pattern} (deleted: ${deletedCount})`);

    return deletedCount;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const previousSize = this._cache.size;
    this._cache.clear();
    this._stats.size = 0;
    logger.info(`Cache CLEARED (removed: ${previousSize} entries)`);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this._stats };
  }

  /**
   * Get hit rate percentage
   */
  getHitRate(): number {
    const total = this._stats.hits + this._stats.misses;

    return total === 0 ? 0 : (this._stats.hits / total) * 100;
  }

  /**
   * Evict least recently used entry
   */
  private _evictLRU(): void {
    let oldestKey: string | undefined;
    let oldestAccess = Infinity;

    for (const [key, entry] of this._cache.entries()) {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this._cache.delete(oldestKey);
      this._stats.evictions++;
      logger.debug(`Cache EVICTED (LRU): ${oldestKey}`);
    }
  }

  /**
   * Clean up expired entries
   */
  private _cleanup(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of this._cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this._cache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this._stats.size = this._cache.size;
      logger.info(`Cache CLEANUP: removed ${expiredCount} expired entries (remaining: ${this._cache.size})`);
    }
  }

  /**
   * Start cleanup timer
   */
  private _startCleanup(): void {
    this._cleanupTimer = setInterval(() => {
      this._cleanup();
    }, this._config.cleanupInterval);
  }

  /**
   * Stop cleanup timer
   */
  stop(): void {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = undefined;
      logger.info('Cache cleanup timer stopped');
    }
  }
}

/**
 * Singleton cache instance
 */
let cacheInstance: LLMCache | undefined;

/**
 * Get or create cache instance
 */
export function getCache(): LLMCache {
  if (!cacheInstance) {
    cacheInstance = new LLMCache();
  }

  return cacheInstance;
}

/**
 * Cache key builders for different types of cached data
 */
export const CACHE_KEYS = {
  /**
   * Summary cache key: chatId + message count
   */
  summary: (chatId: string, messageCount: number): string => {
    return `summary:${chatId}:${messageCount}`;
  },

  /**
   * File list cache key: project hash or timestamp
   */
  fileList: (projectHash: string): string => {
    return `filelist:${projectHash}`;
  },

  /**
   * Context selection cache key: hash of last user message + file list hash
   */
  contextSelection: (messageHash: string, fileListHash: string): string => {
    return `context:${messageHash}:${fileListHash}`;
  },

  /**
   * File content cache key: file path + modification time
   */
  fileContent: (filePath: string, mtime: number): string => {
    return `file:${filePath}:${mtime}`;
  },
};

/**
 * Helper to create a simple hash from a string
 */
export function simpleHash(str: string): string {
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return Math.abs(hash).toString(36);
}

/**
 * Create a hash for a file map (based on file paths and sizes)
 */
export function hashFileMap(files: FileMap): string {
  const fileKeys = Object.keys(files)
    .sort()
    .map((path) => {
      const file = files[path];
      return `${path}:${file?.type}:${file?.type === 'file' ? file.content.length : 0}`;
    })
    .join('|');

  return simpleHash(fileKeys);
}

/**
 * Summary checkpoint manager
 */
export class SummaryCheckpoint {
  private static _checkpointInterval = 10; // Create checkpoint every N messages

  /**
   * Check if we should create a new checkpoint
   */
  static shouldCreateCheckpoint(messageCount: number): boolean {
    return messageCount > 0 && messageCount % this._checkpointInterval === 0;
  }

  /**
   * Get the last checkpoint message count
   */
  static getLastCheckpointCount(messageCount: number): number {
    return Math.floor(messageCount / this._checkpointInterval) * this._checkpointInterval;
  }

  /**
   * Get messages since last checkpoint
   */
  static getMessagesSinceCheckpoint(messageCount: number): number {
    return messageCount % this._checkpointInterval;
  }
}

/**
 * Export cache instance for testing
 */
export function resetCache(): void {
  if (cacheInstance) {
    cacheInstance.stop();
    cacheInstance = undefined;
  }
}

export default LLMCache;
