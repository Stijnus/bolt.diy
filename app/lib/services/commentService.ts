import { openDatabase, addComment, listCommentsByTarget, deleteComment, type CommentRow } from '~/lib/persistence/db';

export type { CommentRow };

export async function createComment(input: Omit<CommentRow, 'id' | 'timestamp'> & { id?: string; text: string }) {
  const db = await openDatabase();

  if (!db) {
    throw new Error('Database not available');
  }

  const row: CommentRow = {
    id: input.id || `${Date.now()}`,
    targetType: input.targetType,
    targetId: input.targetId,
    authorId: input.authorId || 'local-user',
    authorName: input.authorName,
    text: input.text,
    timestamp: new Date().toISOString(),
  };
  await addComment(db, row);

  return row;
}

export async function getComments(targetType: CommentRow['targetType'], targetId: string) {
  const db = await openDatabase();

  if (!db) {
    return [];
  }

  return listCommentsByTarget(db, targetType, targetId);
}

export async function removeComment(id: string) {
  const db = await openDatabase();

  if (!db) {
    return;
  }

  await deleteComment(db, id);
}
