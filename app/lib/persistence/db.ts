import type { Message } from 'ai';
import { createScopedLogger } from '~/utils/logger';
import type { ChatHistoryItem } from './useChatHistory';
import type { Snapshot } from './types'; // Import Snapshot type
import type { Branch, Feature, Project } from '~/components/projects/types';

export interface IChatMetadata {
  gitUrl: string;
  gitBranch?: string;
  netlifySiteId?: string;
  projectId?: string;
  featureId?: string;
  featureName?: string;
  featureDescription?: string;
  featureStatus?: string;
  projectName?: string;
  projectDescription?: string;
}

const logger = createScopedLogger('ChatHistory');

// this is used at the top level and never rejects
export async function openDatabase(): Promise<IDBDatabase | undefined> {
  if (typeof indexedDB === 'undefined') {
    console.error('indexedDB is not available in this environment.');
    return undefined;
  }

  return new Promise((resolve) => {
    const request = indexedDB.open('boltHistory', 7);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;

      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('chats')) {
          const store = db.createObjectStore('chats', { keyPath: 'id' });
          store.createIndex('id', 'id', { unique: true });
          store.createIndex('urlId', 'urlId', { unique: true });
        }
      }

      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('snapshots')) {
          db.createObjectStore('snapshots', { keyPath: 'chatId' });
        }
      }

      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains('projects')) {
          const store = db.createObjectStore('projects', { keyPath: 'id' });
          store.createIndex('id', 'id', { unique: true });
          store.createIndex('gitUrl', 'gitUrl', { unique: true });
        }
      }

      if (oldVersion < 4) {
        if (!db.objectStoreNames.contains('features')) {
          const features = db.createObjectStore('features', { keyPath: 'id' });
          features.createIndex('id', 'id', { unique: true });
          features.createIndex('projectId', 'projectId', { unique: false });
          features.createIndex('status', 'status', { unique: false });
          features.createIndex('assignee', 'analytics.assignee', { unique: false });
          features.createIndex('priority', 'analytics.priority', { unique: false });
          features.createIndex('tags', 'analytics.tags', { unique: false, multiEntry: true });
          features.createIndex('createdAt', 'timeTracking.createdAt', { unique: false });
          features.createIndex('updatedAt', 'timeTracking.lastUpdated', { unique: false });
        }

        if (!db.objectStoreNames.contains('activities')) {
          const activities = db.createObjectStore('activities', { keyPath: 'id' });
          activities.createIndex('scopeType', 'scopeType', { unique: false });
          activities.createIndex('scopeId', 'scopeId', { unique: false });
          activities.createIndex('timestamp', 'timestamp', { unique: false });
          activities.createIndex('userId', 'userId', { unique: false });
        }

        if (!db.objectStoreNames.contains('comments')) {
          const comments = db.createObjectStore('comments', { keyPath: 'id' });
          comments.createIndex('targetType', 'targetType', { unique: false });
          comments.createIndex('targetId', 'targetId', { unique: false });
          comments.createIndex('timestamp', 'timestamp', { unique: false });
          comments.createIndex('authorId', 'authorId', { unique: false });
        }

        if (!db.objectStoreNames.contains('workflows')) {
          const workflows = db.createObjectStore('workflows', { keyPath: 'id' });
          workflows.createIndex('projectId', 'projectId', { unique: false });
        }

        try {
          const tx = (event.target as IDBOpenDBRequest).transaction;

          if (tx) {
            const projectsStore = tx.objectStore('projects');
            const featuresStore = tx.objectStore('features');

            const getAllReq = projectsStore.getAll();

            getAllReq.onsuccess = () => {
              const projects = (getAllReq.result || []) as any[];

              for (const project of projects) {
                const list = Array.isArray(project.features) ? project.features : [];

                for (const feature of list) {
                  try {
                    const row = { ...feature, projectId: project.id };
                    featuresStore.put(row);
                  } catch {
                    // best-effort during upgrade
                  }
                }
              }
            };
          }
        } catch {
          // best-effort migration
        }
      }

      if (oldVersion < 5) {
        if (!db.objectStoreNames.contains('prs')) {
          const prs = db.createObjectStore('prs', { keyPath: 'id' });
          prs.createIndex('projectId', 'projectId', { unique: false });
          prs.createIndex('featureId', 'featureId', { unique: false });
          prs.createIndex('provider', 'provider', { unique: false });
          prs.createIndex('state', 'state', { unique: false });
        }
      }

      if (oldVersion < 6) {
        if (!db.objectStoreNames.contains('integrations')) {
          const integrations = db.createObjectStore('integrations', { keyPath: 'id' });
          integrations.createIndex('provider', 'provider', { unique: false });
          integrations.createIndex('scopeId', 'scopeId', { unique: false });
          integrations.createIndex('scopeType', 'scopeType', { unique: false });
        }
      }

      if (oldVersion < 7) {
        // Users table
        if (!db.objectStoreNames.contains('users')) {
          const users = db.createObjectStore('users', { keyPath: 'id' });
          users.createIndex('email', 'email', { unique: true });
          users.createIndex('username', 'username', { unique: true });
          users.createIndex('isActive', 'isActive', { unique: false });
          users.createIndex('currentOrganizationId', 'currentOrganizationId', { unique: false });
        }

        // Organizations table
        if (!db.objectStoreNames.contains('organizations')) {
          const organizations = db.createObjectStore('organizations', { keyPath: 'id' });
          organizations.createIndex('slug', 'slug', { unique: true });
          organizations.createIndex('ownerId', 'ownerId', { unique: false });
          organizations.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Organization members table
        if (!db.objectStoreNames.contains('organization_members')) {
          const orgMembers = db.createObjectStore('organization_members', { keyPath: 'id' });
          orgMembers.createIndex('userId', 'userId', { unique: false });
          orgMembers.createIndex('organizationId', 'organizationId', { unique: false });
          orgMembers.createIndex('role', 'role', { unique: false });
          orgMembers.createIndex('status', 'status', { unique: false });
        }

        // Teams table (enhanced from existing types)
        if (!db.objectStoreNames.contains('teams')) {
          const teams = db.createObjectStore('teams', { keyPath: 'id' });
          teams.createIndex('name', 'name', { unique: false });
          teams.createIndex('ownerId', 'ownerId', { unique: false });
          teams.createIndex('organizationId', 'organizationId', { unique: false });
          teams.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Team members table
        if (!db.objectStoreNames.contains('team_members')) {
          const teamMembers = db.createObjectStore('team_members', { keyPath: 'id' });
          teamMembers.createIndex('userId', 'userId', { unique: false });
          teamMembers.createIndex('teamId', 'teamId', { unique: false });
          teamMembers.createIndex('role', 'role', { unique: false });
          teamMembers.createIndex('status', 'status', { unique: false });
        }

        // Team invitations table
        if (!db.objectStoreNames.contains('team_invitations')) {
          const invitations = db.createObjectStore('team_invitations', { keyPath: 'id' });
          invitations.createIndex('email', 'email', { unique: false });
          invitations.createIndex('teamId', 'teamId', { unique: false });
          invitations.createIndex('organizationId', 'organizationId', { unique: false });
          invitations.createIndex('status', 'status', { unique: false });
          invitations.createIndex('expiresAt', 'expiresAt', { unique: false });
        }

        // Auth sessions table
        if (!db.objectStoreNames.contains('auth_sessions')) {
          const sessions = db.createObjectStore('auth_sessions', { keyPath: 'token' });
          sessions.createIndex('userId', 'user.id', { unique: false });
          sessions.createIndex('expiresAt', 'expiresAt', { unique: false });
        }
      }
    };

    request.onsuccess = (event: Event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event: Event) => {
      resolve(undefined);
      logger.error((event.target as IDBOpenDBRequest).error);
    };
  });
}

