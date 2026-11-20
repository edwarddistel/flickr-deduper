import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { configFromEnv, loadEnv, requireConfig } from './config.js';
import { FlickrClient } from './flickr-client.js';
import { AlbumService } from './service.js';

const usage = `Usage: npm run cli -- COMMAND [OPTIONS]

Commands:
  login                 Check Flickr OAuth credentials
  sets                  List albums available to the user
  refresh               Load ALL photos from the configured album
  duplicates            Preview timestamp-based duplicate candidates (no deletion)
  dedupe                Permanently delete candidates (explicit confirmation required)
  reorder               Reorder album newest-first (requires --confirm)
  sizes                 Fetch largest available photo URLs
  backup                Save photos to DATA_DIR/backup
  save                  Save the current album snapshot
  ugly                  Flag photo IDs via --ids 123,456
  sync                  Refresh, fetch URLs, optionally reorder; NEVER delete

Dangerous flags (both required for dedupe):
  --confirm ALBUM_ID          Exact FLICKR_ALBUM_ID being modified
  --allow-timestamp-only      Acknowledge equal timestamps do not prove identical photos
`;

export async function runCli(argv, { config, service, output = console.log } = {}) {
  const [command, ...rest] = argv;
  if (!command || ['help', '--help', '-h'].includes(command)) { output(usage); return; }
  const parsed = parseArgs({ args: rest, options: {
    confirm: { type: 'string' }, 'allow-timestamp-only': { type: 'boolean', default: false },
    ids: { type: 'string' },
  }, strict: true });
  let result;
  switch (command) {
    case 'login': result = await service.client.testLogin(); break;
    case 'sets': result = await service.sets(); break;
    case 'refresh': result = await service.refresh(); break;
    case 'duplicates': result = await service.duplicates(); break;
    case 'dedupe': result = await service.deleteCandidates({ confirmAlbumId: parsed.values.confirm, allowTimestampOnly: parsed.values['allow-timestamp-only'] }); break;
    case 'reorder':
      if (parsed.values.confirm !== config.albumId) throw new Error('Reordering requires --confirm ALBUM_ID');
      result = await service.reorder(); break;
    case 'sizes': result = await service.sizes(); break;
    case 'backup': result = await service.backup(); break;
    case 'save': await service.save(); result = { saved: true }; break;
    case 'ugly':
      if (!parsed.values.ids) throw new Error('Provide --ids photoId1,photoId2');
      result = await service.markUgly(parsed.values.ids.split(',').map((id) => id.trim())); break;
    case 'sync': result = await service.sync(); break;
    default: throw new Error(`Unknown command: ${command}\n${usage}`);
  }
  output(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadEnv();
  const config = configFromEnv();
  try {
    requireConfig(config, process.argv[2] === 'help' ? [] : ['consumerKey', 'consumerSecret', 'oauthToken', 'oauthTokenSecret', 'albumId', ...(process.argv[2] === 'sets' ? ['userId'] : [])]);
    await runCli(process.argv.slice(2), { config, service: new AlbumService(new FlickrClient(config), config) });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
