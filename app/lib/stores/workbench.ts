import { atom, map, type MapStore, type ReadableAtom, type WritableAtom } from 'nanostores';

// Try to load locked files from localStorage first, if available
let initialLockedFiles = new Set<string>();

try {
  if (typeof localStorage !== 'undefined') {
    const lockedFilesJson = localStorage.getItem('bolt-locked-files');

    if (lockedFilesJson) {
      const lockedFilesArray = JSON.parse(lockedFilesJson);

      if (Array.isArray(lockedFilesArray)) {
        initialLockedFiles = new Set(lockedFilesArray);
      }
    }
  }
} catch (error) {
  console.error('Failed to load locked files from localStorage', error);
}

export const lockedFilesAtom: WritableAtom<Set<string>> = atom(initialLockedFiles);

// Function to persist locked files to localStorage
export function persistLockedFiles(lockedFiles: Set<string>) {
  try {
    if (typeof localStorage !== 'undefined') {
      const lockedFilesArray = [...lockedFiles];
      localStorage.setItem('bolt-locked-files', JSON.stringify(lockedFilesArray));
      console.log('Persisted locked files:', lockedFilesArray);
    }
  } catch (error) {
    console.error('Failed to persist locked files to localStorage', error);
  }
}

// Helper function to normalize paths consistently
function normalizePath(filePath: string): string {
  // Remove potential workdir prefixes like /home/project/
  let normalizedPath = filePath;

  // If it starts with the webcontainer workdir, strip it
  const workdirPrefix = '/home/project/';

  if (normalizedPath.startsWith(workdirPrefix)) {
    normalizedPath = normalizedPath.substring(workdirPrefix.length);
  }

  // Remove any leading slashes
  while (normalizedPath.startsWith('/')) {
    normalizedPath = normalizedPath.substring(1);
  }

  return normalizedPath;
}

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
import type { ActionAlert, DeployAlert, SupabaseAlert } from '~/types/actions';
import { toast } from 'react-toastify';
import { logger } from '~/utils/logger';

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

export type WorkbenchViewType = 'code' | 'diff' | 'preview';

export class WorkbenchStore {
  #previewsStore = new PreviewsStore(webcontainer);
  #filesStore = new FilesStore(
    webcontainer,

