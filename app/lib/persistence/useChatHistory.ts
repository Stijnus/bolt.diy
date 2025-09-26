import { useLoaderData, useNavigate, useSearchParams } from '@remix-run/react';
import { type UIMessage, generateId, type JSONValue } from 'ai';
import { atom } from 'nanostores';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  getMessages,
  getNextId,
  getUrlId,
  openDatabase,
  setMessages,
  duplicateChat,
  createChatFromMessages,
  getSnapshot,
  setSnapshot,
  type IChatMetadata,
} from './db';
import type { Snapshot } from './types';
import type { FileMap } from '~/lib/stores/files';
import { logStore } from '~/lib/stores/logs'; // Import logStore
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import type { ContextAnnotation } from '~/types/context';
import { detectProjectCommands, createCommandActionsString } from '~/utils/projectCommands';

export interface ChatHistoryItem {
  id: string;
  urlId?: string;
  description?: string;
  messages: UIMessage[];
  timestamp: string;
  metadata?: IChatMetadata;
}

const persistenceEnabled = !import.meta.env.VITE_DISABLE_PERSISTENCE;

// Initialize database lazily on client-side only
let dbInstance: IDBDatabase | undefined = undefined;
let dbPromise: Promise<IDBDatabase | undefined> | undefined = undefined;

async function getDatabase(): Promise<IDBDatabase | undefined> {
  if (dbInstance !== undefined) {
    return dbInstance;
  }

  if (dbPromise) {
    return dbPromise;
  }

  if (!persistenceEnabled || typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    dbInstance = undefined;
    return undefined;
  }

  dbPromise = openDatabase()
    .then((db) => {
      dbInstance = db;
      return db;
    })
    .catch(() => {
      dbInstance = undefined;
      return undefined;
    });

  return dbPromise;
}

// Removed db export to prevent SSR issues - use getDatabase() internally

