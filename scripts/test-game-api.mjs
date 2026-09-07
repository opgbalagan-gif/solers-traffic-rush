import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync('src/lib/gameApi.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
function client(fetcher, remote = true) {
  const exported = {}, timeouts = [];
  new Function('exports', 'require', 'fetch', 'AbortSignal', 'setTimeout', code)(
    exported,
    name => name.endsWith('/leaderboard') ? { GOOGLE_SHEETS_API: remote ? 'https://example.test/exec' : '' } : { assetUrl: path => path },
    fetcher,
    { timeout: ms => { timeouts.push(ms); return new AbortController().signal; } },
    callback => callback(),
  );
  return { api: exported.gameApi, timeouts };
}

// Simulate a committed write whose response was lost, using the same run-keyed
// idempotency contract as Apps Script. The retry must not create another row.
const rows = new Map(), requests = [];
const successful = client(async (url, init) => {
  requests.push({ url, ...init });
  const body = JSON.parse(init.body);
  if (!rows.has(body.id)) rows.set(body.id, body);
  if (requests.length === 1) throw new DOMException('Fetch is aborted', 'AbortError');
  return Response.json({ saved: true });
});
const score = { id: 'same-run', token: 'same-token', name: 'Пилот', score: 150, distance: 600 };
assert.equal((await successful.api('scores', score)).saved, true);
assert.equal(rows.size, 1);
assert.equal(requests.length, 2);
assert.equal(requests[0].body, requests[1].body);
assert.equal(requests[1].headers['Content-Type'], 'text/plain;charset=UTF-8');
assert.equal(requests[1].credentials, 'omit');
assert.deepEqual(successful.timeouts, [60000, 60000]);

let bodyReads = 0;
const bodyAborted = client(async () => ({ ok: true, status: 200, async json() {
  if (++bodyReads === 1) throw new DOMException('Fetch is aborted', 'AbortError');
  return { saved: true };
} }));
assert.equal((await bodyAborted.api('scores', score)).saved, true, 'An abort while reading the response is retried too');

let failedCalls = 0;
const unavailable = client(async () => { failedCalls++; throw new DOMException('Timed out', 'TimeoutError'); });
await assert.rejects(unavailable.api('scores', score), /Сервер таблицы не ответил/);
assert.equal(failedCalls, 2, 'Retries are bounded and never claim a save');

let rejectedCalls = 0;
const rejected = client(async () => { rejectedCalls++; return Response.json({ error: 'Неверный позывной' }); });
await assert.rejects(rejected.api('scores', score), /Неверный позывной/);
assert.equal(rejectedCalls, 1, 'Validation errors are returned without retry');

let localCalls = 0;
const local = client(async () => { localCalls++; throw new TypeError('Failed to fetch'); }, false);
await assert.rejects(local.api('scores', score), /Сервер таблицы не ответил/);
assert.equal(localCalls, 1, 'A backend without idempotent writes is not retried automatically');
assert.deepEqual(local.timeouts, [6000]);

let starts = 0;
const start = client(async () => ++starts === 1 ? new Response('', { status: 503 }) : Response.json({ id: 'registered', token: 'signed' }));
assert.equal((await start.api('runs', {})).id, 'registered', 'A temporary registration outage can recover before the race');
console.log('PASS: lost save responses retry the identical run without duplicate rows; body aborts, bounded failures, validation errors, registration recovery and backend-specific retry behavior.');
