import test from 'node:test';
import assert from 'node:assert/strict';
import {encryptTelegramRelay, makeOrderId, nextRateState, orderFolder, requestFingerprint, telegramText, validateFiles} from '../api/order.js';
import {cleanOrderStatus, normalizeOrderRecord, orderRecordPath} from '../api/admin-orders.js';
import {createDecipheriv, X509Certificate} from 'node:crypto';
import {RUSSIAN_TRUSTED_ROOT_CA} from '../api/_max-client.js';

test('MAX uses the verified Russian trusted root only for its API client', () => {
  const certificate = new X509Certificate(RUSSIAN_TRUSTED_ROOT_CA);
  assert.equal(certificate.fingerprint256, 'D2:6D:2D:02:31:B7:C3:9F:92:CC:73:85:12:BA:54:10:35:19:E4:40:5D:68:B5:BD:70:3E:97:88:CA:8E:CF:31');
  assert.match(certificate.subject, /Russian Trusted Root CA/);
});

test('order id and Yandex Disk folder are stable across midnight', () => {
  const now = new Date('2026-09-30T23:59:59.000Z');
  const orderId = makeOrderId(now, () => Buffer.from('a1b2c3d4', 'hex'));
  assert.equal(orderId, '20260930235959-a1b2c3d4');
  assert.equal(orderFolder(orderId), 'app:/Заявки/2026-09-30/20260930235959-a1b2c3d4');
});

test('STL and 3MF files are validated and duplicate names are separated', () => {
  assert.deepEqual(validateFiles([
    {name: 'деталь.stl', size: 100},
    {name: 'деталь.stl', size: 200},
    {name: 'сборка.3mf', size: 300}
  ]), [
    {name: 'деталь.stl', size: 100},
    {name: 'деталь-2.stl', size: 200},
    {name: 'сборка.3mf', size: 300}
  ]);
  assert.throws(() => validateFiles([{name: 'virus.exe', size: 100}]), /STL и 3MF/);
  assert.throws(() => validateFiles([{name: 'huge.stl', size: 51 * 1024 * 1024}]), /50 МБ/);
});

test('Telegram notification contains customer, calculation and file links', () => {
  const text = telegramText({
    orderId: '20260930120000-a1b2c3d4',
    kind: 'stl',
    customer: {name: 'Роман', contact: '+7 900 000-00-00', comment: 'Чёрный PETG'},
    message: 'Предварительная стоимость: 900 ₽',
    files: [{name: 'detail.stl', url: 'https://disk.yandex.ru/d/example'}]
  });
  assert.match(text, /Новая заявка СИТРО/);
  assert.match(text, /\+7 900 000-00-00/);
  assert.match(text, /900 ₽/);
  assert.match(text, /https:\/\/disk\.yandex\.ru\/d\/example/);
});

test('Telegram relay encrypts customer data before it reaches GitHub', () => {
  const key = Buffer.alloc(32, 7);
  const payload = encryptTelegramRelay('Заявка: +7 900 000-00-00', key.toString('base64'), size => Buffer.alloc(size, 3));
  assert.equal(payload.version, 1);
  assert.doesNotMatch(JSON.stringify(payload), /900 000/);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  const text = Buffer.concat([decipher.update(Buffer.from(payload.data, 'base64')), decipher.final()]).toString('utf8');
  assert.equal(text, 'Заявка: +7 900 000-00-00');
});

test('order spam protection allows normal use and blocks bursts for fifteen minutes', () => {
  const start = Date.parse('2026-10-01T10:00:00.000Z');
  let state = {};
  for (let index = 0; index < 5; index += 1) state = nextRateState(state, 'submit', start + index * 1000);
  assert.throws(() => nextRateState(state, 'submit', start + 6000), error => error.statusCode === 429 && error.retryAfter > 0);
  assert.doesNotThrow(() => nextRateState(state, 'submit', start + 15 * 60 * 1000 + 1));
  const first = requestFingerprint({headers: {'x-forwarded-for': '192.0.2.1', 'user-agent': 'Safari'}}, 'secret');
  const second = requestFingerprint({headers: {'x-forwarded-for': '192.0.2.1', 'user-agent': 'Safari'}}, 'secret');
  assert.equal(first, second);
  assert.doesNotMatch(first, /192\.0\.2\.1/);
});

test('admin order records keep safe fields and controlled statuses', () => {
  const orderId = '20261001120000-a1b2c3d4';
  const record = normalizeOrderRecord({
    orderId,
    createdAt: '2026-10-01T12:00:00.000Z',
    kind: 'stl',
    customer: {name: 'Роман', contact: '+7 900 000-00-00'},
    message: 'Стоимость: 900 ₽',
    files: [{name: 'detail.stl', url: 'https://disk.yandex.ru/d/example'}],
    status: 'in_progress'
  });
  assert.equal(record.status, 'in_progress');
  assert.equal(orderRecordPath(orderId), 'app:/Заявки/2026-10-01/20261001120000-a1b2c3d4/заявка.json');
  assert.equal(cleanOrderStatus('ready'), 'ready');
  assert.throws(() => cleanOrderStatus('deleted'), /статус/);
});
