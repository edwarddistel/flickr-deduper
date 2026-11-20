import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.js';

async function apiFixture(t, { adminToken = 'test-admin' } = {}) {
  const service = {
    client: { testLogin: async () => ({ user: { id: 'tester' } }) },
    load: async () => ({ photos: [] }),
    duplicates: async () => [{ keepId: '1', candidateDeleteIds: ['2'] }],
    deleteCandidates: async (options) => ({ calledWith: options }),
    refresh: async () => ({ count: 2 }),
    reorder: async () => ({ changed: true }),
    markUgly: async (ids) => ids,
  };
  const server = createApp(service, { adminToken });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('GET /dedupe is only a preview; destructive operations require POST', async (t) => {
  const base = await apiFixture(t);
  const response = await fetch(`${base}/dedupe`);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).result[0].candidateDeleteIds, ['2']);
  assert.equal((await fetch(`${base}/reorder`)).status, 405);
});

test('mutating endpoints reject unsigned requests', async (t) => {
  const base = await apiFixture(t);
  const response = await fetch(`${base}/dedupe`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 403);
});

test('authorized destructive endpoint passes confirmation and acknowledgement through', async (t) => {
  const base = await apiFixture(t);
  const response = await fetch(`${base}/dedupe`, {
    method: 'POST', headers: { authorization: 'Bearer test-admin', 'content-type': 'application/json' },
    body: JSON.stringify({ confirmAlbumId: '42', allowTimestampOnly: true }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).result.calledWith, { confirmAlbumId: '42', allowTimestampOnly: true });
});

test('invalid JSON bodies are rejected with HTTP 400', async (t) => {
  const base = await apiFixture(t);
  const response = await fetch(`${base}/ugly`, { method: 'POST', headers: { authorization: 'Bearer test-admin' }, body: '{' });
  assert.equal(response.status, 400);
});

test('unknown API routes respond with 404', async (t) => {
  const base = await apiFixture(t);
  assert.equal((await fetch(`${base}/no-such-route`)).status, 404);
});