export async function getAll(db: IDBDatabase): Promise<ChatHistoryItem[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as ChatHistoryItem[]);
    request.onerror = () => reject(request.error);
  });
}

export async function setMessages(
  db: IDBDatabase,
  id: string,
  messages: Message[],
  urlId?: string,
  description?: string,
  timestamp?: string,
  metadata?: IChatMetadata,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readwrite');
    const store = transaction.objectStore('chats');

    if (timestamp && isNaN(Date.parse(timestamp))) {
      reject(new Error('Invalid timestamp'));
      return;
    }

    const request = store.put({
      id,
      messages,
      urlId,
      description,
      timestamp: timestamp ?? new Date().toISOString(),
      metadata,
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getMessages(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  return (await getMessagesById(db, id)) || (await getMessagesByUrlId(db, id));
}

export async function getMessagesByUrlId(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const index = store.index('urlId');
    const request = index.get(id);

    request.onsuccess = () => resolve(request.result as ChatHistoryItem);
    request.onerror = () => reject(request.error);
  });
}

export async function getMessagesById(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result as ChatHistoryItem);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteById(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chats', 'snapshots'], 'readwrite'); // Add snapshots store to transaction
    const chatStore = transaction.objectStore('chats');
    const snapshotStore = transaction.objectStore('snapshots');

    const deleteChatRequest = chatStore.delete(id);
    const deleteSnapshotRequest = snapshotStore.delete(id); // Also delete snapshot

    let chatDeleted = false;
    let snapshotDeleted = false;

    const checkCompletion = () => {
      if (chatDeleted && snapshotDeleted) {
        resolve(undefined);
      }
    };

    deleteChatRequest.onsuccess = () => {
      chatDeleted = true;
      checkCompletion();
    };
    deleteChatRequest.onerror = () => reject(deleteChatRequest.error);

    deleteSnapshotRequest.onsuccess = () => {
      snapshotDeleted = true;
      checkCompletion();
    };

    deleteSnapshotRequest.onerror = (event) => {
      if ((event.target as IDBRequest).error?.name === 'NotFoundError') {
        snapshotDeleted = true;
        checkCompletion();
      } else {
        reject(deleteSnapshotRequest.error);
      }
    };

    transaction.oncomplete = () => {
      // This might resolve before checkCompletion if one operation finishes much faster
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getNextId(db: IDBDatabase): Promise<string> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.getAllKeys();

    request.onsuccess = () => {
      const highestId = request.result.reduce((cur, acc) => Math.max(+cur, +acc), 0);
      resolve(String(+highestId + 1));
    };

    request.onerror = () => reject(request.error);
  });
}

