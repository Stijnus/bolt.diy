import { atom, map, type MapStore, type ReadableAtom, type WritableAtom, computed } from 'nanostores';
import type { EditorDocument, ScrollPosition } from '~/components/editor/codemirror/CodeMirrorEditor';
import { ActionRunner } from '~/lib/runtime/action-runner';
import type { ActionCallbackData, ArtifactCallbackData } from '~/lib/runtime/message-parser';
import { webcontainer } from '~/lib/webcontainer';
import type { ITerminal } from '~/types/terminal';
import { unreachable } from '~/utils/unreachable';
import { EditorStore } from './editor';
import { FilesStore, type FileMap } from './files';
import { PreviewsStore } from './previews';
import { TerminalStore } from './terminal';
import JSZip from 'jszip';
import fileSaver from 'file-saver';
import { Octokit, type RestEndpointMethodTypes } from '@octokit/rest';
import { path } from '~/utils/path';
import { extractRelativePath } from '~/utils/diff';
import { description } from '~/lib/persistence';
import Cookies from 'js-cookie';
import { createSampler } from '~/utils/sampler';
import type { ActionAlert } from '~/types/actions';
import type { SyncSettings, SyncSession, ProjectSyncInfo } from '~/types/sync';
import { toast } from 'react-toastify';
import ignore from 'ignore';
import { ProjectFolderManager } from '~/lib/persistence/project-folders';
import { clearSyncFolderHandle, loadSyncFolderHandle, saveSyncFolderHandle } from '~/lib/persistence/sync-folder';
import { getLocalStorage, setLocalStorage } from '~/lib/persistence';
import { syncSidebarStore } from './sync-sidebar';

// Destructure saveAs from the CommonJS module
const { saveAs } = fileSaver;

export interface ArtifactState {
  id: string;
  title: string;
  type?: string;
  closed: boolean;
  runner: ActionRunner;
}

export type ArtifactUpdateState = Pick<ArtifactState, 'title' | 'closed'>;

type Artifacts = MapStore<Record<string, ArtifactState>>;

export type WorkbenchViewType = 'code' | 'preview';

export class WorkbenchStore {
  #previewsStore = new PreviewsStore(webcontainer);
  #filesStore = new FilesStore(webcontainer);
  #editorStore = new EditorStore(this.#filesStore);
  #terminalStore = new TerminalStore(webcontainer);

  #reloadedMessages = new Set<string>();
  #knownFileStates = new Map<string, { content: string; timestamp: number }>();

  artifacts: Artifacts = import.meta.hot?.data.artifacts ?? map({});

  showWorkbench: WritableAtom<boolean> = import.meta.hot?.data.showWorkbench ?? atom(false);
  currentView: WritableAtom<WorkbenchViewType> = import.meta.hot?.data.currentView ?? atom('code');
  unsavedFiles: WritableAtom<Set<string>> = import.meta.hot?.data.unsavedFiles ?? atom(new Set<string>());
  actionAlert: WritableAtom<ActionAlert | undefined> =
    import.meta.hot?.data.unsavedFiles ?? atom<ActionAlert | undefined>(undefined);
  modifiedFiles = new Set<string>();
  artifactIdList: string[] = [];
  #globalExecutionQueue = Promise.resolve();
  syncFolder: WritableAtom<FileSystemDirectoryHandle | null> = import.meta.hot?.data.syncFolder ?? atom(null);
  syncSettings: WritableAtom<SyncSettings> =
    import.meta.hot?.data.syncSettings ??
    atom({
      autoSync: false,
      syncOnSave: false,
      excludePatterns: ['node_modules/**', '*.log', '.DS_Store'],
      syncMode: 'ask',
      projectFolders: {},
      defaultSyncEnabled: true,
    });
  currentSession: WritableAtom<SyncSession | null> = import.meta.hot?.data.currentSession ?? atom(null);
  syncIntervalId?: NodeJS.Timeout;

  #isInitializing = false;
  #lastSyncTimestamp = 0;

  // State for conflict resolution dialog
  conflictResolutionState: WritableAtom<{ filePath: string; resolvePromise: (resolution: 'local' | 'remote' | 'cancel') => void; } | null> = atom(null);

