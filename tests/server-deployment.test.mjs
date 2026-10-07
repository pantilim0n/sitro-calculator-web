import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer, staticPath} from '../server.js';
import {writeLocalSiteFile} from '../api/_local-site-storage.js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('portable server can be created without starting a listener', () => {
  const server = createServer();
  assert.equal(typeof server.listen, 'function');
  server.close();
});

test('Russian server serves persistent admin content before bundled files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sitro-site-content-'));
  const previous = process.env.SITE_CONTENT_DIR;
  process.env.SITE_CONTENT_DIR = directory;
  await writeFile(join(directory, 'pricing.json'), JSON.stringify({minimumOrder: 777}));
  try {
    assert.equal(staticPath('/pricing.json'), join(directory, 'pricing.json'));
    assert.deepEqual(JSON.parse(await readFile(staticPath('/pricing.json'), 'utf8')), {minimumOrder: 777});
  } finally {
    previous === undefined ? delete process.env.SITE_CONTENT_DIR : process.env.SITE_CONTENT_DIR = previous;
    await rm(directory, {recursive: true, force: true});
  }
});

test('simultaneous admin saves cannot share a temporary file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sitro-site-concurrent-'));
  const previousRoot = process.env.SITE_CONTENT_DIR;
  const originalNow = Date.now;
  process.env.SITE_CONTENT_DIR = directory;
  Date.now = () => 1791397326604;
  const first = Buffer.from(JSON.stringify([{id: 'first', description: 'A'.repeat(250_000)}]));
  const second = Buffer.from(JSON.stringify([{id: 'second', description: 'B'.repeat(250_000)}]));
  try {
    await Promise.all([
      writeLocalSiteFile('portfolio.json', first),
      writeLocalSiteFile('portfolio.json', second)
    ]);
    const saved = await readFile(join(directory, 'portfolio.json'));
    assert.ok(saved.equals(first) || saved.equals(second));
    assert.doesNotThrow(() => JSON.parse(saved.toString('utf8')));
  } finally {
    Date.now = originalNow;
    previousRoot === undefined ? delete process.env.SITE_CONTENT_DIR : process.env.SITE_CONTENT_DIR = previousRoot;
    await rm(directory, {recursive: true, force: true});
  }
});

test('Russian VPS package includes HTTPS, health checks and secret isolation', async () => {
  const [dockerfile, compose, caddy, dockerignore, envExample] = await Promise.all([
    read('Dockerfile'), read('compose.yaml'), read('deploy/Caddyfile'), read('.dockerignore'), read('.env.server.example')
  ]);
  assert.match(dockerfile, /HEALTHCHECK/);
  assert.match(compose, /restart: unless-stopped/);
  assert.match(compose, /SITE_CONTENT_DIR: \/data\/site/);
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


test('Russian VPS records repeatable SSH brute-force protection', async () => {
  const config = await read('deploy/fail2ban-sitro-sshd.conf');
  assert.match(config, /\[sshd\]/);
  assert.match(config, /maxretry = 5/);
  assert.match(config, /findtime = 10m/);
  assert.match(config, /bantime = 1h/);
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
