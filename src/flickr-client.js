import { createHmac, randomBytes } from 'node:crypto';

export const FLICKR_REST_URL = 'https://api.flickr.com/services/rest';
export const REQUEST_TOKEN_URL = 'https://www.flickr.com/services/oauth/request_token';
export const ACCESS_TOKEN_URL = 'https://www.flickr.com/services/oauth/access_token';
export const AUTHORIZE_URL = 'https://www.flickr.com/services/oauth/authorize';

// OAuth 1.0 requires RFC 3986 percent encoding, including the punctuation encodeURIComponent leaves alone.
export function oauthEncode(value) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** Deterministic HMAC-SHA1 OAuth 1.0a signature; exported for known-vector tests. */
export function signRequest({ method, url, parameters, consumerSecret, tokenSecret = '' }) {
  const pairs = Object.entries(parameters)
    .filter(([key]) => key !== 'oauth_signature')
    .flatMap(([key, value]) => Array.isArray(value) ? value.map((v) => [oauthEncode(key), oauthEncode(v)]) : [[oauthEncode(key), oauthEncode(value)]]);
  pairs.sort(([ak, av], [bk, bv]) => (ak < bk ? -1 : ak > bk ? 1 : av < bv ? -1 : av > bv ? 1 : 0));
  const parameterString = pairs.map(([key, value]) => `${key}=${value}`).join('&');
  const normalizedUrl = new URL(url);
  normalizedUrl.search = '';
  normalizedUrl.hash = '';
  const baseString = [method.toUpperCase(), oauthEncode(normalizedUrl.toString()), oauthEncode(parameterString)].join('&');
  const signingKey = `${oauthEncode(consumerSecret)}&${oauthEncode(tokenSecret)}`;
  return createHmac('sha1', signingKey).update(baseString).digest('base64');
}

/** Native fetch transport supporting Flickr JSON REST and OAuth request/access token exchanges. */
export class FlickrClient {
  constructor(config, { fetchImpl = globalThis.fetch, nonce = () => randomBytes(16).toString('hex'), now = () => Date.now() } = {}) {
    this.config = config;
    this.fetch = fetchImpl;
    this.nonce = nonce;
    this.now = now;
  }

  async signedFetch(url, { method = 'GET', params = {}, token = this.config.oauthToken, tokenSecret = this.config.oauthTokenSecret } = {}) {
    const auth = {
      oauth_consumer_key: this.config.consumerKey,
      oauth_nonce: this.nonce(),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: String(Math.floor(this.now() / 1000)),
      oauth_version: '1.0',
    };
    if (token) auth.oauth_token = token;
    // Flickr supports OAuth parameters in the request rather than a bearer token.
    const combined = { ...params, ...auth };
    combined.oauth_signature = signRequest({ method, url, parameters: combined, consumerSecret: this.config.consumerSecret, tokenSecret });
    const destination = new URL(url);
    const request = { method, signal: AbortSignal.timeout(30_000) };
    if (method === 'POST') {
      request.headers = { 'content-type': 'application/x-www-form-urlencoded' };
      request.body = new URLSearchParams(combined);
    } else {
      destination.search = new URLSearchParams(combined).toString();
    }
    const response = await this.fetch(destination, request);
    const content = await response.text();
    if (!response.ok) throw new Error(`Flickr HTTP ${response.status}: ${content.slice(0, 300)}`);
    return content;
  }

  async api(method, params = {}, { write = false } = {}) {
    const body = await this.signedFetch(FLICKR_REST_URL, {
      method: write ? 'POST' : 'GET',
      params: { ...params, method, api_key: this.config.consumerKey, format: 'json', nojsoncallback: '1' },
    });
    let result;
    try { result = JSON.parse(body); } catch { throw new Error('Flickr returned invalid JSON'); }
    if (result.stat === 'fail') throw new Error(`Flickr API ${result.code}: ${result.message}`);
    return result;
  }

  testLogin() { return this.api('flickr.test.login'); }
  listSets(userId) { return this.api('flickr.photosets.getList', { user_id: userId }); }
  listPhotos(albumId, page) {
    return this.api('flickr.photosets.getPhotos', { photoset_id: albumId, page, per_page: 500, extras: 'date_taken,date_upload' });
  }
  sizes(photoId) { return this.api('flickr.photos.getSizes', { photo_id: photoId }); }
  deletePhoto(photoId) { return this.api('flickr.photos.delete', { photo_id: photoId }, { write: true }); }
  reorderPhotos(albumId, primaryId, photoIds) {
    return this.api('flickr.photosets.editPhotos', {
      photoset_id: albumId, primary_photo_id: primaryId, photo_ids: photoIds.join(','),
    }, { write: true });
  }

  async requestToken(callback) {
    const raw = await this.signedFetch(REQUEST_TOKEN_URL, { params: { oauth_callback: callback }, token: '', tokenSecret: '' });
    const values = new URLSearchParams(raw);
    const token = values.get('oauth_token');
    const secret = values.get('oauth_token_secret');
    if (!token || !secret || values.get('oauth_callback_confirmed') !== 'true') throw new Error('Invalid Flickr request token response');
    return { token, secret };
  }

  async accessToken(token, secret, verifier) {
    const raw = await this.signedFetch(ACCESS_TOKEN_URL, { params: { oauth_verifier: verifier }, token, tokenSecret: secret });
    const values = new URLSearchParams(raw);
    if (!values.get('oauth_token') || !values.get('oauth_token_secret')) throw new Error('Invalid Flickr access token response');
    return { token: values.get('oauth_token'), secret: values.get('oauth_token_secret'), userId: values.get('user_nsid') };
  }
}
