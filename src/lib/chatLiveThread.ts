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

export type ConversationLike = {
  Id: number;
  SenderID?: unknown;
  Message?: unknown;
  Date?: unknown;
  Time?: unknown;
  createdAt?: number;
};

/** Dispatcher / broadcast senders sit on the outbound side of a 1:1 thread. */
export function isDispatcherSenderId(senderId: unknown): boolean {
  const sid = String(senderId ?? '').trim();
  if (!sid || sid === '0') return true;
  return /^dispatcher/i.test(sid);
}

/**
 * Chronological clock for mixed HTTP + live rows.
 * HTTP history often has Date/Time but no createdAt (treated as 0 by a naive sort,
 * which parks history at the top and live replies at the bottom).
 */
export function conversationSortMs(row: ConversationLike): number {
  const created = Number(row.createdAt) || 0;
  if (created > 1e12) return created;
  if (created > 1e9 && created < 1e12) return created * 1000;
  const date = String(row.Date ?? '').trim();
  const time = String(row.Time ?? '').trim();
  if (date) {
    const clock = time.length >= 8 ? time : time.length >= 5 ? `${time}:00` : '00:00:00';
    const parsed = Date.parse(`${date}T${clock}`);
    if (Number.isFinite(parsed)) return parsed;
  }
  const id = Number(row.Id) || 0;
  if (id > 1e12) return id;
  return id;
}

function conversationBodyKey(row: ConversationLike): string {
  const sender = String(row.SenderID ?? '').trim().toLowerCase();
  const text = String(row.Message ?? '').trim();
  return `${sender}|${text}|${Math.floor(conversationSortMs(row) / 5000)}`;
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
    const date = String(row.date ?? row.Date ?? '');
    const time = String(row.time ?? row.Time ?? '');
    const createdRaw = parseInt(String(row.createdAt ?? ''), 10) || 0;
    const idNum = Number(row.id ?? row.Id);
    const id = Number.isFinite(idNum) && idNum > 0 ? idNum : createdRaw || Math.abs(hashKey(key));
    const createdAt = conversationSortMs({
      Id: id,
      createdAt: createdRaw,
      Date: date,
      Time: time,
    });
    rows.push({
      Id: id,
      SenderID: String(row.senderId ?? row.SenderId ?? ''),
      User: String(row.senderName ?? row.SenderName ?? ''),
      Message: text,
      Date: date,
      Time: time,
      createdAt,
    });
  }
  return rows.sort((a, b) => conversationSortMs(a) - conversationSortMs(b) || a.Id - b.Id);
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
      if (!prev || conversationSortMs(row) >= conversationSortMs(prev)) map.set(key, row);
    }
  }
  return [...map.values()].sort((a, b) => conversationSortMs(a) - conversationSortMs(b) || a.Id - b.Id);
}

export function mergeConversationRows<T extends ConversationLike>(primary: T[], incoming: T[]): T[] {
  const persistent = new Map<number, T>();
  const rest: T[] = [];
  for (const row of [...primary, ...incoming]) {
    const id = Number(row.Id) || 0;
    if (id > 0 && id < 1e12) {
      const prev = persistent.get(id);
      if (!prev || conversationSortMs(row) >= conversationSortMs(prev)) persistent.set(id, row);
    } else {
      rest.push(row);
    }
  }
  const used = new Set([...persistent.values()].map(conversationBodyKey));
  const extras: T[] = [];
  for (const row of rest) {
    const key = conversationBodyKey(row);
    if (used.has(key)) continue;
    used.add(key);
    extras.push(row);
  }
  return [...persistent.values(), ...extras].sort(
    (a, b) => conversationSortMs(a) - conversationSortMs(b) || (Number(a.Id) || 0) - (Number(b.Id) || 0),
  );
}
