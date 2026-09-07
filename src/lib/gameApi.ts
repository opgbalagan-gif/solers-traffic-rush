import { assetUrl } from '@/src/config/game';
import { GOOGLE_SHEETS_API } from '@/src/config/leaderboard';

export async function gameApi<T = Record<string, unknown>>(action: string, body?: unknown): Promise<T> {
  const remote = Boolean(GOOGLE_SHEETS_API);
  const url = remote ? `${GOOGLE_SHEETS_API}${body === undefined ? `?action=${encodeURIComponent(action)}` : ''}` : assetUrl(`/api/${action}`);
  const response = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    // Apps Script handles simple CORS requests without an unsupported OPTIONS preflight.
    headers: body === undefined ? undefined : { 'Content-Type': remote ? 'text/plain;charset=UTF-8' : 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(remote ? { ...(body as object), action } : body),
    credentials: 'omit', redirect: 'follow', cache: 'no-store', signal: AbortSignal.timeout(remote ? 20000 : 6000),
  });
  let value: T & {error?: string};
  try { value = await response.json(); }
  catch { throw new Error('Нет связи с общей таблицей. Попробуйте ещё раз.'); }
  if (!response.ok || value.error) throw new Error(value.error || 'Не удалось связаться с сервером результатов.');
  return value;
}
