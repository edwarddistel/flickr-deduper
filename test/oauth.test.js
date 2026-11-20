import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import https from 'node:https';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createOauthServer } from '../src/oauth.js';

function requestLocal(port, pathName) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'localhost', port, path: pathName, method: 'GET',
      // Test only: trust this test's freshly generated, self-signed localhost cert.
      rejectUnauthorized: false, family: 4,
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, location: response.headers.location, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('local HTTPS OAuth redirects to Flickr and persists the issued tokens', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'flickr-oauth-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const localKeyFile = path.join(directory, 'key.pem');
  const localCertFile = path.join(directory, 'cert.pem');
  execFileSync('openssl', [
    'req', '-x509', '-nodes', '-newkey', 'rsa:2048', '-days', '1',
    '-keyout', localKeyFile, '-out', localCertFile, '-subj', '/CN=localhost',
  ], { stdio: 'ignore' });
  const envFile = path.join(directory, '.env');
  await writeFile(envFile, 'FLICKR_CONSUMER_KEY=key\n');
  const client = {
    requestToken: async (callback) => {
      assert.match(callback, /^https:\/\/localhost:/);
      return { token: 'temporary', secret: 'temporary-secret' };
    },
    accessToken: async (token, secret, verifier) => {
      assert.deepEqual([token, secret, verifier], ['temporary', 'temporary-secret', 'approved']);
      return { token: 'final-token', secret: 'final-secret', userId: '555@N01' };
    },
  };
  const server = createOauthServer({ port: 0, localKeyFile, localCertFile }, { client, envFile });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const basePort = server.address().port;
  const redirect = await requestLocal(basePort, '/');
  assert.equal(redirect.status, 302);
  assert.match(redirect.location, /^https:\/\/www\.flickr\.com\/services\/oauth\/authorize\?/);
  assert.equal(new URL(redirect.location).searchParams.get('oauth_token'), 'temporary');
  const callback = await requestLocal(basePort, '/oauth/callback?oauth_token=temporary&oauth_verifier=approved');
  assert.equal(callback.status, 200);
  assert.match(callback.body, /authorization complete/);
  assert.match(await readFile(envFile, 'utf8'), /FLICKR_OAUTH_TOKEN_SECRET=final-secret/);
  const repeated = await requestLocal(basePort, '/oauth/callback?oauth_token=temporary&oauth_verifier=approved');
  assert.equal(repeated.status, 400);
});
