import { assetUrl } from '@/src/config/game';
import { GOOGLE_SHEETS_API } from '@/src/config/leaderboard';

export async function gameApi<T = Record<string, unknown>>(action: string, body?: unknown): Promise<T> {
  const remote = Boolean(GOOGLE_SHEETS_API);
  const url = remote ? `${GOOGLE_SHEETS_API}${body === undefined ? `?action=${encodeURIComponent(action)}` : ''}` : assetUrl(`/api/${action}`);
  // A lost Google response can follow a successful write. Reuse the exact run ID
  // and payload: the Apps Script score endpoint handles this retry idempotently.
  const payload = body === undefined ? undefined : JSON.stringify(remote ? { ...(body as object), action } : body);
  const attempts = remote && (body === undefined || action === 'runs' || action === 'scores') ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    let response: Response;
    let value: T & {error?: string};
    try {
      response = await fetch(url, {
        method: body === undefined ? 'GET' : 'POST',
        // Keep a simple CORS request: Apps Script does not handle OPTIONS preflight.
        headers: body === undefined ? undefined : { 'Content-Type': remote ? 'text/plain;charset=UTF-8' : 'application/json' },
        body: payload, credentials: 'omit', redirect: 'follow', cache: 'no-store',
        signal: AbortSignal.timeout(remote ? 60000 : 6000),
      });
      if ([408, 429, 502, 503, 504].includes(response.status)) throw new Error('temporary-response');
      value = await response.json();
      if (!value || typeof value !== 'object') throw new Error('invalid-response');
    } catch {
      if (attempt + 1 < attempts) {
        await new Promise(resolve => setTimeout(resolve, 800));
        continue;
      }
      throw new Error('Сервер таблицы не ответил. Проверьте интернет и попробуйте ещё раз.');
    }
    // Rejected names, expired sessions and invalid scores need player action,
    // so a completed application error must not trigger a network retry.
    if (!response.ok || value.error) throw new Error(value.error || 'Не удалось связаться с сервером результатов.');
    return value;
  }
  throw new Error('Не удалось связаться с сервером результатов.');
}
