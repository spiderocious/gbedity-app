// Opaque base64url pagination cursor. Cursor-based only — offset pagination is banned.

export interface CursorPayload {
  lastId: string;
  lastSortKey: string;
}

export const encodeCursor = (payload: CursorPayload): string =>
  Buffer.from(JSON.stringify(payload)).toString('base64url');

export const decodeCursor = (cursor: string): CursorPayload | null => {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'lastId' in parsed &&
      'lastSortKey' in parsed &&
      typeof (parsed as CursorPayload).lastId === 'string' &&
      typeof (parsed as CursorPayload).lastSortKey === 'string'
    ) {
      return parsed as CursorPayload;
    }
    return null;
  } catch {
    return null;
  }
};
