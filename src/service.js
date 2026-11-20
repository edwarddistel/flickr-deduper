import path from 'node:path';
import { addUgly, buildAlbum, duplicatePlan, largestSize, reorderPlan } from './album.js';
import { backupPhotos } from './download.js';
import { loadAlbum, saveAlbum } from './storage.js';

const asArray = (value) => Array.isArray(value) ? value : value ? [value] : [];

export class AlbumService {
  constructor(client, config) {
    this.client = client;
    this.config = config;
    this.album = null;
    this.active = false;
  }

  async load() {
    if (!this.album) this.album = (await loadAlbum(this.config.dataDir)) || buildAlbum([], {}, { albumId: this.config.albumId });
    return this.album;
  }

  async save() { await saveAlbum(this.config.dataDir, await this.load()); }

  /** Serialize potentially conflicting commands, including background sync and HTTP writes. */
  async exclusive(action) {
    if (this.active) { const error = new Error('Another album operation is running'); error.statusCode = 409; throw error; }
    this.active = true;
    try { return await action(); } finally { this.active = false; }
  }

  async refresh() {
    return this.exclusive(() => this.refreshInternal());
  }

  async refreshInternal() {
    const previous = await this.load();
    const all = [];
    let page = 1;
    let pages = 1;
    let primaryId = '';
    do {
      const response = await this.client.listPhotos(this.config.albumId, page);
      const set = response.photoset;
      if (!set || !Number.isFinite(Number(set.pages))) throw new Error('Invalid Flickr photoset response');
      pages = Number(set.pages) || 1;
      if (pages > 10_000) throw new Error('Suspicious Flickr pagination count');
      primaryId = String(set.primary || primaryId);
      all.push(...asArray(set.photo));
      page++;
    } while (page <= pages);
    this.album = buildAlbum(all, previous, { albumId: this.config.albumId, primaryId });
    await this.save();
    return { count: this.album.photos.length, duplicateGroups: duplicatePlan(this.album).length, pages };
  }

  async sets() {
    const response = await this.client.listSets(this.config.userId);
    return asArray(response.photosets?.photoset);
  }

  async duplicates() { return duplicatePlan(await this.load()); }

  async deleteCandidates({ confirmAlbumId, allowTimestampOnly = false } = {}) {
    if (confirmAlbumId !== this.config.albumId || allowTimestampOnly !== true) {
      const error = new Error('Requires the exact album ID and explicit timestamp-only deletion acknowledgment');
      error.statusCode = 400; throw error;
    }
    return this.exclusive(async () => {
      // Never trust an old cached list before a destructive operation.
      await this.refreshInternal();
      const candidates = duplicatePlan(this.album).flatMap((group) => group.candidateDeleteIds);
      let deleted = 0;
      try {
        for (const id of candidates) { await this.client.deletePhoto(id); deleted++; }
      } finally {
        // Refresh even after a partial failure; never report deleted photos as still present.
        await this.refreshInternal();
      }
      return { deleted, candidates: candidates.length };
    });
  }

  async reorder() {
    return this.exclusive(async () => {
      const plan = reorderPlan(await this.load(), this.config.primaryPhotoId);
      if (!plan.photoIds.length) return { count: 0, changed: false };
      await this.client.reorderPhotos(this.config.albumId, plan.primaryId, plan.photoIds);
      return { count: plan.photoIds.length, primaryId: plan.primaryId, changed: true };
    });
  }

  async sizes() {
    return this.exclusive(async () => {
      const album = await this.load();
      let updated = 0;
      const failures = [];
      for (const photo of album.photos) {
        if (photo.url) continue;
        try {
          const response = await this.client.sizes(photo.id);
          const url = largestSize(asArray(response.sizes?.size));
          if (!url) throw new Error('No HTTPS sizes returned');
          photo.url = url;
          updated++;
        } catch (error) {
          failures.push({ photoId: photo.id, error: error.message });
        }
      }
      await this.save();
      return { updated, failures };
    });
  }

  async backup() {
    return this.exclusive(async () => backupPhotos(await this.load(), path.join(this.config.dataDir, 'backup')));
  }

  async markUgly(ids) {
    return this.exclusive(async () => {
      const list = addUgly(await this.load(), ids);
      await this.save();
      return list;
    });
  }

  async sync() {
    const refresh = await this.refresh();
    // Preserve the old nightly deduplication capability, but require explicit opt-in.
    // Timestamp equality alone cannot establish that two photos have identical content.
    let deletion;
    if (this.config.autoDelete) {
      deletion = await this.deleteCandidates({
        confirmAlbumId: this.config.autoDeleteConfirmAlbumId,
        allowTimestampOnly: this.config.autoDeleteAllowTimestampOnly,
      });
    }
    const sizes = await this.sizes();
    let reorder;
    if (this.config.autoReorder) reorder = await this.reorder();
    return { refresh, ...(deletion ? { deletion } : {}), sizes, ...(reorder ? { reorder } : {}), duplicateCandidates: (await this.duplicates()).reduce((sum, g) => sum + g.candidateDeleteIds.length, 0) };
  }
}
