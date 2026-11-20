import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AlbumService } from '../src/service.js';

function photos(ids) {
  return ids.map((id, index) => ({ id: String(id), datetaken: '2025-01-01 12:00:00', dateupload: String(100 + index) }));
}

async function fixture(t, overrides = {}) {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'flickr-service-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const config = { albumId: '42', userId: 'u', primaryPhotoId: '', dataDir, autoReorder: false, autoDelete: false, ...overrides };
  return { config, dataDir };
}

test('single-page Flickr albums refresh and persist without hanging', async (t) => {
  const { config, dataDir } = await fixture(t);
  const client = { listPhotos: async (_id, page) => {
    assert.equal(page, 1);
    return { photoset: { pages: 1, primary: '1', photo: photos([1, 2]) } };
  } };
  const service = new AlbumService(client, config);
  assert.deepEqual(await service.refresh(), { count: 2, duplicateGroups: 1, pages: 1 });
  assert.deepEqual((await service.duplicates())[0].candidateDeleteIds, ['2']);
  const stored = JSON.parse(await readFile(path.join(dataDir, 'album.json'), 'utf8'));
  assert.equal(stored.photos.length, 2);
});

test('multi-page albums fetch all pages and collapse repeat IDs', async (t) => {
  const { config } = await fixture(t);
  const pages = [];
  const service = new AlbumService({ listPhotos: async (_id, page) => {
    pages.push(page);
    return { photoset: { pages: 2, primary: '2', photo: photos(page === 1 ? [1, 2] : [2, 3]) } };
  } }, config);
  assert.equal((await service.refresh()).count, 3);
  assert.deepEqual(pages, [1, 2]);
});

test('deletion requires exact album confirmation and explicit timestamp acknowledgement', async (t) => {
  const { config } = await fixture(t);
  let deletes = 0;
  const service = new AlbumService({ deletePhoto: async () => { deletes++; } }, config);
  await assert.rejects(service.deleteCandidates({ confirmAlbumId: 'WRONG', allowTimestampOnly: true }), /exact album ID/);
  await assert.rejects(service.deleteCandidates({ confirmAlbumId: '42' }), /timestamp-only/);
  assert.equal(deletes, 0);
});

test('confirmed deletions await each API response and refresh saved state afterward', async (t) => {
  const { config } = await fixture(t);
  let ids = ['1', '2'];
  const deleted = [];
  const client = {
    listPhotos: async () => ({ photoset: { pages: 1, primary: '1', photo: photos(ids) } }),
    deletePhoto: async (id) => { await Promise.resolve(); deleted.push(id); ids = ids.filter((photoId) => photoId !== id); },
  };
  const service = new AlbumService(client, config);
  const result = await service.deleteCandidates({ confirmAlbumId: '42', allowTimestampOnly: true });
  assert.deepEqual(result, { deleted: 1, candidates: 1 });
  assert.deepEqual(deleted, ['2']);
  assert.deepEqual((await service.load()).photos.map(({ id }) => id), ['1']);
});

test('exclusive operations reject concurrent writes with a conflict response', async (t) => {
  const { config } = await fixture(t);
  let finish;
  const service = new AlbumService({}, config);
  const pending = service.exclusive(() => new Promise((resolve) => { finish = resolve; }));
  await assert.rejects(service.exclusive(async () => {}), { statusCode: 409 });
  finish();
  await pending;
});

test('sync refreshes and obtains photo sizes without automatic deletion by default', async (t) => {
  const { config } = await fixture(t);
  let deletes = 0;
  const service = new AlbumService({
    listPhotos: async () => ({ photoset: { pages: 1, primary: '1', photo: photos(['1', '2']) } }),
    sizes: async () => ({ sizes: { size: [{ width: 100, height: 100, source: 'https://live.staticflickr.com/a.jpg' }] } }),
    deletePhoto: async () => { deletes++; },
  }, config);
  const result = await service.sync();
  assert.equal(result.sizes.updated, 2);
  assert.equal(result.duplicateCandidates, 1);
  assert.equal(deletes, 0);
});

test('opted-in nightly deletion is rejected without both explicit acknowledgements', async (t) => {
  const { config } = await fixture(t, { autoDelete: true, autoDeleteConfirmAlbumId: '42', autoDeleteAllowTimestampOnly: false });
  const service = new AlbumService({ listPhotos: async () => ({ photoset: { pages: 1, photo: [] } }) }, config);
  await assert.rejects(service.sync(), /explicit timestamp-only/);
});