  isSyncEnabled = computed([this.currentSession, this.syncSettings], (session, settings) => {
    if (!session?.projectName) {
      return settings.defaultSyncEnabled;
    }

    const projectInfo = settings.projectFolders[session.projectName];

    return projectInfo?.syncEnabled ?? settings.defaultSyncEnabled;
  });

  syncStatus = computed(
    [this.currentSession, this.syncFolder, this.syncSettings, this.unsavedFiles],
    (session, folder, settings, unsavedFiles) => ({
      isReady: !!folder && !!session && unsavedFiles.size === 0,
      lastSync: session?.lastSync ? new Date(session.lastSync).toLocaleTimeString() : undefined,
      projectName: session?.projectName,
      folderName: folder?.name,
      totalFiles: session?.files?.size || 0,
      totalSize: this._calculateTotalSize(session),
      autoSync: settings.autoSync,
      syncOnSave: settings.syncOnSave,
      hasUnsavedChanges: unsavedFiles.size > 0,
    }),
  );

  syncHistory = computed([this.currentSession], (session) => {
    if (!session?.history) {
      return [];
    }

    return [...session.history].sort((a, b) => b.timestamp - a.timestamp);
  });

  constructor() {
    if (import.meta.hot) {
      import.meta.hot.data.artifacts = this.artifacts;
      import.meta.hot.data.unsavedFiles = this.unsavedFiles;
      import.meta.hot.data.showWorkbench = this.showWorkbench;
      import.meta.hot.data.currentView = this.currentView;
      import.meta.hot.data.actionAlert = this.actionAlert;
      import.meta.hot.data.syncSettings = this.syncSettings;
      import.meta.hot.data.syncFolder = this.syncFolder;
      import.meta.hot.data.currentSession = this.currentSession;
    }

    // Load saved sync settings
    this.loadSyncSettings();

    // Subscribe to sync settings changes to persist them and update sync interval
    this.syncSettings.subscribe((settings) => {
      setLocalStorage('syncSettings', settings);

      // Clear existing interval if any
      if (this.syncIntervalId) {
        clearInterval(this.syncIntervalId);
      }

      // Set up new interval if auto-sync is enabled
      if (settings.autoSync) {
        const intervalMs = settings.autoSyncInterval * 60 * 1000;
        this.syncIntervalId = setInterval(() => {
          const session = this.currentSession.get();
          const folder = this.syncFolder.get();

          if (folder && session) {
            this.syncFiles().catch(console.error);
          }
        }, intervalMs);
      }
    });

    // Set up auto-sync interval
    const settings = this.syncSettings.get();
    const session = this.currentSession.get();
    const folder = this.syncFolder.get();

    if (settings.autoSync && folder && session) {
      const now = Date.now();
      const timeSinceLastSync = now - session.lastSync;
      const intervalMs = settings.autoSyncInterval * 60 * 1000;

      if (timeSinceLastSync >= intervalMs) {
        this.syncFiles().catch(console.error);
      }
    }
  }

  addToExecutionQueue(callback: () => Promise<void>) {
    this.#globalExecutionQueue = this.#globalExecutionQueue.then(() => callback());
  }

  get previews() {
    return this.#previewsStore.previews;
  }

  get files() {
    return this.#filesStore.files;
  }

  get currentDocument(): ReadableAtom<EditorDocument | undefined> {
    return this.#editorStore.currentDocument;
  }

  get selectedFile(): ReadableAtom<string | undefined> {
    return this.#editorStore.selectedFile;
  }

  get firstArtifact(): ArtifactState | undefined {
    return this.#getArtifact(this.artifactIdList[0]);
  }

  get filesCount(): number {
    return this.#filesStore.filesCount;
  }

  get showTerminal() {
    return this.#terminalStore.showTerminal;
  }
  get boltTerminal() {
    return this.#terminalStore.boltTerminal;
  }
  get alert() {
    return this.actionAlert;
  }
  clearAlert() {
    this.actionAlert.set(undefined);
  }

  toggleTerminal(value?: boolean) {
    this.#terminalStore.toggleTerminal(value);
  }

  attachTerminal(terminal: ITerminal) {
    this.#terminalStore.attachTerminal(terminal);
  }
  attachBoltTerminal(terminal: ITerminal) {
    this.#terminalStore.attachBoltTerminal(terminal);
  }

  onTerminalResize(cols: number, rows: number) {
    this.#terminalStore.onTerminalResize(cols, rows);
  }

