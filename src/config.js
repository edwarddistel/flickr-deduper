import { existsSync } from 'node:fs';
import path from 'node:path';

/** Load a development .env with Node's built-in loader, without overriding existing environment variables. */
export function loadEnv(filename = '.env') {
  if (existsSync(filename)) process.loadEnvFile(filename);
}

export function configFromEnv(env = process.env) {
  return {
    consumerKey: env.FLICKR_CONSUMER_KEY?.trim() ?? '',
    consumerSecret: env.FLICKR_CONSUMER_SECRET?.trim() ?? '',
    oauthToken: env.FLICKR_OAUTH_TOKEN?.trim() ?? '',
    oauthTokenSecret: env.FLICKR_OAUTH_TOKEN_SECRET?.trim() ?? '',
    albumId: env.FLICKR_ALBUM_ID?.trim() ?? '',
    userId: env.USER_ID?.trim() ?? '',
    primaryPhotoId: env.FLICKR_PRIMARY_PHOTO_ID?.trim() ?? '',
    host: env.HOST || '127.0.0.1',
    port: Number(env.PORT || 3000),
    adminToken: env.ADMIN_TOKEN || '',
    dataDir: path.resolve(env.DATA_DIR || './data'),
    timezone: env.TZ || 'America/New_York',
    syncTime: env.SYNC_TIME || '03:00',
    autoReorder: env.AUTO_REORDER === 'true',
    autoSync: env.AUTO_SYNC !== 'false',
    autoDelete: env.AUTO_DELETE === 'true',
    autoDeleteConfirmAlbumId: env.AUTO_DELETE_CONFIRM_ALBUM_ID?.trim() ?? '',
    autoDeleteAllowTimestampOnly: env.AUTO_DELETE_ALLOW_TIMESTAMP_ONLY === 'true',
    localKeyFile: path.resolve(env.LOCAL_KEY_FILE || './key.pem'),
    localCertFile: path.resolve(env.LOCAL_CERT_FILE || './cert.pem'),
  };
}

/** Check only the credentials needed by a given operation; OAuth bootstrap has no access token yet. */
export function requireConfig(config, names = ['consumerKey', 'consumerSecret', 'oauthToken', 'oauthTokenSecret', 'albumId']) {
  const missing = names.filter((name) => !config[name] || config[name].toLowerCase() === 'tbd');
  if (missing.length) throw new Error(`Missing configuration: ${missing.join(', ')}. Check .env.example.`);
  return config;
}
