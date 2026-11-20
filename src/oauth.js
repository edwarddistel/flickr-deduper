import https from 'node:https';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { configFromEnv, loadEnv, requireConfig } from './config.js';
import { AUTHORIZE_URL, FlickrClient } from './flickr-client.js';

/** Modify only the issued credentials, preserving the user's other .env settings. */
export async function saveCredentials(filename, updates) {
  let text = '';
  try { text = await readFile(filename, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const allowed = new Set(['FLICKR_OAUTH_TOKEN', 'FLICKR_OAUTH_TOKEN_SECRET', 'USER_ID']);
  const lines = text.split(/\r?\n/).filter(Boolean);
  for (const [key, value] of Object.entries(updates)) {
    if (!allowed.has(key)) throw new Error(`Unexpected credential key: ${key}`);
    if (!value || /[\r\n]/.test(value)) throw new Error(`Invalid credential value for ${key}`);
    const index = lines.findIndex((line) => line.startsWith(`${key}=`));
    if (index >= 0) lines[index] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
  }
  const tmp = `${filename}.tmp`;
  await writeFile(tmp, `${lines.join('\n')}\n`, { mode: 0o600 });
  await rename(tmp, filename);
}

export function createOauthServer(config, { client = new FlickrClient(config), envFile = '.env' } = {}) {
  let pending = null;
  const tls = { key: readFileSync(config.localKeyFile), cert: readFileSync(config.localCertFile) };
  const server = https.createServer(tls, async (req, res) => {
    try {
      const url = new URL(req.url, `https://localhost:${config.port}`);
      if (req.method !== 'GET') { res.writeHead(405).end('Method not allowed'); return; }
      if (url.pathname === '/') {
        const callback = `https://localhost:${config.port}/oauth/callback`;
        pending = await client.requestToken(callback);
        const authorize = new URL(AUTHORIZE_URL);
        authorize.searchParams.set('oauth_token', pending.token);
        authorize.searchParams.set('perms', 'delete'); // Required only if using permanent deletion.
        res.writeHead(302, { location: authorize.toString() }).end();
        return;
      }
      if (url.pathname === '/oauth/callback') {
        if (!pending || url.searchParams.get('oauth_token') !== pending.token || !url.searchParams.get('oauth_verifier')) {
          res.writeHead(400).end('OAuth session missing or token mismatch'); return;
        }
        const { token, secret, userId } = await client.accessToken(pending.token, pending.secret, url.searchParams.get('oauth_verifier'));
        pending = null;
        await saveCredentials(envFile, {
          FLICKR_OAUTH_TOKEN: token, FLICKR_OAUTH_TOKEN_SECRET: secret,
          ...(userId ? { USER_ID: userId } : {}),
        });
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end('Flickr authorization complete. Tokens saved to .env. Close this tab and stop the OAuth server.');
        return;
      }
      res.writeHead(404).end('Not found');
    } catch (error) {
      console.error('OAuth request failed:', error.message); // Never print tokens.
      res.writeHead(500).end('OAuth failed. See local server console.');
    }
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadEnv();
  const config = configFromEnv({ ...process.env, PORT: process.env.OAUTH_PORT || '3000' });
  try {
    requireConfig(config, ['consumerKey', 'consumerSecret']);
    createOauthServer(config).listen(config.port, '127.0.0.1', () => {
      console.log(`Open https://localhost:${config.port}/ in a browser to authorize Flickr (the certificate is self-signed).`);
    });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
