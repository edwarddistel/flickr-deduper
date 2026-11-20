import test from 'node:test';
import assert from 'node:assert/strict';
import { FlickrClient, oauthEncode, signRequest } from '../src/flickr-client.js';

const config = { consumerKey: 'public-key', consumerSecret: 'private-secret', oauthToken: 'oauth-token', oauthTokenSecret: 'oauth-secret' };

test('OAuth 1.0a signature matches published reference test vector', () => {
  assert.equal(signRequest({
    method: 'GET', url: 'http://photos.example.net/photos',
    consumerSecret: 'kd94hf93k423kf44', tokenSecret: 'pfkkdhi9sl3r4s00',
    parameters: {
      oauth_consumer_key: 'dpf43f3p2l4k3l03', oauth_token: 'nnch734d00sl2jdk', oauth_nonce: 'kllo9940pd9333jh',
      oauth_timestamp: '1191242096', oauth_signature_method: 'HMAC-SHA1', oauth_version: '1.0',
      file: 'vacation.jpg', size: 'original',
    },
  }), 'tR3+Ty81lMeYAr/Fid0kMTYa/WM=');
  assert.equal(oauthEncode("!'()*"), '%21%27%28%29%2A');
});

test('Flickr read API sends a signed GET and validates JSON status', async () => {
  const fetchImpl = async (url, init) => {
    assert.equal(init.method, 'GET');
    assert.equal(url.searchParams.get('method'), 'flickr.photosets.getPhotos');
    assert.equal(url.searchParams.get('per_page'), '500');
    assert.ok(url.searchParams.get('oauth_signature'));
    return new Response(JSON.stringify({ stat: 'ok', photoset: { photo: [] } }), { status: 200 });
  };
  const client = new FlickrClient(config, { fetchImpl, nonce: () => 'nonce', now: () => 1_000_000 });
  assert.deepEqual((await client.listPhotos('123', 1)).photoset.photo, []);
});

test('Flickr write API sends a signed POST with exact photo IDs', async () => {
  const fetchImpl = async (_url, init) => {
    assert.equal(init.method, 'POST');
    assert.equal(init.headers['content-type'], 'application/x-www-form-urlencoded');
    const body = new URLSearchParams(init.body);
    assert.equal(body.get('method'), 'flickr.photosets.editPhotos');
    assert.equal(body.get('photo_ids'), '1,2,3');
    assert.ok(body.get('oauth_signature'));
    return new Response(JSON.stringify({ stat: 'ok' }));
  };
  await new FlickrClient(config, { fetchImpl }).reorderPhotos('9', '1', ['1', '2', '3']);
});

test('Flickr API errors and malformed responses produce actionable failures', async () => {
  const failed = new FlickrClient(config, { fetchImpl: async () => new Response('{"stat":"fail","code":2,"message":"No such album"}') });
  await assert.rejects(failed.testLogin(), /Flickr API 2: No such album/);
  const badJson = new FlickrClient(config, { fetchImpl: async () => new Response('not-json') });
  await assert.rejects(badJson.testLogin(), /invalid JSON/);
  const networkError = new FlickrClient(config, { fetchImpl: async () => new Response('Forbidden', { status: 403 }) });
  await assert.rejects(networkError.testLogin(), /Flickr HTTP 403/);
});

test('request and access token exchanges validate Flickr OAuth fields', async () => {
  let calls = 0;
  const client = new FlickrClient(config, { fetchImpl: async (_url, _init) => {
    calls++;
    return new Response(calls === 1
      ? 'oauth_token=temp&oauth_token_secret=temp_secret&oauth_callback_confirmed=true'
      : 'oauth_token=long_lived&oauth_token_secret=permanent_secret&user_nsid=42%40N01');
  } });
  assert.deepEqual(await client.requestToken('https://localhost:3000/oauth/callback'), { token: 'temp', secret: 'temp_secret' });
  assert.deepEqual(await client.accessToken('temp', 'temp_secret', 'verifier'), { token: 'long_lived', secret: 'permanent_secret', userId: '42@N01' });
});

test('invalid OAuth request tokens are not accepted', async () => {
  const client = new FlickrClient(config, { fetchImpl: async () => new Response('oauth_token=no-secret&oauth_callback_confirmed=true') });
  await assert.rejects(client.requestToken('https://localhost:3000/cb'), /Invalid Flickr request token/);
});