export async function getUrlId(db: IDBDatabase, id: string): Promise<string> {
  const idList = await getUrlIds(db);

  if (!idList.includes(id)) {
    return id;
  } else {
    let i = 2;

    while (idList.includes(`${id}-${i}`)) {
      i++;
    }

    return `${id}-${i}`;
  }
}

async function getUrlIds(db: IDBDatabase): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const idList: string[] = [];

    const request = store.openCursor();

    request.onsuccess = (event: Event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

      if (cursor) {
        idList.push(cursor.value.urlId);
        cursor.continue();
      } else {
        resolve(idList);
      }
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function forkChat(db: IDBDatabase, chatId: string, messageId: string): Promise<string> {
  const chat = await getMessages(db, chatId);

  if (!chat) {
    throw new Error('Chat not found');
  }

  // Find the index of the message to fork at
  const messageIndex = chat.messages.findIndex((msg) => msg.id === messageId);

  if (messageIndex === -1) {
    throw new Error('Message not found');
  }

  // Get messages up to and including the selected message
  const messages = chat.messages.slice(0, messageIndex + 1);

  return createChatFromMessages(db, chat.description ? `${chat.description} (fork)` : 'Forked chat', messages);
}

export async function duplicateChat(db: IDBDatabase, id: string): Promise<string> {
  const chat = await getMessages(db, id);

  if (!chat) {
    throw new Error('Chat not found');
  }

  return createChatFromMessages(db, `${chat.description || 'Chat'} (copy)`, chat.messages);
}

export async function createChatFromMessages(
  db: IDBDatabase,
  description: string,
  messages: Message[],
  metadata?: IChatMetadata,
): Promise<string> {
  const newId = await getNextId(db);
  const newUrlId = await getUrlId(db, newId); // Get a new urlId for the duplicated chat

  await setMessages(
    db,
    newId,
    messages,
    newUrlId, // Use the new urlId
    description,
    undefined, // Use the current timestamp
    metadata,
  );

  return newUrlId; // Return the urlId instead of id for navigation
}

export async function updateChatDescription(db: IDBDatabase, id: string, description: string): Promise<void> {
  const chat = await getMessages(db, id);

  if (!chat) {
    throw new Error('Chat not found');
  }

  if (!description.trim()) {
    throw new Error('Description cannot be empty');
  }

  await setMessages(db, id, chat.messages, chat.urlId, description, chat.timestamp, chat.metadata);
}

export async function updateChatMetadata(
  db: IDBDatabase,
  id: string,
  metadata: IChatMetadata | undefined,
): Promise<void> {
  const chat = await getMessages(db, id);

  if (!chat) {
    throw new Error('Chat not found');
  }

  await setMessages(db, id, chat.messages, chat.urlId, chat.description, chat.timestamp, metadata);
}

export async function getSnapshot(db: IDBDatabase, chatId: string): Promise<Snapshot | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('snapshots', 'readonly');
    const store = transaction.objectStore('snapshots');
    const request = store.get(chatId);

    request.onsuccess = () => resolve(request.result?.snapshot as Snapshot | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function setSnapshot(db: IDBDatabase, chatId: string, snapshot: Snapshot): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('snapshots', 'readwrite');
    const store = transaction.objectStore('snapshots');
    const request = store.put({ chatId, snapshot });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteSnapshot(db: IDBDatabase, chatId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('snapshots', 'readwrite');
    const store = transaction.objectStore('snapshots');
    const request = store.delete(chatId);

    request.onsuccess = () => resolve();

    request.onerror = (event) => {
      if ((event.target as IDBRequest).error?.name === 'NotFoundError') {
        resolve();
      } else {
        reject(request.error);
      }
    };
  });
}

