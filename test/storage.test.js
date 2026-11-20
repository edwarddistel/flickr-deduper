import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadAlbum, saveAlbum } from '../src/storage.js';
import { saveCredentials } from '../src/oauth.js';
import { configFromEnv, requireConfig } from '../src/config.js';

async function temporary(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'flickr-file-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('album snapshots are saved as valid JSON and reloaded', async (t) => {
  const dir = await temporary(t);
  const album = { version: 2, albumId: '123', photos: [{ id: '9' }], uglyPhotoIds: [] };
  await saveAlbum(dir, album);
  assert.deepEqual(await loadAlbum(dir), album);
  assert.equal((await readFile(path.join(dir, 'album.json'), 'utf8')).endsWith('\n'), true);
});

test('malformed stored album is not silently discarded', async (t) => {
  const dir = await temporary(t);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'album.json'), '{not valid JSON');
  await assert.rejects(loadAlbum(dir), SyntaxError);
});

test('OAuth token saving preserves all existing .env settings', async (t) => {
  const file = path.join(await temporary(t), '.env');
  await writeFile(file, 'FLICKR_CONSUMER_KEY=some-key\nFLICKR_OAUTH_TOKEN=old-token\nAUTO_REORDER=true\n');
  await saveCredentials(file, { FLICKR_OAUTH_TOKEN: 'new-token', FLICKR_OAUTH_TOKEN_SECRET: 'new-secret' });
  const result = await readFile(file, 'utf8');
  assert.match(result, /FLICKR_CONSUMER_KEY=some-key/);
  assert.match(result, /AUTO_REORDER=true/);
  assert.match(result, /FLICKR_OAUTH_TOKEN=new-token/);
  assert.match(result, /FLICKR_OAUTH_TOKEN_SECRET=new-secret/);
  assert.doesNotMatch(result, /old-token/);
});

test('OAuth token saving rejects unexpected keys and newlines', async (t) => {
  const file = path.join(await temporary(t), '.env');
  await assert.rejects(saveCredentials(file, { SOME_OTHER_KEY: 'foo' }), /Unexpected credential key/);
  await assert.rejects(saveCredentials(file, { FLICKR_OAUTH_TOKEN: 'a\nEXTRA=bad' }), /Invalid credential value/);
});

test('config loads environment fields and enforces required credentials', () => {
  const config = configFromEnv({ FLICKR_CONSUMER_KEY: ' key ', FLICKR_ALBUM_ID: 'photoset', AUTO_REORDER: 'true', AUTO_DELETE: 'false' });
  assert.equal(config.consumerKey, 'key');
  assert.equal(config.autoReorder, true);
  assert.equal(config.autoDelete, false);
  assert.throws(() => requireConfig(config), /Missing configuration/);
});