  setDocuments(files: FileMap) {
    this.#editorStore.setDocuments(files);

    if (this.#filesStore.filesCount > 0 && this.currentDocument.get() === undefined) {
      // we find the first file and select it
      for (const [filePath, dirent] of Object.entries(files)) {
        if (dirent?.type === 'file') {
          this.setSelectedFile(filePath);
          break;
        }
      }
    }
  }

  setShowWorkbench(show: boolean) {
    this.showWorkbench.set(show);
  }

  setCurrentDocumentContent(newContent: string) {
    const filePath = this.currentDocument.get()?.filePath;

    if (!filePath) {
      return;
    }

    const originalContent = this.#filesStore.getFile(filePath)?.content;
    const unsavedChanges = originalContent !== undefined && originalContent !== newContent;

    this.#editorStore.updateFile(filePath, newContent);

    const currentDocument = this.currentDocument.get();

    if (currentDocument) {
      const previousUnsavedFiles = this.unsavedFiles.get();

      if (unsavedChanges && previousUnsavedFiles.has(currentDocument.filePath)) {
        return;
      }

      const newUnsavedFiles = new Set(previousUnsavedFiles);

      if (unsavedChanges) {
        newUnsavedFiles.add(currentDocument.filePath);
      } else {
        newUnsavedFiles.delete(currentDocument.filePath);
      }

      this.unsavedFiles.set(newUnsavedFiles);
    }
  }

  setCurrentDocumentScrollPosition(position: ScrollPosition) {
    const editorDocument = this.currentDocument.get();

    if (!editorDocument) {
      return;
    }

    const { filePath } = editorDocument;

    this.#editorStore.updateScrollPosition(filePath, position);
  }

  setSelectedFile(filePath: string | undefined) {
    this.#editorStore.setSelectedFile(filePath);
  }

  async saveFile(filePath: string) {
    const documents = this.#editorStore.documents.get();
    const document = documents[filePath];

    if (document === undefined) {
      return;
    }

    await this.#filesStore.saveFile(filePath, document.value);

    const newUnsavedFiles = new Set(this.unsavedFiles.get());
    newUnsavedFiles.delete(filePath);

    this.unsavedFiles.set(newUnsavedFiles);
  }

  async saveCurrentDocument() {
    const currentDocument = this.currentDocument.get();

    if (currentDocument === undefined) {
      return;
    }

    await this.saveFile(currentDocument.filePath);
  }

  resetCurrentDocument() {
    const currentDocument = this.currentDocument.get();

    if (currentDocument === undefined) {
      return;
    }

    const { filePath } = currentDocument;
    const file = this.#filesStore.getFile(filePath);

    if (!file) {
      return;
    }

    this.setCurrentDocumentContent(file.content);
  }

  async saveAllFiles() {
    for (const filePath of this.unsavedFiles.get()) {
      await this.saveFile(filePath);
    }
  }

  getFileModifcations() {
    return this.#filesStore.getFileModifications();
  }

  resetAllFileModifications() {
    this.#filesStore.resetFileModifications();
  }

  abortAllActions() {
    // TODO: what do we wanna do and how do we wanna recover from this?
  }

  setReloadedMessages(messages: string[]) {
    this.#reloadedMessages = new Set(messages);
  }

  addArtifact({ messageId, title, id, type }: ArtifactCallbackData) {
    const artifact = this.#getArtifact(messageId);

    if (artifact) {
      return;
    }

    if (!this.artifactIdList.includes(messageId)) {
      this.artifactIdList.push(messageId);
    }

    this.artifacts.setKey(messageId, {
      id,
      title,
      closed: false,
      type,
      runner: new ActionRunner(
        webcontainer,
        () => this.boltTerminal,
        (alert) => {
          if (this.#reloadedMessages.has(messageId)) {
            return;
          }

          this.actionAlert.set(alert);
        },
      ),
    });
  }

  updateArtifact({ messageId }: ArtifactCallbackData, state: Partial<ArtifactUpdateState>) {
    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      return;
    }

