/** Client-side offline action queue for courier status updates */

const KEY = 'soyol_courier_offline_queue';

export type OfflineAction = {
  id: string;
  url: string;
  method: string;
  body?: unknown;
  createdAt: number;
};

function read(): OfflineAction[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write(items: OfflineAction[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(-40)));
  } catch {
    /* ignore */
  }
}

export function enqueueOfflineAction(action: Omit<OfflineAction, 'id' | 'createdAt'>) {
  const items = read();
  items.push({
    ...action,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  });
  write(items);
  return items.length;
}

export function peekOfflineQueue() {
  return read();
}

export async function flushOfflineQueue(
  authFetchFn: (url: string, init?: RequestInit) => Promise<Response>
) {
  const items = read();
  if (items.length === 0) return { flushed: 0, remaining: 0 };

  const remaining: OfflineAction[] = [];
  let flushed = 0;

  for (const item of items) {
    try {
      const res = await authFetchFn(item.url, {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        body: item.body != null ? JSON.stringify(item.body) : undefined,
      });
      if (res.ok) flushed += 1;
      else remaining.push(item);
    } catch {
      remaining.push(item);
    }
  }

  write(remaining);
  return { flushed, remaining: remaining.length };
}
