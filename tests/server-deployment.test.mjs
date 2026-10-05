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

test('Russian VPS keeps daily restricted backups with integrity checks and retention', async () => {
  const [script, service, timer] = await Promise.all([
    read('deploy/backup-orders.sh'), read('deploy/sitro-backup.service'), read('deploy/sitro-backup.timer')
  ]);
  assert.match(script, /docker volume inspect/);
  assert.match(script, /\.env\.server/);
  assert.match(script, /chmod 600/);
  assert.match(script, /sha256sum/);
  assert.match(script, /-mtime/);
  assert.match(service, /ExecStart=\/opt\/sitro\/app\/deploy\/backup-orders\.sh/);
  assert.match(timer, /OnCalendar=.*03:30:00 Europe\/Moscow/);
  assert.match(timer, /Persistent=true/);
});

test('Telegram fallback relays only encrypted order data', async () => {
  const [orderApi, workflow] = await Promise.all([
    read('api/order.js'), read('.github/workflows/telegram-relay.yml')
  ]);
  assert.match(orderApi, /createCipheriv\('aes-256-gcm'/);
  assert.match(orderApi, /event_type: 'telegram_order'/);
  assert.match(workflow, /createDecipheriv\('aes-256-gcm'/);
  assert.match(workflow, /secrets\.TELEGRAM_BOT_TOKEN/);
  assert.doesNotMatch(workflow, /[0-9]{8,}:[A-Za-z0-9_-]{20,}/);
});
