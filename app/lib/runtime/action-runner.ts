import type { WebContainer } from '@webcontainer/api';
import { path as nodePath } from '~/utils/path';
import { atom, map, type MapStore } from 'nanostores';
import type { ActionAlert, BoltAction, DeployAlert, FileHistory, SupabaseAction, SupabaseAlert } from '~/types/actions';
import { createScopedLogger } from '~/utils/logger';
import { unreachable } from '~/utils/unreachable';
import type { ActionCallbackData } from './message-parser';
import type { BoltShell } from '~/utils/shell';

import { fileChangeOptimizer } from './file-change-optimizer';
import type { FileMap } from '~/lib/stores/files';
import { supabaseConnection, updateSupabaseConnection } from '~/lib/stores/supabase';

const logger = createScopedLogger('ActionRunner');

type SupabaseApiErrorResponse = {
  error?: string | { message?: string };
  message?: string;
};

type SupabaseQueryResponse = {
  data: unknown;
  metadata?: {
    analysis?: unknown;
    executionTime?: number;
    rowsAffected?: number;
    queryType?: string;
  };
};

type SupabaseProjectSummary = {
  id: string;
  name?: string;
  region?: string;
  organization_id?: string;
  status?: string;
  supabaseUrl?: string;
  anonKey?: string;
  serviceRoleKey?: string;
};

type SupabaseProjectCreateResponse = {
  success?: boolean;
  project?: SupabaseProjectSummary;
  estimatedTime?: number;
};

type SupabaseProjectInitializeResponse = {
  success?: boolean;
  project?: SupabaseProjectSummary;
  envContent?: string;
  setupActions?: string[];
};

export type ActionStatus = 'pending' | 'running' | 'complete' | 'aborted' | 'failed';

export type BaseActionState = BoltAction & {
  status: Exclude<ActionStatus, 'failed'>;
  abort: () => void;
  executed: boolean;
  abortSignal: AbortSignal;
};

export type FailedActionState = BoltAction &
  Omit<BaseActionState, 'status'> & {
    status: Extract<ActionStatus, 'failed'>;
    error: string;
  };

export type ActionState = BaseActionState | FailedActionState;

type BaseActionUpdate = Partial<Pick<BaseActionState, 'status' | 'abort' | 'executed'>>;

export type ActionStateUpdate =
  | BaseActionUpdate
  | (Omit<BaseActionUpdate, 'status'> & { status: 'failed'; error: string });

type ActionsMap = MapStore<Record<string, ActionState>>;

class ActionCommandError extends Error {
  readonly _output: string;
  readonly _header: string;

  constructor(message: string, output: string) {
    // Create a formatted message that includes both the error message and output
    const formattedMessage = `Failed To Execute Shell Command: ${message}\n\nOutput:\n${output}`;
    super(formattedMessage);

    // Set the output separately so it can be accessed programmatically
    this._header = message;
    this._output = output;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, ActionCommandError.prototype);

    // Set the name of the error for better debugging
    this.name = 'ActionCommandError';
  }

  // Optional: Add a method to get just the terminal output
  get output() {
    return this._output;
  }
  get header() {
    return this._header;
  }
}

export class ActionRunner {
  #webcontainer: Promise<WebContainer>;
  #currentExecutionPromise: Promise<void> = Promise.resolve();
  #shellTerminal: () => BoltShell;
  runnerId = atom<string>(`${Date.now()}`);
  actions: ActionsMap = map({});
  onAlert?: (alert: ActionAlert) => void;

  // File optimization tracking
  #fileOptimizationEnabled = true;
  #pendingFileChanges: Map<string, string> = new Map();
  #existingFiles: Map<string, string> = new Map();
  #userRequest: string = '';
  #optDebounceTimer: number | undefined;
  #isStreamingMode: boolean = false;