// Project-related functions
export async function setupProjectStore(db: IDBDatabase) {
  if (!db.objectStoreNames.contains('projects')) {
    const store = db.createObjectStore('projects', { keyPath: 'id' });
    store.createIndex('id', 'id', { unique: true });
    store.createIndex('gitUrl', 'gitUrl', { unique: true });
  }
}

export async function addProject(db: IDBDatabase, project: Project) {
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('projects', 'readwrite');
    const store = transaction.objectStore('projects');

    const request = store.put({
      ...project,
      timestamp: new Date().toISOString(),
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function updateProject(db: IDBDatabase, project: Project, _id: string) {
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('projects', 'readwrite');
    const store = transaction.objectStore('projects');

    const request = store.put({
      ...project,
      timestamp: new Date().toISOString(),
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function addOrUpdateFeature(db: IDBDatabase, projectId: string, feature: Feature) {
  const project = await getProjectById(db, projectId);
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['projects', 'features'], 'readwrite');
    const projectsStore = transaction.objectStore('projects');
    const featuresStore = transaction.objectStore('features');

    const updatedProject: Project = {
      ...project,
      features: [...(project.features || []).filter((f) => f.id !== feature.id), feature],
    };

    projectsStore.put(updatedProject);

    try {
      const featureRow: any = { ...feature, projectId };
      featuresStore.put(featureRow);
    } catch {
      // If features store not available, ignore silently
    }

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getFeatureById(
  db: IDBDatabase,
  id: string,
): Promise<(Feature & { projectId: string }) | undefined> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('features', 'readonly');
      const store = tx.objectStore('features');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result as any);
      req.onerror = () => reject(req.error);
    } catch {
      resolve(undefined);
    }
  });
}

export async function getFeaturesByProject(
  db: IDBDatabase,
  projectId: string,
): Promise<Array<Feature & { projectId: string }>> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('features', 'readonly');
      const store = tx.objectStore('features');
      const index = store.index('projectId');
      const req = index.getAll(projectId);
      req.onsuccess = () => resolve((req.result as any[]) || []);
      req.onerror = () => reject(req.error);
    } catch {
      resolve([]);
    }
  });
}

export async function deleteFeatureById(db: IDBDatabase, projectId: string, id: string): Promise<void> {
  const project = await getProjectById(db, projectId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['projects', 'features'], 'readwrite');
    const projectsStore = tx.objectStore('projects');
    const featuresStore = tx.objectStore('features');

    const updatedProject: Project = {
      ...project,
      features: (project.features || []).filter((f) => f.id !== id),
    };

    projectsStore.put(updatedProject);

    try {
      featuresStore.delete(id);
    } catch {
      // ignore if store missing
    }

    tx.oncomplete = () => resolve(undefined);
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateProjectBranches(db: IDBDatabase, projectId: string, branches: Branch[]) {
  const project = await getProjectById(db, projectId);
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('projects', 'readwrite');
    const store = transaction.objectStore('projects');

    const request = store.put({
      ...project,
      branches,
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllProjects(db: IDBDatabase): Promise<Project[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('projects', 'readonly');
    const store = transaction.objectStore('projects');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as Project[]);
    request.onerror = () => reject(request.error);
  });
}

export async function getProjectById(db: IDBDatabase, id: string): Promise<Project> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('projects', 'readonly');
    const store = transaction.objectStore('projects');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result as Project);
    request.onerror = () => reject(request.error);
  });
}

