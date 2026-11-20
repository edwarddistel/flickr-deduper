import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readRoot = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('repository always ignores .DS_Store and macOS ZIP metadata', async () => {
  const ignore = await readRoot('.gitignore');
  assert.match(ignore, /^\.DS_Store$/m);
  assert.match(ignore, /^\*\*\/\.DS_Store$/m);
  assert.match(ignore, /^__MACOSX\/$/m);
});

test('the private Docker build embeds .env, never demands runtime injection', async () => {
  const docker = await readRoot('Dockerfile');
  const dockerignore = await readRoot('.dockerignore');
  const compose = await readRoot('compose.yaml');
  assert.match(docker, /^COPY .*\.env \.\/\.env$/m);
  assert.doesNotMatch(dockerignore, /^\.env(?:\s|$)/m);
  assert.doesNotMatch(compose, /env_file:/);
});
