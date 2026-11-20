import test from 'node:test';
import assert from 'node:assert/strict';
import { addUgly, buildAlbum, duplicatePlan, largestSize, reorderPlan, takenAt } from '../src/album.js';

const raw = [
  { id: '12', datetaken: '2025-04-01 12:00:00', dateupload: '30' },
  { id: '13', datetaken: '2025-04-01 12:00:00', dateupload: '20' },
  { id: '14', datetaken: '2025-04-02 13:00:00', dateupload: '40' },
  { id: '15', datetaken: 'unknown', dateupload: '50' },
];

test('buildAlbum collapses repeated API rows while retaining prior URLs and valid flags', () => {
  const previous = { albumId: '1', primaryId: '12', photos: [{ id: '13', url: 'https://live.staticflickr.com/photo.jpg' }], uglyPhotoIds: ['13', 'gone'] };
  const result = buildAlbum([...raw, raw[0]], previous, { albumId: '77', primaryId: '14' });
  assert.deepEqual(result.photos.map(({ id }) => id), ['12', '13', '14', '15']);
  assert.equal(result.albumId, '77');
  assert.equal(result.primaryId, '14');
  assert.equal(result.photos[1].url, 'https://live.staticflickr.com/photo.jpg');
  assert.deepEqual(result.uglyPhotoIds, ['13']);
  assert.equal(result.photos[3].dateTaken, null);
});

test('equal timestamps are candidates, not assumed identical pixels', () => {
  const album = buildAlbum(raw, {}, { primaryId: '12' });
  assert.deepEqual(duplicatePlan(album), [{ dateTaken: '2025-04-01 12:00:00', keepId: '12', candidateDeleteIds: ['13'] }]);
});

test('when no primary is in a group, earliest uploaded photo wins', () => {
  const album = buildAlbum(raw, {}, { primaryId: '14' });
  assert.deepEqual(duplicatePlan(album)[0].candidateDeleteIds, ['12']);
});

test('sorts newest first without dropping timestamp ties or missing-date photos', () => {
  const album = buildAlbum(raw, {}, { primaryId: '12' });
  const plan = reorderPlan(album);
  assert.deepEqual(plan.photoIds, ['14', '12', '13', '15']);
  assert.equal(plan.primaryId, '12');
});

test('primary override must be an existing photo', () => {
  const album = buildAlbum(raw, {}, { primaryId: '12' });
  assert.equal(reorderPlan(album, 'does-not-exist').primaryId, '12');
  assert.equal(reorderPlan(album, '14').primaryId, '14');
});

test('ugly photo tracking is idempotent and excludes unknown photos', () => {
  const album = buildAlbum(raw, {}, {});
  assert.deepEqual(addUgly(album, ['12', '12', 'bad']), ['12']);
  assert.deepEqual(addUgly(album, ['13']), ['12', '13']);
});

test('largestSize selects the maximum pixel area among HTTPS links', () => {
  assert.equal(largestSize([
    { width: '10', height: '10', source: 'https://live.staticflickr.com/small.jpg' },
    { width: '300', height: '200', source: 'https://live.staticflickr.com/large.jpg' },
    { width: '999', height: '999', source: 'http://not-https.example/file.jpg' },
  ]), 'https://live.staticflickr.com/large.jpg');
  assert.equal(largestSize([]), null);
});

test('dateTaken is parsed conservatively without timezone normalization', () => {
  assert.equal(takenAt({ datetaken: '2024-07-05 01:02:03' }), '2024-07-05 01:02:03');
  assert.equal(takenAt({ datetaken: '2024-07-05' }), null);
});
