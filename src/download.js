import { createWriteStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

/** Do not allow persisted photo URLs to become an arbitrary-host downloader. */
export function safeImageUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !(url.hostname === 'staticflickr.com' || url.hostname.endsWith('.staticflickr.com')) || url.port || url.username || url.password) {
    throw new Error('Image URL must use HTTPS on staticflickr.com');
  }
  return url;
}

export async function backupPhotos(album, destination, { fetchImpl = globalThis.fetch } = {}) {
  await mkdir(destination, { recursive: true, mode: 0o700 });
  const results = { downloaded: 0, skipped: 0, missingUrl: 0, failures: [] };
  for (const photo of album.photos || []) {
    if (!photo.url) { results.missingUrl++; continue; }
    let partialFile = null;
    try {
      const url = safeImageUrl(photo.url);
      const ext = path.extname(url.pathname).toLowerCase();
      const extension = /^\.(jpg|jpeg|png|gif|webp|tif|tiff)$/.test(ext) ? ext : '.jpg';
      const name = `${photo.id.replace(/[^0-9a-z_-]/gi, '_')}${extension}`;
      const file = path.join(destination, name);
      try { await stat(file); results.skipped++; continue; } catch (error) { if (error.code !== 'ENOENT') throw error; }
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(60_000), redirect: 'error' });
      if (!response.ok || !response.body) throw new Error(`Download failed (HTTP ${response.status})`);
      partialFile = file;
      await pipeline(Readable.fromWeb(response.body), createWriteStream(file, { flags: 'wx', mode: 0o600 }));
      partialFile = null;
      results.downloaded++;
    } catch (error) {
      // A truncated download must not count as a future successful backup.
      if (partialFile) await rm(partialFile, { force: true });
      results.failures.push({ photoId: photo.id, error: error.message });
    }
  }
  return results;
}