    this.artifacts.setKey(messageId, { ...artifact, ...state });
  }
  addAction(data: ActionCallbackData) {
    // this._addAction(data);

    this.addToExecutionQueue(() => this._addAction(data));
  }
  async _addAction(data: ActionCallbackData) {
    const { messageId } = data;

    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      unreachable('Artifact not found');
    }

    return artifact.runner.addAction(data);
  }

  runAction(data: ActionCallbackData, isStreaming: boolean = false) {
    if (isStreaming) {
      this.actionStreamSampler(data, isStreaming);
    } else {
      this.addToExecutionQueue(() => this._runAction(data, isStreaming));
    }
  }
  async _runAction(data: ActionCallbackData, isStreaming: boolean = false) {
    const { messageId } = data;

    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      unreachable('Artifact not found');
    }

    const action = artifact.runner.actions.get()[data.actionId];

    if (!action || action.executed) {
      return;
    }

    if (data.action.type === 'file') {
      const wc = await webcontainer;
      const fullPath = path.join(wc.workdir, data.action.filePath);

      if (this.selectedFile.value !== fullPath) {
        this.setSelectedFile(fullPath);
      }

      if (this.currentView.value !== 'code') {
        this.currentView.set('code');
      }

      const doc = this.#editorStore.documents.get()[fullPath];

      if (!doc) {
        await artifact.runner.runAction(data, isStreaming);
      }

      this.#editorStore.updateFile(fullPath, data.action.content);

      if (!isStreaming) {
        await artifact.runner.runAction(data);
        this.resetAllFileModifications();
      }
    } else {
      await artifact.runner.runAction(data);
    }
  }

  actionStreamSampler = createSampler(async (data: ActionCallbackData, isStreaming: boolean = false) => {
    return await this._runAction(data, isStreaming);
  }, 100); // TODO: remove this magic number to have it configurable

  #getArtifact(id: string) {
    const artifacts = this.artifacts.get();
    return artifacts[id];
  }

  async downloadZip() {
    const zip = new JSZip();
    const files = this.files.get();

    // Get the project name from the description input, or use a default name
    const projectName = (description.value ?? 'project').toLocaleLowerCase().split(' ').join('_');

    // Generate a simple 6-character hash based on the current timestamp
    const timestampHash = Date.now().toString(36).slice(-6);
    const uniqueProjectName = `${projectName}_${timestampHash}`;

    for (const [filePath, dirent] of Object.entries(files)) {
      if (dirent?.type === 'file' && !dirent.isBinary) {
        const relativePath = extractRelativePath(filePath);

        // split the path into segments
        const pathSegments = relativePath.split('/');

        // if there's more than one segment, we need to create folders
        if (pathSegments.length > 1) {
          let currentFolder = zip;

          for (let i = 0; i < pathSegments.length - 1; i++) {
            currentFolder = currentFolder.folder(pathSegments[i])!;
          }
          currentFolder.file(pathSegments[pathSegments.length - 1], dirent.content);
        } else {
          // if there's only one segment, it's a file in the root
          zip.file(relativePath, dirent.content);
        }
      }
    }

    // Generate the zip file and save it
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${uniqueProjectName}.zip`);
  }

  async syncFiles(): Promise<void> {
    const now = Date.now();

    // Prevent syncs that are too close together (within 500ms)
    if (now - this.#lastSyncTimestamp < 500) {
      return;
    }

    this.#lastSyncTimestamp = now;

    const status = this.syncStatus.get();
    const isSyncEnabled = this.isSyncEnabled.get();

    // Skip sync if disabled for this project
    if (!isSyncEnabled) {
      console.log('Sync skipped - disabled for this project');
      return;
    }

    if (!status.isReady) {
      if (!this.syncFolder.get()) {
        // Don't show error if we're in initial setup
        if (this.currentSession.get()) {
          toast.error('No sync folder selected. Please select a folder first.');
        }

        return;
      }

      if (status.hasUnsavedChanges) {
        toast.info('Saving unsaved changes before sync...');
        await this.saveAllFiles();
      }
    }

    const folder = this.syncFolder.get();
    const session = this.currentSession.get();

    if (!folder || !session) {
      return;
    }

    try {
      const syncedFiles = new Set<string>();
      const changedFiles = new Set<string>();
      const newFiles = new Set<string>();
      let totalSize = 0;
      const startTime = Date.now();

      // Get project name from description or session
      const rawProjectName = description.value ?? 'project';
      const folderManager = ProjectFolderManager.getInstance();

      try {
        // This will only create a new folder if the project is truly new
        const { folderHandle: projectFolder, projectInfo } = await folderManager.getOrCreateProjectFolder(
          folder,
          rawProjectName,
          true, // Allow creation only for new projects
        );

        // Update session with current project folder and name
        const updatedSession = { ...session };
        updatedSession.projectFolder = projectFolder.name;
        updatedSession.projectName = projectInfo.projectName;
        this.currentSession.set(updatedSession);

        // Create ignore instance with exclude patterns
        const ig = ignore().add(this.syncSettings.get().excludePatterns);

        // Show progress toast
        const progressToastId = toast.loading('Starting sync...', { autoClose: false });
        let processedFiles = 0;

        const filesToProcess = Object.entries(this.files.get()).filter(([_, dirent]) => {
          if (!dirent || dirent.type !== 'file' || dirent.isBinary) {
            return false;
          }

          return true;
        });

        const totalFiles = filesToProcess.length;

        for (const [filePath, dirent] of filesToProcess) {
          if (!dirent || dirent.type !== 'file' || typeof dirent.content !== 'string') {
            console.log(`Skipping invalid file: ${filePath}`);
            continue;
          }

          processedFiles++;
          toast.update(progressToastId, {
            render: `Analyzing files... ${processedFiles}/${totalFiles}`,
          });

          const relativePath = extractRelativePath(filePath);

          // Skip files that match exclude patterns
          if (ig.ignores(relativePath)) {
            console.log(`Skipping excluded file: ${relativePath}`);
            continue;
          }

          const pathSegments = relativePath.split('/');
          let currentHandle = projectFolder;

          // Navigate to the correct directory
          for (let i = 0; i < pathSegments.length - 1; i++) {
            currentHandle = await currentHandle.getDirectoryHandle(pathSegments[i], { create: true });
          }

          const fileName = pathSegments[pathSegments.length - 1];
          let shouldWrite = true;

          // Check if file exists and compare content
          try {
            const existingFile = await currentHandle.getFileHandle(fileName);
            const existingContent = await existingFile.getFile().then((file) => file.text());
            const knownState = this.#knownFileStates.get(relativePath);

            if (existingContent !== dirent.content) {
              // Check if this is a new file or if we've seen it before
              const isInitialSync = !updatedSession.lastSync;
              const isKnownFile = knownState !== undefined;
              const hasLocalChanges = knownState?.content !== dirent.content;
              const hasRemoteChanges = knownState?.content !== existingContent;

              // Only prompt if we have a genuine conflict
              if (!isInitialSync && isKnownFile && hasLocalChanges && hasRemoteChanges) {
                const currentSyncMode = this.syncSettings.get().syncMode;
                if (currentSyncMode === 'ask') {
                  // Use the new dialog flow
                  const userChoice = await new Promise<'local' | 'remote' | 'cancel'>((resolve) => {
                    this.conflictResolutionState.set({ filePath: relativePath, resolvePromise: resolve });
                  });

                  this.conflictResolutionState.set(null); // Clear state after choice

                  if (userChoice === 'local') {
                    shouldWrite = true;
                    changedFiles.add(relativePath);
                    console.log(`User chose to update with local changes: ${relativePath}`);
                  } else if (userChoice === 'remote') {
                    shouldWrite = false;
                    console.log(`User chose to keep remote version: ${relativePath}`);
                  } else { // 'cancel'
                    shouldWrite = false; // Treat cancel as skip for this file
                    console.log(`User cancelled, keeping remote version for: ${relativePath}`);
                  }
                } else if (currentSyncMode === 'skip') {
                  shouldWrite = false;
                  console.log(`Skipping changed file due to 'skip' mode: ${relativePath}`);
                } else { // 'overwrite'
                  shouldWrite = true;
                  changedFiles.add(relativePath);
                  console.log(`Overwriting file due to 'overwrite' mode: ${relativePath}`);
                }
              } else {
                // For initial sync or non-conflicting changes, or if not 'ask' mode, just update if local content is different
                if (dirent.content !== existingContent) {
                  changedFiles.add(relativePath);
                }
                // shouldWrite remains true by default if not a conflict or conflict handled by overwrite
              }
            }

            // Update known state after handling the file
            this.#knownFileStates.set(relativePath, {
              content: shouldWrite ? dirent.content : existingContent,
              timestamp: Date.now(),
            });
          } catch {
            // File doesn't exist
            newFiles.add(relativePath);
            console.log(`New file to sync: ${relativePath}`);

            // Track new file state
            this.#knownFileStates.set(relativePath, {
              content: dirent.content,
              timestamp: Date.now(),
            });
          }

          if (shouldWrite) {
            const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            const fileContent = new Blob([dirent.content]);
            totalSize += fileContent.size;
            await writable.write(fileContent);
            await writable.close();
            syncedFiles.add(relativePath);
            updatedSession.files.add(relativePath);
          }
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Create statistics entry
        const statistics = {
          totalFiles: syncedFiles.size,
          syncedFiles: syncedFiles.size,
          totalSize,
          duration,
          timestamp: endTime,
        };

        // Create history entry
        const historyEntry = {
          id: crypto.randomUUID(),
          projectName: updatedSession.projectName || description.value || 'Untitled Project',
          timestamp: endTime,
          statistics,
          files: Array.from(syncedFiles),
          status: 'success' as const,
        };

        // Update session with new history and statistics
        updatedSession.lastSync = endTime;
        updatedSession.history = [...(updatedSession.history || []), historyEntry];
        updatedSession.statistics = [...(updatedSession.statistics || []), statistics];

        // Force a store update to trigger UI reactivity
        this.currentSession.set({ ...updatedSession });

        // Close progress toast
        toast.dismiss(progressToastId);

        // Provide detailed summary feedback
        if (syncedFiles.size > 0) {
          const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
          const durationSec = (duration / 1000).toFixed(1);
          const newCount = newFiles.size;
          const changedCount = changedFiles.size;

          let message =
            `Synced ${syncedFiles.size} file${syncedFiles.size !== 1 ? 's' : ''} ` +
            `(${sizeMB} MB) in ${durationSec}s\n`;

          if (newCount > 0) {
            message += `\n• ${newCount} new file${newCount !== 1 ? 's' : ''}`;
          }

          if (changedCount > 0) {
            message += `\n• ${changedCount} changed file${changedCount !== 1 ? 's' : ''}`;
          }

          toast.success(message);
        } else {
          toast.info('All files are up to date');
        }
      } catch (error) {
        console.error('Error syncing project:', error);
        toast.dismiss();
        throw error;
      }
    } catch (error) {
      console.error('Sync failed:', error);
      toast.error('Failed to sync files');
      throw error;
    }
  }

  async pushToGitHub(
    repoName: string,
    commitMessage?: string,
    githubUsername?: string,
    ghToken?: string,
    isPrivate: boolean = false,
  ) {
    try {
      // Use cookies if username and token are not provided
      const githubToken = ghToken || Cookies.get('githubToken');
      const owner = githubUsername || Cookies.get('githubUsername');

      if (!githubToken || !owner) {
        throw new Error('GitHub token or username is not set in cookies or provided.');
      }

      // Initialize Octokit with the auth token
      const octokit = new Octokit({ auth: githubToken });

      // Check if the repository already exists before creating it
      let repo: RestEndpointMethodTypes['repos']['get']['response']['data'];

      try {
        const resp = await octokit.repos.get({ owner, repo: repoName });
        repo = resp.data;
      } catch (error) {
        if (error instanceof Error && 'status' in error && error.status === 404) {
          // Repository doesn't exist, so create a new one
          const { data: newRepo } = await octokit.repos.createForAuthenticatedUser({
            name: repoName,
            private: isPrivate,
            auto_init: true,
          });
          repo = newRepo;
        } else {
          console.log('cannot create repo!');
          throw error; // Some other error occurred
        }
      }

      // Get all files
      const files = this.files.get();

      if (!files || Object.keys(files).length === 0) {
        throw new Error('No files found to push');
      }

      // Create blobs for each file
      const blobs = await Promise.all(
        Object.entries(files).map(async ([filePath, dirent]) => {
          if (dirent?.type === 'file' && dirent.content) {
            const { data: blob } = await octokit.git.createBlob({
              owner: repo.owner.login,
              repo: repo.name,
              content: Buffer.from(dirent.content).toString('base64'),
              encoding: 'base64',
            });
            return { path: extractRelativePath(filePath), sha: blob.sha };
          }

          return null;
        }),
      );

      const validBlobs = blobs.filter(Boolean); // Filter out any undefined blobs

      if (validBlobs.length === 0) {
        throw new Error('No valid files to push');
      }

      // Get the latest commit SHA (assuming main branch, update dynamically if needed)
      const { data: ref } = await octokit.git.getRef({
        owner: repo.owner.login,
        repo: repo.name,
        ref: `heads/${repo.default_branch || 'main'}`, // Handle dynamic branch
      });
      const latestCommitSha = ref.object.sha;

      // Create a new tree
      const { data: newTree } = await octokit.git.createTree({
        owner: repo.owner.login,
        repo: repo.name,
        base_tree: latestCommitSha,
        tree: validBlobs.map((blob) => ({
          path: blob!.path,
          mode: '100644',
          type: 'blob',
          sha: blob!.sha,
        })),
      });

      // Create a new commit
      const { data: newCommit } = await octokit.git.createCommit({
        owner: repo.owner.login,
        repo: repo.name,
        message: commitMessage || 'Initial commit from your app',
        tree: newTree.sha,
        parents: [latestCommitSha],
      });

      // Update the reference
      await octokit.git.updateRef({
        owner: repo.owner.login,
        repo: repo.name,
        ref: `heads/${repo.default_branch || 'main'}`, // Handle dynamic branch
        sha: newCommit.sha,
      });

      return repo.html_url; // Return the URL instead of showing alert
    } catch (error) {
      console.error('Error pushing to GitHub:', error);
      throw error; // Rethrow the error for further handling
    }
  }

  async setSyncFolder(handle: FileSystemDirectoryHandle | null) {
    this.syncFolder.set(handle);

    if (handle) {
      try {
        const testDirName = '.bolt_test_' + Date.now();

        // Verify we have write permission by attempting to create a test directory
        await handle.getDirectoryHandle(testDirName, { create: true });

        // Clean up test directory
        await handle.removeEntry(testDirName);

        // Save the handle to IndexedDB for persistence
        await saveSyncFolderHandle(handle);

        // Dismiss any existing sync folder notifications
        toast.dismiss('sync-folder-not-set');

        // Show success message
        toast.success(`Sync folder set to: ${handle.name}`);

        console.log('Sync folder write permission verified');
      } catch (error) {
        console.error('Failed to verify sync folder permissions:', error);
        toast.error('Unable to write to selected folder. Please choose a different folder.');
        this.syncFolder.set(null);
        await clearSyncFolderHandle();
      }
    } else {
      await clearSyncFolderHandle();
    }
  }

  async showSimpleSyncDialog(_projectName: string): Promise<void> {
    // Instead of showing a dialog, open the sync sidebar
    syncSidebarStore.open();
    return Promise.resolve();
  }

  async initializeSession() {
    // Prevent concurrent initializations
    if (this.#isInitializing) {
      return;
    }

    this.#isInitializing = true;

    try {
      // Try to restore sync folder from IndexedDB
      const savedHandle = await loadSyncFolderHandle();

      if (savedHandle) {
        this.syncFolder.set(savedHandle);
      }

      // Get project name and settings
      const rawProjectName = description.value ?? 'project';
      const settings = this.syncSettings.get();

      const session: SyncSession = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        lastSync: Date.now(),
        files: new Set(),
        history: [],
        statistics: [],
      };

      // Find existing project by name
      const existingProject = Object.values(settings.projectFolders).find((p) => p.projectName === rawProjectName);

      // Instead of showing a dialog, use the existing sync settings or defaults
      const shouldSync = existingProject ? existingProject.syncEnabled : settings.defaultSyncEnabled;

      // Update session with project info
      if (existingProject) {
        session.projectName = existingProject.projectName;
        session.projectFolder = existingProject.folderName;
      } else {
        session.projectName = rawProjectName;
        session.projectFolder = rawProjectName;
      }

      // Set the current session
      this.currentSession.set(session);

      // If sync is enabled and we have a folder, start syncing
      if (shouldSync && this.syncFolder.get()) {
        await this.syncFiles();
      }

      // If sync is enabled but we don't have a folder, show the sidebar
      if (shouldSync && !this.syncFolder.get()) {
        syncSidebarStore.open();
      }
    } catch (error) {
      console.error('Failed to initialize sync session:', error);
      toast.error('Failed to initialize sync session');
    } finally {
      this.#isInitializing = false;
    }
  }

  // Helper method to open sync settings
  openSyncSettings() {
    // Try to find settings button with multiple selectors
    const settingsButton =
      document.querySelector('[data-settings-button]') ||
      document.querySelector('.settings-button') ||
      Array.from(document.querySelectorAll('button')).find((btn) =>
        btn.textContent?.toLowerCase().includes('settings'),
      );

    if (settingsButton) {
      // Click the settings button
      (settingsButton as HTMLButtonElement).click();

      // After settings dialog opens, try to find and click the Sync tab
      setTimeout(() => {
        const syncTab =
          document.querySelector('[data-sync-settings-tab]') ||
          document.querySelector('.sync-settings-tab') ||
          Array.from(document.querySelectorAll('button')).find((btn) =>
            btn.textContent?.toLowerCase().includes('sync'),
          );

        if (syncTab) {
          (syncTab as HTMLButtonElement).click();
        } else {
          console.warn('Could not find sync settings tab');
        }
      }, 200); // Increased timeout to ensure dialog is fully open
    } else {
      console.warn('Could not find settings button');

      // Show a more helpful message to the user
      toast.info('Click the Settings button and go to Sync Settings to configure sync', {
        autoClose: 5000,
      });
    }
  }

  async loadSyncSettings() {
    const savedSettings = getLocalStorage('syncSettings');

    if (savedSettings) {
      this.syncSettings.set({
        ...this.syncSettings.get(),
        ...savedSettings,

        // Ensure new fields have default values
        autoSyncInterval: savedSettings.autoSyncInterval ?? 5, // Default to 5 minutes
        projectFolders: savedSettings.projectFolders ?? {},
      });
    } else {
      // Initialize with default values
      this.syncSettings.set({
        ...this.syncSettings.get(),
        autoSyncInterval: 5,
        projectFolders: {},
      });
    }
  }

  async saveSyncSettings(settings: SyncSettings) {
    this.syncSettings.set(settings);
    setLocalStorage('syncSettings', settings);
  }

  private _normalizeProjectName(name: string): string {
    // First, remove any timestamp suffix if it exists
    const baseNameWithoutTimestamp = name.replace(/_[a-z0-9]{6}$/, '');

    // Then normalize the remaining string
    return baseNameWithoutTimestamp
      .toLowerCase()
      .replace(/[^a-z0-9_\s-]/g, '')
      .replace(/[\s-]+/g, '_')
      .trim();
  }

  private _findExistingProject(projectName: string): { projectInfo: ProjectSyncInfo | null; baseProjectName: string } {
    const settings = this.syncSettings.get();
    const normalizedName = this._normalizeProjectName(projectName);

    // First try exact match without timestamp
    for (const [, info] of Object.entries(settings.projectFolders)) {
      const normalizedInfoName = this._normalizeProjectName(info.projectName);

      if (normalizedInfoName === normalizedName) {
        return { projectInfo: info, baseProjectName: normalizedName };
      }
    }

    return { projectInfo: null, baseProjectName: normalizedName };
  }

  private _calculateTotalSize(session: SyncSession | null): string {
    if (!session?.statistics?.length) {
      return '0 B';
    }

    const lastStats = session.statistics[session.statistics.length - 1];
    const bytes = lastStats.totalSize;

    if (bytes === 0) {
      return '0 B';
    }

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  async toggleProjectSync(enabled: boolean) {
    const session = this.currentSession.get();

    if (!session?.projectName) {
      return;
    }

    const settings = this.syncSettings.get();
    const projectInfo = settings.projectFolders[session.projectName] || {
      projectName: session.projectName,
      folderName: session.projectFolder || '',
      lastSync: Date.now(),
      syncEnabled: settings.defaultSyncEnabled,
    };

    projectInfo.syncEnabled = enabled;

    const newSettings = {
      ...settings,
      projectFolders: {
        ...settings.projectFolders,
        [session.projectName]: projectInfo,
      },
    };

    await this.saveSyncSettings(newSettings);

    // Show feedback to user
    toast.success(`Sync ${enabled ? 'enabled' : 'disabled'} for ${session.projectName}`);
  }

  async setDefaultSyncEnabled(enabled: boolean) {
    const settings = this.syncSettings.get();
    await this.saveSyncSettings({
      ...settings,
      defaultSyncEnabled: enabled,
    });

    toast.success(`New projects will be ${enabled ? 'synced' : 'not synced'} by default`);
  }
}

export const workbenchStore = new WorkbenchStore();