export const chatId = atom<string | undefined>(undefined);
export const description = atom<string | undefined>(undefined);
export const chatMetadata = atom<IChatMetadata | undefined>(undefined);
export function useChatHistory() {
  const navigate = useNavigate();
  const { id: mixedId } = useLoaderData<{ id?: string }>();
  const [searchParams] = useSearchParams();

  const [archivedMessages, setArchivedMessages] = useState<UIMessage[]>([]);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [ready, setReady] = useState<boolean>(false);
  const [urlId, setUrlId] = useState<string | undefined>();

  useEffect(() => {
    const initializeChat = async () => {
      const database = await getDatabase();

      if (!database) {
        setReady(true);

        if (persistenceEnabled) {
          const error = new Error('Chat persistence is unavailable');
          logStore.logError('Chat persistence initialization failed', error);
          toast.error('Chat persistence is unavailable');
        }

        return;
      }

      if (mixedId) {
        Promise.all([
          getMessages(database, mixedId),
          getSnapshot(database, mixedId), // Fetch snapshot from DB
        ])
          .then(async ([storedMessages, snapshot]) => {
            if (storedMessages && storedMessages.messages.length > 0) {
              /*
               * const snapshotStr = localStorage.getItem(`snapshot:${mixedId}`); // Remove localStorage usage
               * const snapshot: Snapshot = snapshotStr ? JSON.parse(snapshotStr) : { chatIndex: 0, files: {} }; // Use snapshot from DB
               */
              const validSnapshot = snapshot || { chatIndex: '', files: {} }; // Ensure snapshot is not undefined
              const summary = validSnapshot.summary;

              const rewindId = searchParams.get('rewindTo');

              let startingIdx = -1;

              const endingIdx = rewindId
                ? storedMessages.messages.findIndex((m) => m.id === rewindId) + 1
                : storedMessages.messages.length;

              const snapshotIndex = storedMessages.messages.findIndex((m) => m.id === validSnapshot.chatIndex);

              if (snapshotIndex >= 0 && snapshotIndex < endingIdx) {
                startingIdx = snapshotIndex;
              }

              if (snapshotIndex > 0 && storedMessages.messages[snapshotIndex].id == rewindId) {
                startingIdx = -1;
              }

              let filteredMessages = storedMessages.messages.slice(startingIdx + 1, endingIdx);
              let archivedMessages: UIMessage[] = [];

              if (startingIdx >= 0) {
                archivedMessages = storedMessages.messages.slice(0, startingIdx + 1);
              }

              setArchivedMessages(archivedMessages);

              if (startingIdx > 0) {
                const files = Object.entries(validSnapshot?.files || {})
                  .map(([key, value]) => {
                    if (value?.type !== 'file') {
                      return null;
                    }

                    return {
                      content: value.content,
                      path: key,
                    };
                  })
                  .filter((x): x is { content: string; path: string } => !!x); // Type assertion

                const projectCommands = await detectProjectCommands(files);

                // Call the modified function to get only the command actions string
                const commandActionsString = createCommandActionsString(projectCommands);

                filteredMessages = [
                  {
                    id: generateId(),
                    role: 'user',
                    parts: [{ type: 'text', text: `Restore project from snapshot` }],
                    metadata: { annotations: ['no-store', 'hidden'] },
                  },
                  {
                    id: storedMessages.messages[snapshotIndex].id,
                    role: 'assistant',

                    // Combine followup message and the artifact with files and command actions
                    parts: [
                      {
                        type: 'text',
                        text: `Bolt Restored your chat from a snapshot. You can revert this message to load the full chat history.
                  <boltArtifact id="restored-project-setup" title="Restored Project & Setup" type="bundled">
                  ${Object.entries(snapshot?.files || {})
                    .map(([key, value]) => {
                      if (value?.type === 'file') {
                        return `
                      <boltAction type="file" filePath="${key}">
${value.content}
                      </boltAction>
                      `;
                      } else {
                        return ``;
                      }
                    })
                    .join('\n')}
                  ${commandActionsString}
                  </boltArtifact>
                  `,
                      },
                    ], // Added commandActionsString, followupMessage, updated id and title
                    metadata: {
                      annotations: [
                        'no-store',
                        ...(summary
                          ? [
                              {
                                chatId: storedMessages.messages[snapshotIndex].id,
                                type: 'chatSummary',
                                summary,
                              } satisfies ContextAnnotation,
                            ]
                          : []),
                      ],
                    },
                  },

                  // Remove the separate user and assistant messages for commands
                  /*
                   *...(commands !== null // This block is no longer needed
                   *  ? [ ... ]
                   *  : []),
                   */
                  ...filteredMessages,
                ];
                restoreSnapshot(mixedId);
              }

              setInitialMessages(filteredMessages);

              setUrlId(storedMessages.urlId);
              description.set(storedMessages.description);
              chatId.set(storedMessages.id);
              chatMetadata.set(storedMessages.metadata);
            } else {
              navigate('/', { replace: true });
            }

            setReady(true);
          })
          .catch((error) => {
            console.error(error);

            logStore.logError('Failed to load chat messages or snapshot', error); // Updated error message
            toast.error('Failed to load chat: ' + error.message); // More specific error
          });
      } else {
        // Handle case where there is no mixedId (e.g., new chat)
        setReady(true);
      }
    };

    initializeChat();
  }, [mixedId, navigate, searchParams]); // Removed db dependency since we use getDatabase()

  const takeSnapshot = useCallback(
    async (chatIdx: string, files: FileMap, _chatId?: string | undefined, chatSummary?: string) => {
      console.log('[useChatHistory] takeSnapshot called:', { chatIdx, _chatId, fileCount: Object.keys(files).length });

      const id = chatId.get();
      console.log('[useChatHistory] Chat ID from atom:', id);

      const database = await getDatabase();

      if (!id || !database) {
        console.log('[useChatHistory] Missing requirements:', { id: !!id, database: !!database });
        return;
      }

      // Skip empty snapshots to reduce database overhead
      const fileCount = Object.keys(files).filter((path) => files[path]?.type === 'file').length;
      console.log('[useChatHistory] File count:', fileCount);

      if (fileCount === 0 && !chatSummary) {
        console.log('[useChatHistory] Skipping empty snapshot');
        return;
      }

      const snapshot: Snapshot = {
        chatIndex: chatIdx,
        files,
        summary: chatSummary,
      };

      console.log('[useChatHistory] Attempting to save snapshot to IndexedDB');

      try {
        await setSnapshot(database, id, snapshot);
        console.log(`[useChatHistory] ✅ Snapshot saved with ${fileCount} files for chat ${id}`);
      } catch (error) {
        console.error('[useChatHistory] ❌ Failed to save snapshot:', error);

        // Only show toast for non-manual operations to avoid spam
        if (!chatIdx.startsWith('manual-')) {
          toast.error('Failed to save chat snapshot.');
        }
      }
    },
    [], // No dependencies since we use getDatabase() internally
  );

  // Set up the snapshot callback for manual operations
  useEffect(() => {
    const setupCallback = async () => {
      const database = await getDatabase();
      console.log('[useChatHistory] Setting up snapshot callback:', {
        ready,
        database: !!database,
        takeSnapshot: !!takeSnapshot,
      });

      if (ready && database) {
        console.log('[useChatHistory] Registering snapshot callback with workbenchStore');
        workbenchStore.setSnapshotCallback(takeSnapshot);
      } else {
        console.log('[useChatHistory] Not registering callback yet:', { ready, database: !!database });
      }
    };

    setupCallback();
  }, [ready, takeSnapshot]);

  const restoreSnapshot = useCallback(async (id: string, snapshot?: Snapshot) => {
    // const snapshotStr = localStorage.getItem(`snapshot:${id}`); // Remove localStorage usage
    const container = await webcontainer;

    const validSnapshot = snapshot || { chatIndex: '', files: {} };

    if (!validSnapshot?.files) {
      return;
    }

    Object.entries(validSnapshot.files).forEach(async ([key, value]) => {
      if (key.startsWith(container.workdir)) {
        key = key.replace(container.workdir, '');
      }

      if (value?.type === 'folder') {
        await container.fs.mkdir(key, { recursive: true });
      }
    });
    Object.entries(validSnapshot.files).forEach(async ([key, value]) => {
      if (value?.type === 'file') {
        if (key.startsWith(container.workdir)) {
          key = key.replace(container.workdir, '');
        }

        await container.fs.writeFile(key, value.content, { encoding: value.isBinary ? undefined : 'utf8' });
      } else {
      }
    });

    // workbenchStore.files.setKey(snapshot?.files)
  }, []);

  return {
    ready: !mixedId || ready,
    initialMessages,
    updateChatMestaData: async (metadata: IChatMetadata) => {
      const id = chatId.get();
      const database = await getDatabase();

      if (!database || !id) {
        return;
      }

      try {
        await setMessages(database, id, initialMessages, urlId, description.get(), undefined, metadata);
        chatMetadata.set(metadata);
      } catch (error) {
        toast.error('Failed to update chat metadata');
        console.error(error);
      }
    },
    storeMessageHistory: async (messages: UIMessage[]) => {
      const database = await getDatabase();

      if (!database || messages.length === 0) {
        return;
      }

      const { firstArtifact } = workbenchStore;
      messages = messages.filter((m) => !(m.metadata as any)?.annotations?.includes('no-store'));

      let _urlId = urlId;

      if (!urlId && firstArtifact?.id) {
        const urlId = await getUrlId(database, firstArtifact.id);
        _urlId = urlId;
        navigateChat(urlId);
        setUrlId(urlId);
      }

      let chatSummary: string | undefined = undefined;

      const lastMessage = messages[messages.length - 1];

      if (lastMessage.role === 'assistant') {
        const annotations = (lastMessage.metadata as any)?.annotations as JSONValue[];

        const filteredAnnotations = (annotations?.filter(
          (annotation: JSONValue) =>
            annotation && typeof annotation === 'object' && Object.keys(annotation).includes('type'),
        ) || []) as { type: string; value: any } & { [key: string]: any }[];

        if (filteredAnnotations.find((annotation) => annotation.type === 'chatSummary')) {
          chatSummary = filteredAnnotations.find((annotation) => annotation.type === 'chatSummary')?.summary;
        }
      }

      takeSnapshot(messages[messages.length - 1].id, workbenchStore.files.get(), _urlId, chatSummary);

      if (!description.get() && firstArtifact?.title) {
        description.set(firstArtifact?.title);
      }

      // Ensure chatId.get() is used here as well
      if (initialMessages.length === 0 && !chatId.get()) {
        const nextId = await getNextId(database);

        chatId.set(nextId);

        if (!urlId) {
          navigateChat(nextId);
        }
      }

      // Ensure chatId.get() is used for the final setMessages call
      const finalChatId = chatId.get();

      if (!finalChatId) {
        console.error('Cannot save messages, chat ID is not set.');
        toast.error('Failed to save chat messages: Chat ID missing.');

        return;
      }

      await setMessages(
        database,
        finalChatId, // Use the potentially updated chatId
        [...archivedMessages, ...messages],
        urlId,
        description.get(),
        undefined,
        chatMetadata.get(),
      );
    },
    duplicateCurrentChat: async (listItemId: string) => {
      const database = await getDatabase();

      if (!database || (!mixedId && !listItemId)) {
        return;
      }

      try {
        const newId = await duplicateChat(database, mixedId || listItemId);
        navigate(`/chat/${newId}`);
        toast.success('Chat duplicated successfully');
      } catch (error) {
        toast.error('Failed to duplicate chat');
        console.log(error);
      }
    },
    importChat: async (description: string, messages: UIMessage[], metadata?: IChatMetadata) => {
      const database = await getDatabase();

      if (!database) {
        return;
      }

      try {
        const newId = await createChatFromMessages(database, description, messages, metadata);
        window.location.href = `/chat/${newId}`;
        toast.success('Chat imported successfully');
      } catch (error) {
        if (error instanceof Error) {
          toast.error('Failed to import chat: ' + error.message);
        } else {
          toast.error('Failed to import chat');
        }
      }
    },
    exportChat: async (id = urlId) => {
      const database = await getDatabase();

      if (!database || !id) {
        return;
      }

      const chat = await getMessages(database, id);

      const chatData = {
        messages: chat.messages,
        description: chat.description,
        exportDate: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  };
}

function navigateChat(nextId: string) {
  /**
   * FIXME: Using the intended navigate function causes a rerender for <Chat /> that breaks the app.
   *
   * `navigate(`/chat/${nextId}`, { replace: true });`
   */
  const url = new URL(window.location.href);
  url.pathname = `/chat/${nextId}`;

  window.history.replaceState({}, '', url);
}
