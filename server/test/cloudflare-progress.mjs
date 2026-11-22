import assert from 'node:assert/strict';
import test from 'node:test';
import { routeProgress } from '../../functions/_lib/progress.js';

const accountA = { id: 'a'.repeat(64) };
const accountB = { id: 'b'.repeat(64) };
const makeRequest = (account, data) => new Request('https://klarbase.brclio.com/api/progress', {
  method: data === undefined ? 'GET' : 'PUT',
  headers: { 'X-Klarbase-Account': account.id, 'Content-Type': 'application/json' },
  body: data === undefined ? undefined : JSON.stringify({ data }),
});

function storeFixture() {
  const files = new Map();
  const reader = { get: async path => files.get(path) ?? null };
  return {
    files,
    read: fn => fn(reader),
    mutate: fn => fn({ ...reader, set: (path, data) => files.set(path, data) }),
  };
}

test('Cloudflare progress stores sections separately and keeps the best results on retry', async () => {
  const store = storeFixture();
  const context = { store, user: accountA };
  const first = { progress: { first: { stars: 3, moves: 6 } },
    dailies: { '2026-11-22': 2 }, map: { explored: ['0,0'], lit: ['first'] } };
  await routeProgress(makeRequest(accountA, first), context);
  const second = await routeProgress(makeRequest(accountA, { progress: { first: { stars: 1, moves: 10 } },
    map: { explored: ['1,0'] } }), context);
  const { data, updatedAt } = await second.json();
  assert.deepEqual(data.progress, first.progress);
  assert.deepEqual(data.dailies, first.dailies);
  assert.deepEqual(data.map.explored, ['0,0', '1,0']);
  assert.deepEqual([...store.files.keys()].map(path => path.split('/').at(-1)).sort(),
    ['dailies.json', 'map.json', 'progress.json']);
  const retry = await routeProgress(makeRequest(accountA, data), context);
  assert.equal((await retry.json()).updatedAt, updatedAt);

  const other = await routeProgress(makeRequest(accountB), { store, user: accountB });
  assert.deepEqual(await other.json(), { data: null, updatedAt: null });
  await assert.rejects(routeProgress(makeRequest(accountA, first), { store, user: accountB }), { status: 409 });
  await assert.rejects(routeProgress(makeRequest(accountA), { store, user: null }), { status: 401 });
});
