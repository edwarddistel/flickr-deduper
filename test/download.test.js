import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { backupPhotos, safeImageUrl } from '../src/download.js';

test('backup downloader only accepts Flickr image hosts over HTTPS', () => {
  assert.equal(safeImageUrl('https://live.staticflickr.com/3/test.jpg').hostname, 'live.staticflickr.com');
  assert.throws(() => safeImageUrl('https://evil.example/1.jpg'), /staticflickr/);
  assert.throws(() => safeImageUrl('http://live.staticflickr.com/1.jpg'), /HTTPS/);
  assert.throws(() => safeImageUrl('https://live.staticflickr.com.evil.com/1.jpg'), /staticflickr/);
});

test('downloads to id-based filenames, skips existing files, and records missing URLs', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'flickr-backup-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  let requests = 0;
  const album = { photos: [{ id: '123', url: 'https://live.staticflickr.com/1/a.jpg' }, { id: '456' }] };
  const options = { fetchImpl: async () => { requests++; return new Response(Buffer.from('jpeg bytes')); } };
  assert.deepEqual(await backupPhotos(album, dir, options), { downloaded: 1, skipped: 0, missingUrl: 1, failures: [] });
  assert.deepEqual(await readdir(dir), ['123.jpg']);
  assert.deepEqual(await backupPhotos(album, dir, options), { downloaded: 0, skipped: 1, missingUrl: 1, failures: [] });
  assert.equal(requests, 1);
});

test('failed streams are reported and partial backup files are removed', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'flickr-bad-download-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const brokenStream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('partial data'));
      controller.error(new Error('stream interrupted'));
    },
  });
  const album = { photos: [{ id: '999', url: 'https://live.staticflickr.com/1/a.jpg' }] };
  const result = await backupPhotos(album, dir, { fetchImpl: async () => new Response(brokenStream) });
  assert.equal(result.failures.length, 1);
  assert.deepEqual(await readdir(dir), []);
});
