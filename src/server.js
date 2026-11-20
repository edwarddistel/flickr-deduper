import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { configFromEnv, loadEnv, requireConfig } from './config.js';
import { FlickrClient } from './flickr-client.js';
import { AlbumService } from './service.js';
import { createScheduler } from './scheduler.js';

const mutationPaths = new Set(['/dedupe', '/reorder', '/get-sizes', '/save-data', '/ugly', '/download-photos', '/sync']);

function authorized(header, token) {
  if (!token || typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const left = Buffer.from(header.slice(7)); const right = Buffer.from(token);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function bodyJson(req) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 64 * 1024) { const error = new Error('Request body too large'); error.statusCode = 413; throw error; }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { const error = new Error('Invalid JSON body'); error.statusCode = 400; throw error; }
}

export function createApp(service, config) {
  return http.createServer(async (req, res) => {
    const send = (status, payload) => {
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      res.end(JSON.stringify({ timestamp: new Date().toISOString(), ...payload }));
    };
    try {
      const url = new URL(req.url, 'http://localhost');
      const route = url.pathname;
      if (req.method === 'GET' && mutationPaths.has(route) && route !== '/dedupe') {
        return send(405, { error: 'Use POST with ADMIN_TOKEN. GET does not mutate Flickr or stored data.' });
      }
      if (req.method === 'POST' && mutationPaths.has(route) && !authorized(req.headers.authorization, config.adminToken)) {
        return send(403, { error: 'HTTP mutations require ADMIN_TOKEN and Authorization: Bearer <token>' });
      }
      let result;
      if (req.method === 'GET') {
        switch (route) {
          case '/': return send(200, { message: 'Flickr deduper running', mode: 'timestamp-only duplicate preview' });
          case '/test-login': result = await service.client.testLogin(); break;
          case '/get-photos': result = await service.refresh(); break;
          case '/get-photosets': result = await service.sets(); break;
          case '/dedupe': case '/duplicates': result = await service.duplicates(); break;
          case '/info': result = await service.load(); break;
          default: return send(404, { error: 'Not found. Run CLI for additional operations.' });
        }
      } else if (req.method === 'POST' && mutationPaths.has(route)) {
        const body = await bodyJson(req);
        switch (route) {
          case '/dedupe': result = await service.deleteCandidates({ confirmAlbumId: body.confirmAlbumId, allowTimestampOnly: body.allowTimestampOnly }); break;
          case '/reorder': result = await service.reorder(); break;
          case '/get-sizes': result = await service.sizes(); break;
          case '/save-data': await service.save(); result = { saved: true }; break;
          case '/ugly':
            if (!Array.isArray(body.photoIds)) return send(400, { error: 'Expected photoIds array' });
            result = await service.markUgly(body.photoIds); break;
          case '/download-photos': result = await service.backup(); break;
          case '/sync': result = await service.sync(); break;
          default: return send(404, { error: 'Not found' });
        }
      } else if (mutationPaths.has(route)) return send(405, { error: 'Use POST with ADMIN_TOKEN. GET no longer causes destructive changes.' });
      else return send(404, { error: 'Not found' });
      return send(200, { result });
    } catch (error) {
      console.error('Request failed:', error.message);
      return send(error.statusCode || 500, { error: error.message });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadEnv();
  const config = configFromEnv();
  try {
    requireConfig(config);
    const service = new AlbumService(new FlickrClient(config), config);
    const server = createApp(service, config);
    server.listen(config.port, config.host, () => console.log(`Flickr deduper listening at http://${config.host}:${config.port}`));
    // One container runs both the HTTP API and the nightly job; no cron daemon needed.
    if (config.autoSync) createScheduler(service, config);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