  #optimizationStats = {
    totalFilesAnalyzed: 0,
    filesSkipped: 0,
    filesModified: 0,
    filesCreated: 0,
    optimizationRate: 0,
    lastOptimization: null as Date | null,
  };

  onSupabaseAlert?: (alert: SupabaseAlert) => void;
  onDeployAlert?: (alert: DeployAlert) => void;
  buildOutput?: { path: string; exitCode: number; output: string };

  constructor(
    webcontainerPromise: Promise<WebContainer>,
    getShellTerminal: () => BoltShell,
    onAlert?: (alert: ActionAlert) => void,
    onSupabaseAlert?: (alert: SupabaseAlert) => void,
    onDeployAlert?: (alert: DeployAlert) => void,
  ) {
    this.#webcontainer = webcontainerPromise;
    this.#shellTerminal = getShellTerminal;
    this.onAlert = onAlert;
    this.onSupabaseAlert = onSupabaseAlert;
    this.onDeployAlert = onDeployAlert;
  }

  addAction(data: ActionCallbackData) {
    const { actionId } = data;

    const actions = this.actions.get();
    const action = actions[actionId];

    if (action) {
      // action already added
      return;
    }

    const abortController = new AbortController();

    this.actions.setKey(actionId, {
      ...data.action,
      status: 'pending',
      executed: false,
      abort: () => {
        abortController.abort();
        this.#updateAction(actionId, { status: 'aborted' });
      },
      abortSignal: abortController.signal,
    });

    this.#currentExecutionPromise.then(() => {
      this.#updateAction(actionId, { status: 'running' });
    });
  }

  async runAction(data: ActionCallbackData, isStreaming: boolean = false) {
    const { actionId } = data;
    const action = this.actions.get()[actionId];

    if (!action) {
      unreachable(`Action ${actionId} not found`);
    }

    if (action.executed) {
      return; // No return value here
    }

    if (isStreaming && action.type !== 'file') {
      return; // No return value here
    }

    this.#updateAction(actionId, { ...action, ...data.action, executed: !isStreaming });

    this.#currentExecutionPromise = this.#currentExecutionPromise
      .then(() => {
        return this.#executeAction(actionId, isStreaming);
      })
      .catch((error) => {
        logger.error('Action execution promise failed:', error);
      });

    await this.#currentExecutionPromise;

    return;
  }

  async #executeAction(actionId: string, isStreaming: boolean = false) {
    const action = this.actions.get()[actionId];

    this.#updateAction(actionId, { status: 'running' });

    try {
      switch (action.type) {
        case 'shell': {
          await this.#runShellAction(action);
          break;
        }
        case 'file': {
          const prevStreaming = this.#isStreamingMode;
          this.#isStreamingMode = isStreaming;

          try {
            await this.#runFileAction(action);
          } finally {
            this.#isStreamingMode = prevStreaming;
          }
          break;
        }

        case 'supabase': {
          try {
            await this.handleSupabaseAction(action as SupabaseAction);
          } catch (error: any) {
            // Update action status
            this.#updateAction(actionId, {
              status: 'failed',
              error: error instanceof Error ? error.message : 'Supabase action failed',
            });

            // Return early without re-throwing
            return;
          }
          break;
        }
        case 'build': {
          const buildOutput = await this.#runBuildAction(action);

          // Store build output for deployment
          this.buildOutput = buildOutput;
          break;
        }
        case 'start': {
          // making the start app non blocking

          this.#runStartAction(action)
            .then(() => this.#updateAction(actionId, { status: 'complete' }))
            .catch((err: Error) => {
              if (action.abortSignal.aborted) {
                return;
              }

              this.#updateAction(actionId, { status: 'failed', error: 'Action failed' });
              logger.error(`[${action.type}]:Action failed\n\n`, err);

              if (!(err instanceof ActionCommandError)) {
                return;
              }

              this.onAlert?.({
                type: 'error',
                title: 'Dev Server Failed',
                description: err.header,
                content: err.output,
              });
            });

          /*
           * adding a delay to avoid any race condition between 2 start actions
           * i am up for a better approach
           */
          await new Promise((resolve) => setTimeout(resolve, 2000));

          return;
        }
      }

      this.#updateAction(actionId, {
        status: isStreaming ? 'running' : action.abortSignal.aborted ? 'aborted' : 'complete',
      });
    } catch (error) {
      if (action.abortSignal.aborted) {
        return;
      }

      this.#updateAction(actionId, { status: 'failed', error: 'Action failed' });
      logger.error(`[${action.type}]:Action failed\n\n`, error);

      if (!(error instanceof ActionCommandError)) {
        return;
      }

      this.onAlert?.({
        type: 'error',
        title: 'Dev Server Failed',
        description: error.header,
        content: error.output,
      });

      // re-throw the error to be caught in the promise chain
      throw error;
    }
  }

  async #runShellAction(action: ActionState) {
    if (action.type !== 'shell') {
      unreachable('Expected shell action');
    }

    const shell = this.#shellTerminal();
    await shell.ready();

    if (!shell || !shell.terminal || !shell.process) {
      unreachable('Shell terminal not found');
    }

    // Pre-validate command for common issues
    const validationResult = await this.#validateShellCommand(action.content);

    if (validationResult.shouldModify && validationResult.modifiedCommand) {
      logger.debug(`Modified command: ${action.content} -> ${validationResult.modifiedCommand}`);
      action.content = validationResult.modifiedCommand;
    }

    const resp = await shell.executeCommand(this.runnerId.get(), action.content, () => {
      logger.debug(`[${action.type}]:Aborting Action\n\n`, action);
      action.abort();
    });
    logger.debug(`${action.type} Shell Response: [exit code:${resp?.exitCode}]`);

    if (resp?.exitCode != 0) {
      const enhancedError = this.#createEnhancedShellError(action.content, resp?.exitCode, resp?.output);
      throw new ActionCommandError(enhancedError.title, enhancedError.details);
    }
  }

  async #runStartAction(action: ActionState) {
    if (action.type !== 'start') {
      unreachable('Expected shell action');
    }

    if (!this.#shellTerminal) {
      unreachable('Shell terminal not found');
    }

    const shell = this.#shellTerminal();
    await shell.ready();

    if (!shell || !shell.terminal || !shell.process) {
      unreachable('Shell terminal not found');
    }

    const resp = await shell.executeCommand(this.runnerId.get(), action.content, () => {
      logger.debug(`[${action.type}]:Aborting Action\n\n`, action);
      action.abort();
    });
    logger.debug(`${action.type} Shell Response: [exit code:${resp?.exitCode}]`);

    if (resp?.exitCode != 0) {
      throw new ActionCommandError('Failed To Start Application', resp?.output || 'No Output Available');
    }

    return resp;
  }

  async #runFileAction(action: ActionState) {
    if (action.type !== 'file') {
      unreachable('Expected file action');
    }

    const webcontainer = await this.#webcontainer;
    const relativePath = nodePath.relative(webcontainer.workdir, action.filePath);

    // In streaming mode, write through immediately to avoid UI stalls and timer starvation
    if (this.#isStreamingMode) {
      // Track pending change for end-of-stream optimization/statistics
      try {
        if (!this.#existingFiles.has(relativePath)) {
          const existing = await webcontainer.fs.readFile(relativePath, 'utf-8');
          this.#existingFiles.set(relativePath, existing);
        }
      } catch {
        // file doesn't exist -> creation
      }
      this.#pendingFileChanges.set(relativePath, action.content);

      await this.#writeFileWithLogging(webcontainer, relativePath, action.content);

      return;
    }

    if (this.#fileOptimizationEnabled) {
      // Track proposed change
      this.#pendingFileChanges.set(relativePath, action.content);

      // Capture existing content if any
      try {
        const existing = await webcontainer.fs.readFile(relativePath, 'utf-8');
        this.#existingFiles.set(relativePath, existing);
      } catch {
        // file doesn't exist -> creation
      }

      logger.debug(`📝 Queued file change: ${relativePath} (len=${action.content.length})`);

      // Optimize immediately for certain cases; otherwise debounce
      if (this.#shouldOptimizeNow(relativePath, action.content)) {
        await this.#performFileOptimization();
      } else {
        this.#scheduleOptimizationDebounce(120);
      }

      return;
    }

    // Fallback: optimization disabled => write directly
    await this.#writeFileWithLogging(webcontainer, relativePath, action.content);
  }

  #updateAction(id: string, newState: ActionStateUpdate) {
    const actions = this.actions.get();

    this.actions.setKey(id, { ...actions[id], ...newState });
  }

  /** Set user request context for better optimization */
  setUserRequest(request: string) {
    this.#userRequest = request;
    logger.debug(`User request context set: "${request.substring(0, 120)}..."`);
  }

  /** Get optimization statistics */
  getOptimizationStats() {
    return { ...this.#optimizationStats };
  }

  /** Enable or disable file optimization */
  setFileOptimizationEnabled(enabled: boolean) {
    this.#fileOptimizationEnabled = enabled;
    logger.info(`File optimization ${enabled ? 'enabled' : 'disabled'}`);
  }

  /** Force optimization of pending file changes */
  async flushPendingFileChanges() {
    if (this.#optDebounceTimer) {
      clearTimeout(this.#optDebounceTimer);
      this.#optDebounceTimer = undefined;
    }

    if (this.#pendingFileChanges.size > 0) {
      logger.info(`Flushing ${this.#pendingFileChanges.size} pending file changes...`);
      await this.#performFileOptimization();
    }
  }

  #scheduleOptimizationDebounce(delayMs: number = 120) {
    if (this.#optDebounceTimer) {
      clearTimeout(this.#optDebounceTimer);
    }

    this.#optDebounceTimer = setTimeout(() => {
      this.#performFileOptimization().catch((e) => logger.error('Optimization failed', e));
      this.#optDebounceTimer = undefined;
    }, delayMs) as unknown as number;
  }

  async getFileHistory(filePath: string): Promise<FileHistory | null> {
    try {
      const webcontainer = await this.#webcontainer;
      const historyPath = this.#getHistoryPath(filePath);
      const content = await webcontainer.fs.readFile(historyPath, 'utf-8');

      return JSON.parse(content);
    } catch (error) {
      logger.error('Failed to get file history:', error);
      return null;
    }
  }

  async saveFileHistory(filePath: string, history: FileHistory) {
    // const webcontainer = await this.#webcontainer;
    const historyPath = this.#getHistoryPath(filePath);

    await this.#runFileAction({
      type: 'file',
      filePath: historyPath,
      content: JSON.stringify(history),
      changeSource: 'auto-save',
    } as any);
  }

  async #writeFileWithLogging(webcontainer: WebContainer, relativePath: string, content: string) {
    const folder = nodePath.dirname(relativePath).replace(/\/+$/g, '');

    if (folder !== '.') {
      try {
        await webcontainer.fs.mkdir(folder, { recursive: true });
        logger.debug('Created folder', folder);
      } catch (error) {
        logger.error('Failed to create folder', folder, error);
      }
    }

    try {
      await webcontainer.fs.writeFile(relativePath, content);
      logger.debug(`File written ${relativePath}`);
    } catch (error) {
      logger.error('Failed to write file', relativePath, error);
    }
  }

  #shouldOptimizeNow(path: string, content: string) {
    // Heuristics: Write immediately if very large or likely to be needed right away

    // 1MB+ files should be written immediately to avoid memory issues
    if (content.length > 1024 * 1024) {
      return true;
    }

    // Binary and asset files should be written immediately
    if (/\.(lock|png|jpg|jpeg|gif|webp|svg|ico|woff2?|pdf|zip|tar|gz)$/i.test(path)) {
      return true;
    }

    // Build outputs and critical files should be written immediately
    if (/^(dist|build|out|\.next)\//.test(path)) {
      return true;
    }

    // Package manager files should be written immediately
    if (/(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb)$/.test(path)) {
      return true;
    }

    // Configuration files that might affect builds
    if (/(tsconfig\.json|webpack\.config\.|vite\.config\.|rollup\.config\.)/.test(path)) {
      return true;
    }

    return false;
  }

  async #performFileOptimization() {
    const webcontainer = await this.#webcontainer;

    // Build maps expected by optimizer
    const proposed: FileMap = {};
    const existing: FileMap = {};

    for (const [p, c] of this.#pendingFileChanges.entries()) {
      proposed[p] = { type: 'file', name: p.split('/').pop() || p, path: p, content: c } as any;
    }

    for (const [p, c] of this.#existingFiles.entries()) {
      existing[p] = { type: 'file', name: p.split('/').pop() || p, path: p, content: c } as any;
    }

    const { optimizedFiles, analysis, skippedFiles, modifiedFiles, createdFiles, optimizationRate } =
      await fileChangeOptimizer.optimizeFileChanges(proposed, existing, this.#userRequest);

    // Write the optimized set
    for (const [p, dirent] of Object.entries(optimizedFiles)) {
      const content = (dirent as any).content ?? '';
      await this.#writeFileWithLogging(webcontainer, p, content);
    }

    // Stats
    this.#optimizationStats.totalFilesAnalyzed += this.#pendingFileChanges.size;
    this.#optimizationStats.filesSkipped += skippedFiles.length;
    this.#optimizationStats.filesModified += modifiedFiles.length;
    this.#optimizationStats.filesCreated += createdFiles.length;
    this.#optimizationStats.optimizationRate = optimizationRate;
    this.#optimizationStats.lastOptimization = new Date();

    // Clear queues
    this.#pendingFileChanges.clear();
    this.#existingFiles.clear();

    // Debug log a few analyses
    let shown = 0;

    for (const [p, a] of analysis.entries()) {
      if (shown++ > 5) {
        break;
      }

      logger.debug(
        `[opt] ${p} -> ${a.changeType} (${(a.similarity * 100).toFixed(1)}% sim, ${a.changePercentage.toFixed(1)}% change) :: ${a.reason}`,
      );
    }
  }

  #getHistoryPath(filePath: string) {
    return nodePath.join('.history', filePath);
  }

  async #runBuildAction(action: ActionState) {
    if (action.type !== 'build') {
      unreachable('Expected build action');
    }

    // Ensure pending file changes are written before building
    await this.flushPendingFileChanges();

    // Trigger build started alert
    this.onDeployAlert?.({
      type: 'info',
      title: 'Building Application',
      description: 'Building your application...',
      stage: 'building',
      buildStatus: 'running',
      deployStatus: 'pending',
      source: 'netlify',
    });

    const webcontainer = await this.#webcontainer;

    // Create a new terminal specifically for the build
    const buildProcess = await webcontainer.spawn('npm', ['run', 'build']);

    let output = '';
    buildProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          output += data;
        },
      }),
    );

    const exitCode = await buildProcess.exit;

    if (exitCode !== 0) {
      // Trigger build failed alert
      this.onDeployAlert?.({
        type: 'error',
        title: 'Build Failed',
        description: 'Your application build failed',
        content: output || 'No build output available',
        stage: 'building',
        buildStatus: 'failed',
        deployStatus: 'pending',
        source: 'netlify',
      });

      throw new ActionCommandError('Build Failed', output || 'No Output Available');
    }

    // Trigger build success alert
    this.onDeployAlert?.({
      type: 'success',
      title: 'Build Completed',
      description: 'Your application was built successfully',
      stage: 'deploying',
      buildStatus: 'complete',
      deployStatus: 'running',
      source: 'netlify',
    });

    // Check for common build directories
    const commonBuildDirs = ['dist', 'build', 'out', 'output', '.next', 'public'];

    let buildDir = '';

    // Try to find the first existing build directory
    for (const dir of commonBuildDirs) {
      const dirPath = nodePath.join(webcontainer.workdir, dir);

      try {
        await webcontainer.fs.readdir(dirPath);
        buildDir = dirPath;
        break;
      } catch {
        continue;
      }
    }

    // If no build directory was found, use the default (dist)
    if (!buildDir) {
      buildDir = nodePath.join(webcontainer.workdir, 'dist');
    }

    return {
      path: buildDir,
      exitCode,
      output,
    };
  }
  async handleSupabaseAction(action: SupabaseAction) {
    const { operation, content, filePath } = action;
    logger.debug('[Supabase Action]:', { operation, filePath, content });

    switch (operation) {
      case 'migration':
        if (!filePath) {
          throw new Error('Migration requires a filePath');
        }

        // Show alert for migration action
        this.onSupabaseAlert?.({
          type: 'info',
          title: 'Supabase Migration',
          description: `Create migration file: ${filePath}`,
          content,
          source: 'supabase',
          operation: 'migration',
        });

        // Only create the migration file
        await this.#runFileAction({
          type: 'file',
          filePath,
          content,
          changeSource: 'supabase',
        } as any);
        return { success: true };

      case 'query': {
        // Get Supabase connection details
        const connection = supabaseConnection.get();

        // Check Supabase setup state and provide appropriate guidance
        if (!connection.token) {
          // No Supabase account connected
          this.onSupabaseAlert?.({
            type: 'info',
            title: 'Supabase Setup Required',
            description: 'Connect your Supabase account to get started',
            content:
              'To execute database queries, you need to connect your Supabase account. This will allow Bolt to create projects, set up databases, and run queries automatically.',
            source: 'supabase',
            operation: 'query',
          });

          return { pending: true };
        }

        if (!connection.stats?.projects || connection.stats.projects.length === 0) {
          // Has account but no projects
          this.onSupabaseAlert?.({
            type: 'info',
            title: 'Create Supabase Project',
            description: 'No projects found - create your first project',
            content:
              'You have a Supabase account connected, but no projects exist yet. Create a new project to set up your database and start building with Supabase features.',
            source: 'supabase',
            operation: 'query',
          });

          return { pending: true };
        }

        if (!connection.selectedProjectId) {
          // Has projects but none selected
          const projectCount = connection.stats.projects.length;
          this.onSupabaseAlert?.({
            type: 'info',
            title: 'Select Supabase Project',
            description: `${projectCount} project${projectCount > 1 ? 's' : ''} available - select one to continue`,
            content: `You have ${projectCount} Supabase project${projectCount > 1 ? 's' : ''} available. Select a project to set up the database connection and execute queries.`,
            source: 'supabase',
            operation: 'query',
          });

          return { pending: true };
        }

        if (!connection.credentials?.anonKey) {
          // Project selected but no credentials set up
          this.onSupabaseAlert?.({
            type: 'info',
            title: 'Setup Database Connection',
            description: 'Configure API keys for your selected project',
            content:
              "Your Supabase project is selected, but the database connection isn't configured yet. Set up the API keys to enable query execution.",
            source: 'supabase',
            operation: 'query',
          });

          return { pending: true };
        }

        // Show executing alert
        this.onSupabaseAlert?.({
          type: 'info',
          title: 'Executing Supabase Query',
          description: 'Running database query...',
          content,
          source: 'supabase',
          stage: 'executing',
          queryStatus: 'running',
          operation: 'query',
        });

        // Execute query directly
        try {
          const response = await fetch('/api/supabase/query', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${connection.token}`,
            },
            body: JSON.stringify({
              projectId: connection.selectedProjectId,
              query: content,
            }),
          });

          if (!response.ok) {
            const errorData = (await response.json()) as SupabaseApiErrorResponse | null;
            const errorMessage =
              (typeof errorData?.error === 'string' ? errorData.error : errorData?.error?.message) ||
              errorData?.message ||
              response.statusText;
            throw new Error(errorMessage);
          }

          const result = (await response.json()) as SupabaseQueryResponse;
          logger.debug('Supabase query executed successfully:', result);

          const rowCount = Array.isArray(result.data) ? result.data.length : 0;

          // Show success alert
          this.onSupabaseAlert?.({
            type: 'success',
            title: 'Supabase Query Completed',
            description: 'Database query executed successfully',
            content: rowCount > 0 ? `Returned ${rowCount} row(s)` : 'Query executed successfully',
            source: 'supabase',
            stage: 'complete',
            queryStatus: 'complete',
            operation: 'query',
          });

          return { success: true, result };
        } catch (error: any) {
          logger.error('Failed to execute Supabase query:', error);

          // Determine error type and provide helpful suggestions
          let errorDescription = 'Failed to execute database query';
          let suggestions = '';

          const errorMessage = error instanceof Error ? error.message : String(error);

          if (errorMessage.includes('permission denied') || errorMessage.includes('insufficient_privilege')) {
            errorDescription = 'Permission denied - check your database permissions';
            suggestions = 'Ensure your Supabase service role has the necessary permissions for this operation.';
          } else if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
            errorDescription = 'Table or relation does not exist';
            suggestions = 'Check that the table name is correct and exists in your database.';
          } else if (errorMessage.includes('syntax error')) {
            errorDescription = 'SQL syntax error';
            suggestions = 'Review your SQL query for syntax errors.';
          } else if (errorMessage.includes('connection') || errorMessage.includes('timeout')) {
            errorDescription = 'Database connection issue';
            suggestions = 'Check your internet connection and Supabase service status.';
          } else if (errorMessage.includes('authentication') || errorMessage.includes('unauthorized')) {
            errorDescription = 'Authentication failed';
            suggestions = 'Verify your Supabase credentials and try reconnecting.';
          }

          // Show error alert with helpful information
          this.onSupabaseAlert?.({
            type: 'error',
            title: 'Supabase Query Failed',
            description: errorDescription,
            content: `${errorMessage}${suggestions ? `\n\n**Suggestions:** ${suggestions}` : ''}`,
            source: 'supabase',
            stage: 'complete',
            queryStatus: 'failed',
            operation: 'query',
          });

          throw error;
        }
      }

      case 'project-create': {
        return await this.#handleProjectCreate(action);
      }

      case 'setup': {
        return await this.#handleProjectSetup(action);
      }

      case 'validate': {
        return await this.#handleProjectValidate(action);
      }

      case 'seed': {
        return await this.#handleProjectSeed(action);
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  async #handleProjectCreate(action: SupabaseAction) {
    const { name, organizationId, region, plan, dbPassword } = action;
    const connection = supabaseConnection.get();

    if (!connection.token) {
      this.onSupabaseAlert?.({
        type: 'error',
        title: 'Authentication Required',
        description: 'Connect your Supabase account to create projects',
        content: 'You need to be connected to Supabase to create new projects. Please connect your account first.',
        source: 'supabase',
        operation: 'project-create',
      });
      throw new Error('Supabase authentication required');
    }

    if (!name || !organizationId || !dbPassword) {
      this.onSupabaseAlert?.({
        type: 'error',
        title: 'Missing Project Details',
        description: 'Project name, organization, and database password are required',
        content: 'Please provide all required project details to create a new Supabase project.',
        source: 'supabase',
        operation: 'project-create',
      });
      throw new Error('Missing required project details');
    }

    // Show project creation started alert
    this.onSupabaseAlert?.({
      type: 'info',
      title: 'Creating Supabase Project',
      description: `Creating project: ${name}`,
      content: 'Initializing your new Supabase project. This may take a few minutes...',
      source: 'supabase',
      stage: 'creating',
      projectStatus: 'creating',
      operation: 'project-create',
      estimatedTime: 120,
      progress: 10,
    });

    try {
      const response = await fetch('/api/supabase/projects/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: connection.token,
          name,
          organizationId,
          region: region || 'us-east-1',
          plan: plan || 'free',
          dbPassword,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as SupabaseApiErrorResponse | null;
        const message =
          (typeof errorData?.error === 'string' ? errorData.error : errorData?.error?.message) ||
          errorData?.message ||
          'Failed to create project';
        throw new Error(message);
      }

      const result = (await response.json()) as SupabaseProjectCreateResponse;
      logger.debug('Project creation initiated:', result);

      // Show project creation in progress
      this.onSupabaseAlert?.({
        type: 'success',
        title: 'Project Creation Started',
        description: `Project ${name} is being created`,
        content: `Your Supabase project is initializing. You can monitor progress in your Supabase dashboard.`,
        source: 'supabase',
        stage: 'creating',
        projectStatus: 'creating',
        operation: 'project-create',
        projectId: result.project?.id,
        projectUrl: result.project?.id ? `https://supabase.com/dashboard/project/${result.project.id}` : undefined,
        estimatedTime: result.estimatedTime || 120,
        progress: 25,
        nextSteps: [
          'Wait for project to finish initializing',
          'Set up API keys once project is ready',
          'Configure your application environment',
        ],
      });

      return { success: true, project: result.project };
    } catch (error: any) {
      logger.error('Project creation failed:', error);

      this.onSupabaseAlert?.({
        type: 'error',
        title: 'Project Creation Failed',
        description: 'Failed to create Supabase project',
        content: error.message || 'An unexpected error occurred while creating the project.',
        source: 'supabase',
        stage: 'complete',
        projectStatus: 'failed',
        operation: 'project-create',
      });

      throw error;
    }
  }

  async #handleProjectSetup(action: SupabaseAction) {
    const { projectId } = action;
    const connection = supabaseConnection.get();

    if (!connection.token) {
      throw new Error('Supabase authentication required');
    }

    if (!projectId) {
      const selectedProjectId = connection.selectedProjectId;

      if (!selectedProjectId) {
        this.onSupabaseAlert?.({
          type: 'error',
          title: 'No Project Selected',
          description: 'Select a project to set up',
          content: 'You need to select a Supabase project before setting it up.',
          source: 'supabase',
          operation: 'setup',
        });
        throw new Error('No project selected for setup');
      }

      action.projectId = selectedProjectId;
    }

    // Show setup starting alert
    this.onSupabaseAlert?.({
      type: 'info',
      title: 'Setting Up Project',
      description: 'Configuring project environment',
      content: 'Fetching API keys and generating configuration...',
      source: 'supabase',
      stage: 'initializing',
      operation: 'setup',
      progress: 20,
    });

    try {
      const response = await fetch('/api/supabase/projects/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: connection.token,
          projectId: action.projectId,
          setupOptions: {
            generateEnvFile: true,
            enableRLS: true,
            createExampleTable: false,
          },
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as SupabaseApiErrorResponse | null;
        const message =
          (typeof errorData?.error === 'string' ? errorData.error : errorData?.error?.message) ||
          errorData?.message ||
          'Failed to set up project';
        throw new Error(message);
      }

      const result = (await response.json()) as SupabaseProjectInitializeResponse;
      logger.debug('Project setup completed:', result);

      // Create .env file if content was generated
      if (result.envContent) {
        await this.#runFileAction({
          type: 'file',
          filePath: '.env',
          content: result.envContent,
          changeSource: 'supabase',
        } as any);
      }

      // Update connection state with new credentials
      updateSupabaseConnection({
        selectedProjectId: action.projectId,
        credentials: {
          anonKey: result.project?.anonKey,
          supabaseUrl: result.project?.supabaseUrl,
        },
      });

      // Show setup success
      this.onSupabaseAlert?.({
        type: 'success',
        title: 'Project Setup Complete',
        description: 'Environment configured successfully',
        content: 'Your Supabase project is now configured and ready to use!',
        source: 'supabase',
        stage: 'complete',
        operation: 'setup',
        progress: 100,
        nextSteps: result.setupActions || [
          'Start building your application',
          'Create database tables as needed',
          'Set up authentication flows',
        ],
      });

      return { success: true, project: result.project };
    } catch (error: any) {
      logger.error('Project setup failed:', error);

      this.onSupabaseAlert?.({
        type: 'error',
        title: 'Setup Failed',
        description: 'Failed to set up project environment',
        content: error.message || 'An unexpected error occurred during setup.',
        source: 'supabase',
        stage: 'complete',
        operation: 'setup',
      });

      throw error;
    }
  }

  async #handleProjectValidate(_action: SupabaseAction) {
    const connection = supabaseConnection.get();

    if (!connection.token || !connection.credentials?.anonKey) {
      this.onSupabaseAlert?.({
        type: 'warning',
        title: 'Validation Skipped',
        description: 'Project not fully configured',
        content: 'Complete project setup before running validation.',
        source: 'supabase',
        operation: 'validate',
      });
      return { success: false, message: 'Project not configured' };
    }

    // Show validation starting
    this.onSupabaseAlert?.({
      type: 'info',
      title: 'Validating Project',
      description: 'Checking database connection and schema',
      content: 'Verifying your Supabase configuration...',
      source: 'supabase',
      stage: 'validating',
      operation: 'validate',
      progress: 30,
    });

    try {
      // Test basic connectivity with a simple query
      const testQuery = 'SELECT 1 as test_connection';
      const response = await fetch('/api/supabase/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${connection.token}`,
        },
        body: JSON.stringify({
          projectId: connection.selectedProjectId,
          query: testQuery,
        }),
      });

      if (!response.ok) {
        throw new Error('Database connection test failed');
      }

      // Show validation success
      this.onSupabaseAlert?.({
        type: 'success',
        title: 'Validation Complete',
        description: 'Project configuration is valid',
        content: 'Database connection established successfully. Your project is ready for development!',
        source: 'supabase',
        stage: 'complete',
        operation: 'validate',
        progress: 100,
      });

      return { success: true, message: 'Project validation successful' };
    } catch (error: any) {
      logger.error('Project validation failed:', error);

      this.onSupabaseAlert?.({
        type: 'error',
        title: 'Validation Failed',
        description: 'Project configuration issues detected',
        content: `${error.message}\n\nPlease check your project setup and try again.`,
        source: 'supabase',
        stage: 'complete',
        operation: 'validate',
      });

      throw error;
    }
  }

  async #handleProjectSeed(action: SupabaseAction) {
    const { content, filePath } = action;
    const connection = supabaseConnection.get();

    if (!connection.token || !connection.selectedProjectId) {
      throw new Error('Supabase project not configured for seeding');
    }

    // Show seeding started
    this.onSupabaseAlert?.({
      type: 'info',
      title: 'Seeding Database',
      description: 'Executing seed data scripts',
      content: 'Populating your database with initial data...',
      source: 'supabase',
      stage: 'executing',
      operation: 'seed',
      progress: 25,
    });

    try {
      // If a file path is provided, create the seed file first
      if (filePath) {
        await this.#runFileAction({
          type: 'file',
          filePath,
          content,
          changeSource: 'supabase',
        } as any);
      }

      // Execute the seed SQL
      const response = await fetch('/api/supabase/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${connection.token}`,
        },
        body: JSON.stringify({
          projectId: connection.selectedProjectId,
          query: content,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as SupabaseApiErrorResponse | null;
        const message =
          (typeof errorData?.error === 'string' ? errorData.error : errorData?.error?.message) ||
          errorData?.message ||
          'Seed execution failed';
        throw new Error(message);
      }

      const result = (await response.json()) as SupabaseQueryResponse;
      logger.debug('Seed data executed successfully:', result);

      // Show seeding success
      this.onSupabaseAlert?.({
        type: 'success',
        title: 'Database Seeded',
        description: 'Initial data loaded successfully',
        content: 'Your database has been populated with seed data and is ready for use!',
        source: 'supabase',
        stage: 'complete',
        operation: 'seed',
        progress: 100,
      });

      return { success: true, result };
    } catch (error: any) {
      logger.error('Database seeding failed:', error);

      this.onSupabaseAlert?.({
        type: 'error',
        title: 'Seeding Failed',
        description: 'Failed to execute seed data',
        content: `${error.message}\n\nPlease check your seed SQL and try again.`,
        source: 'supabase',
        stage: 'complete',
        operation: 'seed',
        rollbackAvailable: true,
      });

      throw error;
    }
  }

  // Add this method declaration to the class
  handleDeployAction(
    stage: 'building' | 'deploying' | 'complete',
    status: ActionStatus,
    details?: {
      url?: string;
      error?: string;
      source?: 'netlify' | 'vercel' | 'github' | 'gitlab';
    },
  ): void {
    if (!this.onDeployAlert) {
      logger.debug('No deploy alert handler registered');
      return;
    }

    const alertType = status === 'failed' ? 'error' : status === 'complete' ? 'success' : 'info';

    const title =
      stage === 'building'
        ? 'Building Application'
        : stage === 'deploying'
          ? 'Deploying Application'
          : 'Deployment Complete';

    const description =
      status === 'failed'
        ? `${stage === 'building' ? 'Build' : 'Deployment'} failed`
        : status === 'running'
          ? `${stage === 'building' ? 'Building' : 'Deploying'} your application...`
          : status === 'complete'
            ? `${stage === 'building' ? 'Build' : 'Deployment'} completed successfully`
            : `Preparing to ${stage === 'building' ? 'build' : 'deploy'} your application`;

    const buildStatus =
      stage === 'building' ? status : stage === 'deploying' || stage === 'complete' ? 'complete' : 'pending';

    const deployStatus = stage === 'building' ? 'pending' : status;

    this.onDeployAlert({
      type: alertType,
      title,
      description,
      content: details?.error || '',
      url: details?.url,
      stage,
      buildStatus: buildStatus as any,
      deployStatus: deployStatus as any,
      source: details?.source || 'netlify',
    });
  }

  async #validateShellCommand(command: string): Promise<{
    shouldModify: boolean;
    modifiedCommand?: string;
    warning?: string;
  }> {
    const trimmedCommand = command.trim();

    // Handle rm commands that might fail due to missing files
    if (trimmedCommand.startsWith('rm ') && !trimmedCommand.includes(' -f')) {
      const rmMatch = trimmedCommand.match(/^rm\s+(.+)$/);

      if (rmMatch) {
        const filePaths = rmMatch[1].split(/\s+/);

        // Check if any of the files exist using WebContainer
        try {
          const webcontainer = await this.#webcontainer;
          const existingFiles = [];

          for (const filePath of filePaths) {
            if (filePath.startsWith('-')) {
              continue;
            } // Skip flags

            try {
              await webcontainer.fs.readFile(filePath);
              existingFiles.push(filePath);
            } catch {
              // File doesn't exist, skip it
            }
          }

          if (existingFiles.length === 0) {
            // No files exist, modify command to use -f flag to avoid error
            return {
              shouldModify: true,
              modifiedCommand: `rm -f ${filePaths.join(' ')}`,
              warning: 'Added -f flag to rm command as target files do not exist',
            };
          } else if (existingFiles.length < filePaths.length) {
            // Some files don't exist, modify to only remove existing ones with -f for safety
            return {
              shouldModify: true,
              modifiedCommand: `rm -f ${filePaths.join(' ')}`,
              warning: 'Added -f flag to rm command as some target files do not exist',
            };
          }
        } catch (error) {
          logger.debug('Could not validate rm command files:', error);
        }
      }
    }

    // Handle cd commands to non-existent directories
    if (trimmedCommand.startsWith('cd ')) {
      const cdMatch = trimmedCommand.match(/^cd\s+(.+)$/);

      if (cdMatch) {
        const targetDir = cdMatch[1].trim();

        try {
          const webcontainer = await this.#webcontainer;
          await webcontainer.fs.readdir(targetDir);
        } catch {
          return {
            shouldModify: true,
            modifiedCommand: `mkdir -p ${targetDir} && cd ${targetDir}`,
            warning: 'Directory does not exist, created it first',
          };
        }
      }
    }

    // Handle cp/mv commands with missing source files
    if (trimmedCommand.match(/^(cp|mv)\s+/)) {
      const parts = trimmedCommand.split(/\s+/);

      if (parts.length >= 3) {
        const sourceFile = parts[1];

        try {
          const webcontainer = await this.#webcontainer;
          await webcontainer.fs.readFile(sourceFile);
        } catch {
          return {
            shouldModify: false,
            warning: `Source file '${sourceFile}' does not exist`,
          };
        }
      }
    }

    return { shouldModify: false };
  }

  #createEnhancedShellError(
    command: string,
    exitCode: number | undefined,
    output: string | undefined,
  ): {
    title: string;
    details: string;
  } {
    const trimmedCommand = command.trim();
    const firstWord = trimmedCommand.split(/\s+/)[0];

    // Common error patterns and their explanations
    const errorPatterns = [
      {
        pattern: /cannot remove.*No such file or directory/,
        title: 'File Not Found',
        getMessage: () => {
          const fileMatch = output?.match(/'([^']+)'/);
          const fileName = fileMatch ? fileMatch[1] : 'file';

          return `The file '${fileName}' does not exist and cannot be removed.\n\nSuggestion: Use 'ls' to check what files exist, or use 'rm -f' to ignore missing files.`;
        },
      },
      {
        pattern: /No such file or directory/,
        title: 'File or Directory Not Found',
        getMessage: () => {
          if (trimmedCommand.startsWith('cd ')) {
            const dirMatch = trimmedCommand.match(/cd\s+(.+)/);
            const dirName = dirMatch ? dirMatch[1] : 'directory';

            return `The directory '${dirName}' does not exist.\n\nSuggestion: Use 'mkdir -p ${dirName}' to create it first, or check available directories with 'ls'.`;
          }

          return `The specified file or directory does not exist.\n\nSuggestion: Check the path and use 'ls' to see available files.`;
        },
      },
      {
        pattern: /Permission denied/,
        title: 'Permission Denied',
        getMessage: () =>
          `Permission denied for '${firstWord}'.\n\nSuggestion: The file may not be executable. Try 'chmod +x filename' first.`,
      },
      {
        pattern: /command not found/,
        title: 'Command Not Found',
        getMessage: () =>
          `The command '${firstWord}' is not available in WebContainer.\n\nSuggestion: Check available commands or use a package manager to install it.`,
      },
      {
        pattern: /Is a directory/,
        title: 'Target is a Directory',
        getMessage: () =>
          `Cannot perform this operation - target is a directory.\n\nSuggestion: Use 'ls' to list directory contents or add appropriate flags.`,
      },
      {
        pattern: /File exists/,
        title: 'File Already Exists',
        getMessage: () => `File already exists.\n\nSuggestion: Use a different name or add '-f' flag to overwrite.`,
      },
    ];

    // Try to match known error patterns
    for (const errorPattern of errorPatterns) {
      if (output && errorPattern.pattern.test(output)) {
        return {
          title: errorPattern.title,
          details: errorPattern.getMessage(),
        };
      }
    }

    // Generic error with suggestions based on command type
    let suggestion = '';

    if (trimmedCommand.startsWith('npm ')) {
      suggestion = '\n\nSuggestion: Try running "npm install" first or check package.json.';
    } else if (trimmedCommand.startsWith('git ')) {
      suggestion = "\n\nSuggestion: Check if you're in a git repository or if remote is configured.";
    } else if (trimmedCommand.match(/^(ls|cat|rm|cp|mv)/)) {
      suggestion = '\n\nSuggestion: Check file paths and use "ls" to see available files.';
    }

    return {
      title: `Command Failed (exit code: ${exitCode})`,
      details: `Command: ${trimmedCommand}\n\nOutput: ${output || 'No output available'}${suggestion}`,
    };
  }
}