    // Pass the lock check function to the FilesStore
    (filePath: string) => this.isFileLocked(filePath),
  );
  #editorStore = new EditorStore(this.#filesStore);
  #terminalStore = new TerminalStore(webcontainer);

  #reloadedMessages = new Set<string>();

  artifacts: Artifacts = import.meta.hot?.data.artifacts ?? map({});

  showWorkbench: WritableAtom<boolean> = import.meta.hot?.data.showWorkbench ?? atom(false);
  currentView: WritableAtom<WorkbenchViewType> = import.meta.hot?.data.currentView ?? atom('code');
  unsavedFiles: WritableAtom<Set<string>> = import.meta.hot?.data.unsavedFiles ?? atom(new Set<string>());

  // Initialize the class's lockedFiles from lockedFilesAtom
  lockedFiles: WritableAtom<Set<string>> =
    import.meta.hot?.data.lockedFiles ?? atom(new Set([...lockedFilesAtom.get()]));

  actionAlert: WritableAtom<ActionAlert | undefined> =
    import.meta.hot?.data.actionAlert ?? atom<ActionAlert | undefined>(undefined);
  supabaseAlert: WritableAtom<SupabaseAlert | undefined> =
    import.meta.hot?.data.supabaseAlert ?? atom<SupabaseAlert | undefined>(undefined);
  deployAlert: WritableAtom<DeployAlert | undefined> =
    import.meta.hot?.data.deployAlert ?? atom<DeployAlert | undefined>(undefined);
  modifiedFiles: Set<string> = new Set();
  artifactIdList: string[] = [];
  #globalExecutionQueue = Promise.resolve();

  constructor() {
    if (import.meta.hot) {
      import.meta.hot.data.artifacts = this.artifacts;
      import.meta.hot.data.unsavedFiles = this.unsavedFiles;
      import.meta.hot.data.lockedFiles = this.lockedFiles;
      import.meta.hot.data.showWorkbench = this.showWorkbench;
      import.meta.hot.data.currentView = this.currentView;
      import.meta.hot.data.actionAlert = this.actionAlert;
      import.meta.hot.data.supabaseAlert = this.supabaseAlert;
      import.meta.hot.data.deployAlert = this.deployAlert;

      // Ensure binary files are properly preserved across hot reloads
      const filesMap = this.files.get();

      for (const [path, dirent] of Object.entries(filesMap)) {
        if (dirent?.type === 'file' && dirent.isBinary && dirent.content) {
          // Make sure binary content is preserved
          this.files.setKey(path, { ...dirent });
        }
      }
    }

    // Initialize the instance lockedFiles from lockedFilesAtom
    this.syncLockedFilesFromGlobal();
  }

  // Helper method to sync instance lockedFiles from global lockedFilesAtom
  syncLockedFilesFromGlobal() {
    const globalLockedFiles = lockedFilesAtom.get();
    this.lockedFiles.set(new Set([...globalLockedFiles]));
  }

  toggleLockFile(filePath: string) {
    // Normalize the path for consistent storage
    const normalizedPath = this.normalizePath(filePath);
    const lockedFiles = new Set(lockedFilesAtom.get());
    const fileName = path.basename(normalizedPath);

    console.log('Toggle lock for path:', filePath);
    console.log('Normalized path:', normalizedPath);
    console.log('Current locked files before toggle:', [...lockedFiles]);

    if (lockedFiles.has(normalizedPath)) {
      lockedFiles.delete(normalizedPath);
      console.log('Unlocked file:', normalizedPath);

      // Show enhanced alert when unlocking a file
      this.actionAlert.set({
        type: 'info',
        title: 'File Unlocked',
        description: `${fileName} is now unlocked`,
        content: `The file "${normalizedPath}" is now unlocked and can be modified by AI. Any changes to this file will be applied immediately.`,
        source: 'terminal',
        notificationType: 'notification',
      });

      logger.info(`File unlocked: ${normalizedPath}`);
    } else {
      lockedFiles.add(normalizedPath);
      console.log('Locked file:', normalizedPath);

      // Show enhanced alert when locking a file
      this.actionAlert.set({
        type: 'info',
        title: 'File Locked',
        description: `${fileName} is now locked`,
        content: `The file "${normalizedPath}" is now locked and protected from AI modifications. The AI will be informed not to modify this file.`,
        source: 'terminal',
        notificationType: 'notification',
      });

      logger.info(`File locked: ${normalizedPath}`);
    }

    // Update the global atom
    lockedFilesAtom.set(lockedFiles);

    // Persist locked files to localStorage
    persistLockedFiles(lockedFiles);
    console.log('Locked files after toggle:', [...lockedFiles]);

    // Also update the class-level lockedFiles atom - keep in sync with global
    this.syncLockedFilesFromGlobal();

    // Make changes visible immediately
    this.refreshEditor();

    // Show toast notification
    if (lockedFiles.has(normalizedPath)) {
      toast.success(`Locked: ${fileName}`);
    } else {
      toast.success(`Unlocked: ${fileName}`);
    }
  }

  /**
   * Toggles lock state for a folder and all files within it
   * @param folderPath The path to the folder to lock/unlock
   */
  toggleLockFolder(folderPath: string) {
    // Normalize the path for consistent storage
    const normalizedFolderPath = this.normalizePath(folderPath);
    const lockedFiles = new Set(lockedFilesAtom.get());
    const folderName = path.basename(normalizedFolderPath);
    const files = this.files.get();
    const isLocked = lockedFiles.has(normalizedFolderPath);
    const affectedFiles = [];

    console.log('Toggle lock for folder:', folderPath);
    console.log('Normalized folder path:', normalizedFolderPath);
    console.log('Current locked files before toggle:', [...lockedFiles]);

    // First, toggle the folder itself
    if (isLocked) {
      lockedFiles.delete(normalizedFolderPath);
    } else {
      lockedFiles.add(normalizedFolderPath);
    }

    // Then, toggle all files within the folder
    for (const [filePath, dirent] of Object.entries(files)) {
      const normalizedFilePath = this.normalizePath(filePath);

      // Check if the file is within this folder
      if (normalizedFilePath.startsWith(normalizedFolderPath + '/') && dirent?.type === 'file') {
        affectedFiles.push(normalizedFilePath);

        if (isLocked) {
          lockedFiles.delete(normalizedFilePath);
        } else {
          lockedFiles.add(normalizedFilePath);
        }
      }
    }

    // Recursively handle subfolders too - find all folders that start with this path
    for (const [filePath, dirent] of Object.entries(files)) {
      const normalizedFilePath = this.normalizePath(filePath);

      if (normalizedFilePath.startsWith(normalizedFolderPath + '/') && dirent?.type === 'folder') {
        if (isLocked) {
          lockedFiles.delete(normalizedFilePath);
        } else {
          lockedFiles.add(normalizedFilePath);
        }
      }
    }

    // Update locked files storage
    lockedFilesAtom.set(lockedFiles);

    // Persist locked files to localStorage
    persistLockedFiles(lockedFiles);
    console.log('Locked files after folder toggle:', [...lockedFiles]);

    // Also update the class-level lockedFiles - keep in sync with global
    this.syncLockedFilesFromGlobal();

    // Show enhanced alert
    this.actionAlert.set({
      type: 'info',
      title: isLocked ? 'Folder Unlocked' : 'Folder Locked',
      description: `${folderName} is now ${isLocked ? 'unlocked' : 'locked'}`,
      content: `The folder "${normalizedFolderPath}" and its ${affectedFiles.length} file(s) are now ${isLocked ? 'unlocked' : 'locked'}.`,
      source: 'terminal',
      notificationType: 'notification',
    });

    // Show toast notification
    toast.success(`${isLocked ? 'Unlocked' : 'Locked'}: ${folderName} (${affectedFiles.length} files)`);

    // Make changes visible immediately
    this.refreshEditor();
  }

  // Helper method to refresh the editor state
  refreshEditor() {
    const currentDoc = this.currentDocument.get();

    if (currentDoc) {
      const { filePath } = currentDoc;

      // Trigger a re-render by updating the document slightly
      this.#editorStore.updateScrollPosition(filePath, {
        top: 0,
        left: 0,
      });
    }
  }

  isFileLocked(filePath: string): boolean {
    // Normalize path for consistent checking
    const normalizedPath = this.normalizePath(filePath);
    const lockedFiles = lockedFilesAtom.get();

    // Log for debugging
    if (normalizedPath.includes('README.md')) {
      console.log('Checking lock for path:', normalizedPath);
      console.log('Current locked files:', [...lockedFiles]);
      console.log('Is locked?', lockedFiles.has(normalizedPath));

      // Also check if the path exists with a different prefix
      for (const lockedPath of lockedFiles) {
        if (lockedPath.endsWith(normalizedPath) || normalizedPath.endsWith(lockedPath)) {
          console.log('Found matching locked path with different prefix:', lockedPath);
        }
      }
    }

    return lockedFiles.has(normalizedPath);
  }

  normalizePath(filePath: string): string {
    return normalizePath(filePath);
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

  get SupabaseAlert() {
    return this.supabaseAlert;
  }

  clearSupabaseAlert() {
    this.supabaseAlert.set(undefined);
  }

  get DeployAlert() {
    return this.deployAlert;
  }

  clearDeployAlert() {
    this.deployAlert.set(undefined);
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
    try {
      // Handle undefined filePath gracefully
      if (!filePath) {
        logger.debug('Attempted to select undefined file');
        return;
      }

      this.#editorStore.setSelectedFile(filePath);
    } catch (error) {
      logger.error(`Failed to select file ${filePath}:`, error);
      toast.error(`Unable to open file: ${filePath ? path.basename(filePath) : 'undefined'}`, {
        autoClose: 3000,
      });
    }
  }

  async saveFile(filePath: string) {
    if (this.isFileLocked(filePath)) {
      throw new Error(`File "${filePath}" is locked and cannot be modified.`);
    }

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

  getModifiedFiles() {
    return this.#filesStore.getModifiedFiles();
  }

  resetAllFileModifications() {
    this.#filesStore.resetFileModifications();
  }

  async createFile(filePath: string, content: string | Uint8Array = '') {
    if (this.isFileLocked(filePath)) {
      throw new Error(`File "${filePath}" is locked and cannot be created or overwritten.`);
    }

    try {
      const success = await this.#filesStore.createFile(filePath, content);

      if (success) {
        this.setSelectedFile(filePath);

        /*
         * For empty files, we need to ensure they're not marked as unsaved
         * Only check for empty string, not empty Uint8Array
         */
        if (typeof content === 'string' && content === '') {
          const newUnsavedFiles = new Set(this.unsavedFiles.get());
          newUnsavedFiles.delete(filePath);
          this.unsavedFiles.set(newUnsavedFiles);
        }
      }

      return success;
    } catch (error) {
      console.error('Failed to create file:', error);
      throw error;
    }
  }

  async createFolder(folderPath: string) {
    try {
      return await this.#filesStore.createFolder(folderPath);
    } catch (error) {
      console.error('Failed to create folder:', error);
      throw error;
    }
  }

  async deleteFile(filePath: string) {
    try {
      const currentDocument = this.currentDocument.get();
      const isCurrentFile = currentDocument?.filePath === filePath;

      const success = await this.#filesStore.deleteFile(filePath);

      if (success) {
        const newUnsavedFiles = new Set(this.unsavedFiles.get());

        if (newUnsavedFiles.has(filePath)) {
          newUnsavedFiles.delete(filePath);
          this.unsavedFiles.set(newUnsavedFiles);
        }

        if (isCurrentFile) {
          const files = this.files.get();
          let nextFile: string | undefined = undefined;

          for (const [path, dirent] of Object.entries(files)) {
            if (dirent?.type === 'file') {
              nextFile = path;
              break;
            }
          }

          this.setSelectedFile(nextFile);
        }
      }

      return success;
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw error;
    }
  }

  async deleteFolder(folderPath: string) {
    try {
      const currentDocument = this.currentDocument.get();
      const isInCurrentFolder = currentDocument?.filePath?.startsWith(folderPath + '/');

      const success = await this.#filesStore.deleteFolder(folderPath);

      if (success) {
        const unsavedFiles = this.unsavedFiles.get();
        const newUnsavedFiles = new Set<string>();

        for (const file of unsavedFiles) {
          if (!file.startsWith(folderPath + '/')) {
            newUnsavedFiles.add(file);
          }
        }

        if (newUnsavedFiles.size !== unsavedFiles.size) {
          this.unsavedFiles.set(newUnsavedFiles);
        }

        if (isInCurrentFolder) {
          const files = this.files.get();
          let nextFile: string | undefined = undefined;

          for (const [path, dirent] of Object.entries(files)) {
            if (dirent?.type === 'file') {
              nextFile = path;
              break;
            }
          }

          this.setSelectedFile(nextFile);
        }
      }

      return success;
    } catch (error) {
      console.error('Failed to delete folder:', error);
      throw error;
    }
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
        (alert) => {
          if (this.#reloadedMessages.has(messageId)) {
            return;
          }

          this.supabaseAlert.set(alert);
        },
        (alert) => {
          if (this.#reloadedMessages.has(messageId)) {
            return;
          }

          this.deployAlert.set(alert);
        },
        (filePath) => this.isFileLocked(filePath),
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

      // Triple protection for locked files
      if (this.isFileLocked(fullPath)) {
        // 1. Display prominent blocking message
        const fileName = path.basename(fullPath);
        logger.error(`BLOCKED: AI attempted to modify locked file "${fileName}"`);

        // 2. Create a terminal error that will be displayed to the user
        const errorMessage = `Error: AI attempted to edit locked file "${fileName}"`;

        // 3. Mark the action as failed immediately
        const actionId = data.actionId;
        artifact.runner.actions.setKey(actionId, {
          ...action,
          status: 'failed',
          error: errorMessage,
        } as any);

        // 4. Display toast notification
        toast.error(`Blocked modification of locked file: ${fileName}`, {
          autoClose: 5000,
          position: 'top-center',
        });

        // 5. Let the action runner know as well, but don't depend on it
        try {
          await artifact.runner.runAction(data, isStreaming);
        } catch {
          // Error is expected and already handled
        }

        return;
      }

      // Continue with normal file handling for non-locked files
      try {
        if (this.selectedFile.value !== fullPath) {
          this.setSelectedFile(fullPath);
        }

        if (this.currentView.value !== 'code') {
          this.currentView.set('code');
        }
      } catch (error) {
        logger.error('Error selecting file:', error);
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

  async syncFiles(targetHandle: FileSystemDirectoryHandle) {
    const files = this.files.get();
    const syncedFiles = [];

    for (const [filePath, dirent] of Object.entries(files)) {
      if (dirent?.type === 'file' && !dirent.isBinary) {
        const relativePath = extractRelativePath(filePath);
        const pathSegments = relativePath.split('/');
        let currentHandle = targetHandle;

        for (let i = 0; i < pathSegments.length - 1; i++) {
          currentHandle = await currentHandle.getDirectoryHandle(pathSegments[i], { create: true });
        }

        // create or get the file
        const fileHandle = await currentHandle.getFileHandle(pathSegments[pathSegments.length - 1], {
          create: true,
        });

        // write the file content
        const writable = await fileHandle.createWritable();
        await writable.write(dirent.content);
        await writable.close();

        syncedFiles.push(relativePath);
      }
    }

    return syncedFiles;
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

      // Log the isPrivate flag to verify it's being properly passed
      console.log(`pushToGitHub called with isPrivate=${isPrivate}`);

      // Initialize Octokit with the auth token
      const octokit = new Octokit({ auth: githubToken });

      // Check if the repository already exists before creating it
      let repo: RestEndpointMethodTypes['repos']['get']['response']['data'];
      let visibilityJustChanged = false;

      try {
        const resp = await octokit.repos.get({ owner, repo: repoName });
        repo = resp.data;
        console.log('Repository already exists, using existing repo');

        // Check if we need to update visibility of existing repo
        if (repo.private !== isPrivate) {
          console.log(
            `Updating repository visibility from ${repo.private ? 'private' : 'public'} to ${isPrivate ? 'private' : 'public'}`,
          );

          try {
            // Update repository visibility using the update method
            const { data: updatedRepo } = await octokit.repos.update({
              owner,
              repo: repoName,
              private: isPrivate,
            });

            console.log('Repository visibility updated successfully');
            repo = updatedRepo;
            visibilityJustChanged = true;

            // Add a delay after changing visibility to allow GitHub to fully process the change
            console.log('Waiting for visibility change to propagate...');
            await new Promise((resolve) => setTimeout(resolve, 3000)); // 3 second delay
          } catch (visibilityError) {
            console.error('Failed to update repository visibility:', visibilityError);

            // Continue with push even if visibility update fails
          }
        }
      } catch (error) {
        if (error instanceof Error && 'status' in error && error.status === 404) {
          // Repository doesn't exist, so create a new one
          console.log(`Creating new repository with private=${isPrivate}`);

          // Create new repository with specified privacy setting
          const createRepoOptions = {
            name: repoName,
            private: isPrivate,
            auto_init: true,
          };

          console.log('Create repo options:', createRepoOptions);

          const { data: newRepo } = await octokit.repos.createForAuthenticatedUser(createRepoOptions);

          console.log('Repository created:', newRepo.html_url, 'Private:', newRepo.private);
          repo = newRepo;

          // Add a small delay after creating a repository to allow GitHub to fully initialize it
          console.log('Waiting for repository to initialize...');
          await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
        } else {
          console.error('Cannot create repo:', error);
          throw error; // Some other error occurred
        }
      }

      // Get all files
      const files = this.files.get();

      if (!files || Object.keys(files).length === 0) {
        throw new Error('No files found to push');
      }

      // Function to push files with retry logic
      const pushFilesToRepo = async (attempt = 1): Promise<string> => {
        const maxAttempts = 3;

        try {
          console.log(`Pushing files to repository (attempt ${attempt}/${maxAttempts})...`);

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

          // Refresh repository reference to ensure we have the latest data
          const repoRefresh = await octokit.repos.get({ owner, repo: repoName });
          repo = repoRefresh.data;

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

          console.log('Files successfully pushed to repository');

          return repo.html_url;
        } catch (error) {
          console.error(`Error during push attempt ${attempt}:`, error);

          // If we've just changed visibility and this is not our last attempt, wait and retry
          if ((visibilityJustChanged || attempt === 1) && attempt < maxAttempts) {
            const delayMs = attempt * 2000; // Increasing delay with each attempt
            console.log(`Waiting ${delayMs}ms before retry...`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));

            return pushFilesToRepo(attempt + 1);
          }

          throw error; // Rethrow if we're out of attempts
        }
      };

      // Execute the push function with retry logic
      const repoUrl = await pushFilesToRepo();

      // Return the repository URL
      return repoUrl;
    } catch (error) {
      console.error('Error pushing to GitHub:', error);
      throw error; // Rethrow the error for further handling
    }
  }
}

export const workbenchStore = new WorkbenchStore();

/**
 * Standalone function to check if a file is locked
 */
export function isFileLocked(filePath: string): boolean {
  // Use the same normalization as in the class
  const normalizedPath = normalizePath(filePath);
  return lockedFilesAtom.get().has(normalizedPath);
}
