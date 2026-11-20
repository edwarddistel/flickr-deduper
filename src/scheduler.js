import { pathToFileURL } from 'node:url';
import { configFromEnv, loadEnv, requireConfig } from './config.js';
import { FlickrClient } from './flickr-client.js';
import { AlbumService } from './service.js';

/** A date-based run key ensures daylight-saving fall-back cannot trigger the job twice. */
export function zonedParts(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: `${byType.year}-${byType.month}-${byType.day}`, time: `${byType.hour}:${byType.minute}` };
}

export function createScheduler(service, config, { now = () => new Date(), setIntervalImpl = setInterval, log = console.log } = {}) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(config.syncTime)) throw new Error('SYNC_TIME must be HH:MM');
  let lastRun = null;
  let running = false;
  const tick = async () => {
    const current = zonedParts(now(), config.timezone);
    if (current.time !== config.syncTime || current.date === lastRun || running) return;
    running = true;
    lastRun = current.date;
    try { log(JSON.stringify({ at: now().toISOString(), sync: await service.sync() })); }
    catch (error) { console.error('Scheduled sync failed:', error.message); }
    finally { running = false; }
  };
  const timer = setIntervalImpl(() => { void tick(); }, 15_000);
  void tick();
  return { stop: () => clearInterval(timer), tick };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadEnv();
  const config = configFromEnv();
  try {
    requireConfig(config);
    const service = new AlbumService(new FlickrClient(config), config);
    createScheduler(service, config);
    console.log(`Scheduled daily sync at ${config.syncTime} (${config.timezone}). Deletes are never automatic.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
