async function postDataManager<T = unknown>(
  selector: 'DataSelector' | 'DataSelectorLess',
  action: string,
  data: Array<{ name: string; value: string }>,
): Promise<T> {
  const r = await fetch(`/DataManager/Data.aspx/${selector}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, action }),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((json as { error?: string }).error || `DataManager ${action} failed (${r.status})`);
  return json as T;
}

export interface DriverChatListItem {
  Id: string | number;
  UserFName: string;
  UserLName: string;
  Count: number;
  PlayerId?: string;
}

export interface ChatMessageRow {
  Id: number;
  SenderID: string | number;
  User: string;
  Message: string;
  Date: string;
  Time: string;
}

function formatDateTime(d = new Date()): string {
  const date = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${date} ${h}:${m}`;
}

export async function fetchDriverChatList(): Promise<DriverChatListItem[]> {
  const json = await postDataManager<{ d: string }>('DataSelectorLess', '[RetrieveMessages]', []);
  const rows = JSON.parse(json.d || '[]') as DriverChatListItem[];
  return Array.isArray(rows) ? rows : [];
}

export async function fetchDispatcherConversation(driverId: string): Promise<ChatMessageRow[]> {
  const json = await postDataManager<{ d: string }>('DataSelectorLess', '[DispatcherConversation]', [
    { name: 'Id', value: driverId },
  ]);
  const parsed = JSON.parse(json.d || '{}') as { dt2?: ChatMessageRow[] };
  return Array.isArray(parsed.dt2) ? parsed.dt2 : [];
}

export async function fetchUnreadFromDriver(driverId: string): Promise<ChatMessageRow[]> {
  const json = await postDataManager<{ d: string }>('DataSelectorLess', '[DispatcherUnReadMessages]', [
    { name: 'Id', value: driverId },
  ]);
  const rows = JSON.parse(json.d || '[]') as ChatMessageRow[];
  return Array.isArray(rows) ? rows : [];
}

export async function sendDirectMessage(receiverId: string, message: string): Promise<void> {
  const text = message.trim();
  if (!text) throw new Error('Message is empty');
  const r = await fetch('/DataManager/Data.aspx/DataProcessor', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: '[MessageInsert]',
      data: [
        { name: 'RecieverId', value: receiverId },
        { name: 'Message', value: text },
        { name: 'DateTime', value: formatDateTime() },
      ],
    }),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((json as { error?: string }).error || `Send failed (${r.status})`);
}

export function isOutboundMessage(row: ChatMessageRow, driverId: string): boolean {
  return String(row.SenderID) !== String(driverId);
}

export function driverDisplayName(row: DriverChatListItem): string {
  return `${row.UserFName || ''} ${row.UserLName || ''}`.trim() || `Driver ${row.Id}`;
}
