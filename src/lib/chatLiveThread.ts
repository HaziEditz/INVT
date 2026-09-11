/** Shared live Direct/Inbox/Broadcast thread: chatMessages + messages, raw + D-normalized ids. */

export function chatThreadDriverIds(driverId: string): string[] {
  const raw = String(driverId || '').trim();
  if (!raw) return [];
  const ids = new Set<string>([raw]);
  const stripped = raw.replace(/[\s\-_.]/g, '');
  const withLetter = stripped.match(/^([dD])(\d+)$/);
  const digits = stripped.match(/^(\d+)$/);
  if (withLetter) {
    const n = parseInt(withLetter[2], 10);
    ids.add('D' + String(n).padStart(3, '0'));
    ids.add(String(n));
  } else if (digits) {
    const n = parseInt(digits[1], 10);
    ids.add('D' + String(n).padStart(3, '0'));
    ids.add(String(n));
  }
  return [...ids];
}

export function chatDriverIdsMatch(a: string, b: string): boolean {
  const left = new Set(chatThreadDriverIds(a));
  return chatThreadDriverIds(b).some((id) => left.has(id));
}

export function chatThreadDbPaths(companyId: string, driverId: string): string[] {
  const cid = String(companyId || '').trim();
  if (!cid) return [];
  const paths: string[] = [];
  for (const id of chatThreadDriverIds(driverId)) {
    paths.push(`chatMessages/${cid}/${id}`);
    paths.push(`messages/${cid}/${id}`);
  }
  return paths;
}

export interface LiveChatRow {
  Id: number;
  SenderID: string;
  User: string;
  Message: string;
  Date: string;
  Time: string;
  createdAt: number;
}

function rowKey(row: LiveChatRow): string {
  if (row.Id) return `id:${row.Id}`;
  return `${row.SenderID}|${row.Message}|${row.createdAt || `${row.Date} ${row.Time}`}`;
}

export function firebaseChatValToRows(val: unknown): LiveChatRow[] {
  if (!val || typeof val !== 'object') return [];
  const rows: LiveChatRow[] = [];
  for (const [key, raw] of Object.entries(val as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const text = String(row.message ?? row.Message ?? '').trim();
    if (!text) continue;
    const createdAt = parseInt(String(row.createdAt ?? ''), 10) || 0;
    const idNum = Number(row.id ?? row.Id);
    rows.push({
      Id: Number.isFinite(idNum) && idNum > 0 ? idNum : createdAt || Math.abs(hashKey(key)),
      SenderID: String(row.senderId ?? row.SenderId ?? ''),
      User: String(row.senderName ?? row.SenderName ?? ''),
      Message: text,
      Date: String(row.date ?? row.Date ?? ''),
      Time: String(row.time ?? row.Time ?? ''),
      createdAt,
    });
  }
  return rows.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || a.Id - b.Id);
}

function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return h || 1;
}

export function mergeLiveChatRowLists(lists: LiveChatRow[][]): LiveChatRow[] {
  const map = new Map<string, LiveChatRow>();
  for (const list of lists) {
    for (const row of list) {
      const key = rowKey(row);
      const prev = map.get(key);
      if (!prev || (row.createdAt || 0) >= (prev.createdAt || 0)) map.set(key, row);
    }
  }
  return [...map.values()].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || a.Id - b.Id);
}

export function mergeConversationRows<T extends { Id: number; SenderID?: unknown; Message?: unknown; Date?: unknown; Time?: unknown; createdAt?: number }>(
  primary: T[],
  incoming: T[],
): T[] {
  const map = new Map<string, T>();
  const keyOf = (r: T) =>
    String(r.Id || `${r.SenderID}|${r.Message}|${r.Date}|${r.Time}`);
  for (const r of primary) map.set(keyOf(r), r);
  for (const r of incoming) map.set(keyOf(r), r);
  return [...map.values()].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || a.Id - b.Id);
}