export async function getProjectChats(db: IDBDatabase, projectId: string): Promise<ChatHistoryItem[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.getAll();

    request.onsuccess = () => {
      const allChats = request.result as ChatHistoryItem[];

      // Filter chats that have metadata with this projectId
      const projectChats = allChats.filter((chat) => chat.metadata?.projectId === projectId);
      resolve(projectChats);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getProjectChatById(
  db: IDBDatabase,
  projectId: string,
  chatId: string,
): Promise<ChatHistoryItem | null> {
  const projects = await getAllProjects(db);
  const project = projects.find((p) => p.id == projectId);

  if (!project) {
    return null;
  }

  const features = project.features || [];
  const feature = features.find((f) => f.id == chatId);

  if (!feature) {
    return null;
  }

  return await getMessagesById(db, feature.id);
}

export async function deleteProjectById(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('projects', 'readwrite');
    const store = transaction.objectStore('projects');
    const request = store.delete(id);

    request.onsuccess = () => resolve(undefined);
    request.onerror = () => reject(request.error);
  });
}

// Workflows persistence
export interface WorkflowColumn {
  id: string;
  status: string; // maps to FeatureStatus
  title: string;
  wipLimit?: number;
  order: number;
}

// Comments persistence
export interface CommentRow {
  id: string;
  targetType: 'project' | 'feature';
  targetId: string;
  authorId: string;
  authorName?: string;
  text: string;
  timestamp: string;
}

export async function addComment(db: IDBDatabase, comment: CommentRow): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('comments', 'readwrite');
      tx.objectStore('comments').put(comment);
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
    } catch (e) {
      reject(e as any);
    }
  });
}

export async function listCommentsByTarget(
  db: IDBDatabase,
  targetType: CommentRow['targetType'],
  targetId: string,
): Promise<CommentRow[]> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('comments', 'readonly');
      const store = tx.objectStore('comments');
      const index = store.index('targetId');
      const req = index.getAll(targetId);

      req.onsuccess = () => {
        const rows = (req.result as CommentRow[]).filter((r) => r.targetType === targetType);
        rows.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        resolve(rows);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function deleteComment(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('comments', 'readwrite');
      tx.objectStore('comments').delete(id);
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
    } catch (e) {
      reject(e as any);
    }
  });
}

export interface Workflow {
  id: string; // use projectId as key
  projectId: string;
  columns: WorkflowColumn[];
  updatedAt: string;
}

export async function upsertWorkflow(db: IDBDatabase, workflow: Workflow): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('workflows', 'readwrite');
    const store = tx.objectStore('workflows');
    store.put(workflow);
    tx.oncomplete = () => resolve(undefined);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getWorkflowByProjectId(db: IDBDatabase, projectId: string): Promise<Workflow | undefined> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('workflows', 'readonly');
      const store = tx.objectStore('workflows');
      const index = store.index('projectId');
      const req = index.get(projectId);
      req.onsuccess = () => resolve(req.result as Workflow | undefined);
      req.onerror = () => reject(req.error);
    } catch {
      resolve(undefined);
    }
  });
}

// Integrations persistence
export type IntegrationProvider = 'github' | 'gitlab' | 'slack' | 'discord' | 'jira' | 'linear';
export interface IntegrationConfigRow {
  id: string;
  provider: IntegrationProvider;
  scopeType: 'org' | 'team' | 'project';
  scopeId: string; // projectId/teamId/orgId
  name?: string;
  config: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export async function upsertIntegration(db: IDBDatabase, row: IntegrationConfigRow): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('integrations', 'readwrite');
      tx.objectStore('integrations').put(row);
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
    } catch (e) {
      reject(e as any);
    }
  });
}

export async function listIntegrationsByScope(
  db: IDBDatabase,
  scopeType: IntegrationConfigRow['scopeType'],
  scopeId: string,
): Promise<IntegrationConfigRow[]> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('integrations', 'readonly');
      const store = tx.objectStore('integrations');
      const idx = store.index('scopeId');
      const req = idx.getAll(scopeId);

      req.onsuccess = () => {
        const rows = (req.result as IntegrationConfigRow[]).filter((r) => r.scopeType === scopeType);
        resolve(rows);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function deleteIntegration(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('integrations', 'readwrite');
      tx.objectStore('integrations').delete(id);
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
    } catch (e) {
      reject(e as any);
    }
  });
}
