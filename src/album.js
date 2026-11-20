/** Flickr returns local wall-clock date_taken strings (not UTC); retain the original for comparisons. */
export function takenAt(photo) {
  const value = photo.datetaken ?? photo.dateTaken;
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? value : null;
}

function compareIds(a, b) {
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
    const n1 = BigInt(a); const n2 = BigInt(b);
    return n1 < n2 ? -1 : n1 > n2 ? 1 : 0;
  }
  return a.localeCompare(b);
}

/** Collapse duplicate API records, but never collapse different photo IDs by timestamp alone. */
export function buildAlbum(rawPhotos, previous = {}, { albumId, primaryId = '' } = {}) {
  const oldUrls = new Map((previous.photos || []).map((photo) => [photo.id, photo.url]));
  const photos = [];
  const seen = new Set();
  for (const item of rawPhotos) {
    const id = String(item.id || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    photos.push({ id, dateTaken: takenAt(item), dateUploaded: item.dateupload ? String(item.dateupload) : null,
      ...(oldUrls.get(id) ? { url: oldUrls.get(id) } : {}) });
  }
  return { version: 2, albumId: String(albumId ?? previous.albumId ?? ''), primaryId: String(primaryId || previous.primaryId || ''),
    refreshedAt: new Date().toISOString(), photos, uglyPhotoIds: (previous.uglyPhotoIds || []).filter((id) => seen.has(id)) };
}

/** A matching capture timestamp is a *candidate*, not proof the photos have identical pixels. */
export function duplicatePlan(album) {
  const groups = new Map();
  for (const photo of album.photos || []) {
    if (!photo.dateTaken) continue;
    if (!groups.has(photo.dateTaken)) groups.set(photo.dateTaken, []);
    groups.get(photo.dateTaken).push(photo);
  }
  return [...groups.entries()].filter(([, photos]) => photos.length > 1)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateTaken, photos]) => {
      const ordered = [...photos].sort((a, b) => {
        if (a.id === album.primaryId) return -1;
        if (b.id === album.primaryId) return 1;
        const aTime = Number(a.dateUploaded || 0); const bTime = Number(b.dateUploaded || 0);
        if (aTime !== bTime) return aTime - bTime;
        return compareIds(a.id, b.id);
      });
      return { dateTaken, keepId: ordered[0].id, candidateDeleteIds: ordered.slice(1).map((item) => item.id) };
    });
}

export function reorderPlan(album, preferredPrimaryId = '') {
  const photos = [...(album.photos || [])].sort((a, b) => {
    if (a.dateTaken && b.dateTaken && a.dateTaken !== b.dateTaken) return b.dateTaken.localeCompare(a.dateTaken);
    if (a.dateTaken !== b.dateTaken) return a.dateTaken ? -1 : 1;
    return compareIds(a.id, b.id);
  });
  const ids = photos.map((item) => item.id);
  const primaryId = [preferredPrimaryId, album.primaryId, ids[0]].find((id) => ids.includes(id));
  return { photoIds: ids, primaryId: primaryId || '' };
}

export function addUgly(album, ids) {
  const valid = new Set((album.photos || []).map(({ id }) => id));
  const recorded = new Set(album.uglyPhotoIds || []);
  for (const id of ids) if (valid.has(String(id))) recorded.add(String(id));
  album.uglyPhotoIds = [...recorded];
  return album.uglyPhotoIds;
}

export function largestSize(sizes) {
  const valid = sizes.filter((size) => size.source && /^https:\/\//i.test(size.source));
  return valid.sort((a, b) => Number(b.width || 0) * Number(b.height || 0) - Number(a.width || 0) * Number(a.height || 0))[0]?.source || null;
}
