import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from '../server.js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('portable server can be created without starting a listener', () => {
  const server = createServer();
  assert.equal(typeof server.listen, 'function');
  server.close();
});

test('Russian VPS package includes HTTPS, health checks and secret isolation', async () => {
  const [dockerfile, compose, caddy, dockerignore, envExample] = await Promise.all([
    read('Dockerfile'), read('compose.yaml'), read('deploy/Caddyfile'), read('.dockerignore'), read('.env.server.example')
  ]);
  assert.match(dockerfile, /HEALTHCHECK/);
  assert.match(compose, /restart: unless-stopped/);
  assert.match(compose, /443:443/);
  assert.match(caddy, /xn---3-llcn4alfj\.xn--p1ai/);
  assert.match(dockerignore, /^\.env\.\*$/m);
  assert.match(envExample, /TELEGRAM_BOT_TOKEN=/);
  assert.match(envExample, /MAX_BOT_TOKEN=/);
  assert.doesNotMatch(envExample, /[0-9]{8,}:[A-Za-z0-9_-]{20,}/);
});
