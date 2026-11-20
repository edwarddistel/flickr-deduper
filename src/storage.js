import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { buildAlbum } from './album.js';

/** Atomic replace prevents a process crash from leaving half-written JSON. */
export async function saveAlbum(directory, album) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const target = path.join(directory, 'album.json');
  const temp = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, `${JSON.stringify(album, null, 2)}\n`, { mode: 0o600 });
    await rename(temp, target);
  } catch (error) {
    const { rm } = await import('node:fs/promises');
    await rm(temp, { force: true });
    throw error;
  }
}

export async function loadAlbum(directory) {
  try {
    const current = JSON.parse(await readFile(path.join(directory, 'album.json'), 'utf8'));
    if (current?.version === 2 && Array.isArray(current.photos)) return current;
    throw new Error('Unsupported album data version');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  // One-time migration of the original repository's src/data/albumData.json, if present.
  try {
    const legacy = JSON.parse(await readFile(path.resolve('src/data/albumData.json'), 'utf8'));
    const photos = (legacy.photoIds || []).map((id) => ({ id: String(id), datetaken: legacy.photoMap?.[id]?.dateTaken }));
    const migrated = buildAlbum(photos, {}, { albumId: '' });
    for (const photo of migrated.photos) {
      if (legacy.photoMap?.[photo.id]?.url) photo.url = legacy.photoMap[photo.id].url;
    }
    migrated.uglyPhotoIds = legacy.photoIdsUgly || [];
    return migrated;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
