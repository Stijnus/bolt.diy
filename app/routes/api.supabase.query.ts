import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.supabase.query');

interface QueryRequest {
  projectId: string;
  query: string;
  options?: {
    analyze?: boolean;
    dryRun?: boolean;
    timeout?: number;
  };
}

interface QueryAnalysis {
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE' | 'ALTER' | 'DROP' | 'UNKNOWN';
  isDestructive: boolean;
  tables: string[];
  estimatedCost?: number;
  warnings: string[];
  suggestions: string[];
}

interface SupabaseQueryResponsePayload {
  data: unknown;
  metadata: {
    analysis: QueryAnalysis;
    executionTime: number;
    rowsAffected: number;
    queryType: QueryAnalysis['type'];
  };
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return new Response('No authorization token provided', { status: 401 });
  }

  try {
    const { projectId, query, options = {} } = (await request.json()) as QueryRequest;
    logger.debug('Executing query:', { projectId, queryLength: query.length, options });

    // Analyze query before execution
    const analysis = analyzeQuery(query);

    // If this is a dry run, return analysis only
    if (options.dryRun) {
      return new Response(
        JSON.stringify({
          analysis,
          query: query.trim(),
          dryRun: true,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // Warn about destructive operations
    if (analysis.isDestructive && !query.toLowerCase().includes('-- confirmed')) {
      return new Response(
        JSON.stringify({
          error: {
            type: 'DESTRUCTIVE_OPERATION',
            message: 'Destructive operation detected',
            analysis,
            suggestions: [
              'Add "-- confirmed" comment to bypass this check',
              'Review the query carefully before execution',
              'Consider backing up data first',
            ],
          },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // Execute the query with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 30000);

    try {
      const response = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: Record<string, unknown> | { message?: string; error?: unknown } | null;

        try {
          errorData = JSON.parse(errorText) as Record<string, unknown>;
        } catch {
          errorData = { message: errorText };
        }

        const enhancedError = enhanceError(errorData, query, analysis);

        logger.error('Supabase API error:', {
          status: response.status,
          statusText: response.statusText,
          error: enhancedError,
        });

        return new Response(
          JSON.stringify({
            error: enhancedError,
            analysis,
            query: query.trim(),
          }),
          {
            status: response.status,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      const resultData = (await response.json()) as unknown;

      // Add execution metadata
      const enhancedResult: SupabaseQueryResponsePayload = {
        data: resultData,
        metadata: {
          analysis,
          executionTime: Date.now(),
          rowsAffected: Array.isArray(resultData) ? resultData.length : 0,
          queryType: analysis.type,
        },
      };

      logger.debug('Query executed successfully:', {
        projectId,
        type: analysis.type,
        rowsAffected: enhancedResult.metadata.rowsAffected,
      });

      return new Response(JSON.stringify(enhancedResult), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        return new Response(
          JSON.stringify({
            error: {
              type: 'TIMEOUT',
              message: `Query timeout after ${options.timeout || 30000}ms`,
              suggestions: [
                'Optimize query performance',
                'Add appropriate indexes',
                'Break down complex queries',
                'Increase timeout if needed',
              ],
            },
            analysis,
          }),
          {
            status: 408,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      throw fetchError;
    }
  } catch (error) {
    logger.error('Query execution error:', error);

    const errorResponse = {
      error: {
        type: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Query execution failed',
        stack: error instanceof Error ? error.stack : undefined,
        suggestions: [
          'Check network connectivity',
          'Verify project credentials',
          'Review query syntax',
          'Check database permissions',
        ],
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function analyzeQuery(query: string): QueryAnalysis {
  const normalizedQuery = query.trim().toLowerCase();

  // Determine query type
  let type: QueryAnalysis['type'] = 'UNKNOWN';

  if (normalizedQuery.startsWith('select')) {
    type = 'SELECT';
  } else if (normalizedQuery.startsWith('insert')) {
    type = 'INSERT';
  } else if (normalizedQuery.startsWith('update')) {
    type = 'UPDATE';
  } else if (normalizedQuery.startsWith('delete')) {
    type = 'DELETE';
  } else if (normalizedQuery.startsWith('create')) {
    type = 'CREATE';
  } else if (normalizedQuery.startsWith('alter')) {
    type = 'ALTER';
  } else if (normalizedQuery.startsWith('drop')) {
    type = 'DROP';
  }

  // Check if operation is destructive
  const isDestructive =
    ['DELETE', 'DROP', 'UPDATE'].includes(type) || (type === 'ALTER' && normalizedQuery.includes('drop column'));

  // Extract table names (basic regex-based extraction)
  const tableMatches = query.match(/(?:from|into|update|join)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi) || [];
  const tables = [...new Set(tableMatches.map((match) => match.split(/\s+/)[1].toLowerCase()))];

  // Generate warnings
  const warnings: string[] = [];

  if (isDestructive && !normalizedQuery.includes('where')) {
    warnings.push('Destructive operation without WHERE clause - affects all rows');
  }

  if (normalizedQuery.includes('select *')) {
    warnings.push('Using SELECT * - consider specifying columns for better performance');
  }

  if (normalizedQuery.includes("like '%") && !normalizedQuery.includes('index')) {
    warnings.push('LIKE pattern starts with wildcard - consider full-text search or index');
  }

  // Generate suggestions
  const suggestions: string[] = [];

  if (type === 'SELECT' && !normalizedQuery.includes('limit')) {
    suggestions.push('Consider adding LIMIT clause for large result sets');
  }

  if (isDestructive) {
    suggestions.push('Test with SELECT first to verify affected rows');
    suggestions.push('Consider creating a backup before proceeding');
  }

  if (normalizedQuery.includes('order by') && !normalizedQuery.includes('limit')) {
    suggestions.push('ORDER BY without LIMIT can be expensive - consider pagination');
  }

  return {
    type,
    isDestructive,
    tables,
    warnings,
    suggestions,
  };
}

function enhanceError(
  errorData: Record<string, unknown> | { message?: string; error?: unknown } | null,
  query: string,
  analysis: QueryAnalysis,
) {
  const message =
    errorData && typeof errorData === 'object' && 'message' in errorData && typeof errorData.message === 'string'
      ? errorData.message
      : typeof errorData?.error === 'string'
        ? errorData.error
        : 'Unknown database error';

  // Common error patterns and enhanced explanations
  const errorEnhancements: Record<string, { description: string; suggestions: string[] }> = {
    'permission denied': {
      description: 'Database permission error',
      suggestions: [
        'Check Row Level Security (RLS) policies',
        'Verify user authentication and roles',
        'Ensure service role key is used for admin operations',
      ],
    },
    'relation.*does not exist': {
      description: 'Table or view not found',
      suggestions: [
        'Check table name spelling and case sensitivity',
        'Verify table exists in the current schema',
        'Run CREATE TABLE statement first if needed',
      ],
    },
    'column.*does not exist': {
      description: 'Column not found in table',
      suggestions: [
        'Check column name spelling',
        'Verify column exists in table schema',
        'Use DESCRIBE or \\d+ to check table structure',
      ],
    },
    'syntax error': {
      description: 'SQL syntax error',
      suggestions: [
        'Check SQL syntax and grammar',
        'Verify proper use of quotes and parentheses',
        'Ensure PostgreSQL-compatible syntax',
      ],
    },
    'duplicate key': {
      description: 'Unique constraint violation',
      suggestions: [
        'Check for existing records with same key',
        'Use INSERT ... ON CONFLICT for upsert operations',
        'Verify unique constraints on the table',
      ],
    },
  };

  // Find matching error enhancement
  let enhancement: { description: string; suggestions: string[] } = {
    description: 'Database error',
    suggestions: [],
  };

  for (const [pattern, enhance] of Object.entries(errorEnhancements)) {
    if (new RegExp(pattern, 'i').test(message)) {
      enhancement = enhance;
      break;
    }
  }

  return {
    type: 'DATABASE_ERROR',
    message,
    description: enhancement.description,
    details: errorData,
    query: query.trim(),
    analysis,
    suggestions: enhancement.suggestions,
    recoveryActions: [
      'Review query syntax and logic',
      'Check database schema and permissions',
      'Test with simpler query first',
      'Consult PostgreSQL documentation',
    ],
  };
}
