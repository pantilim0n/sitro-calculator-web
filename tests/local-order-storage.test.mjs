import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {createServer} from '../server.js';
import {orderFolder} from '../api/order.js';
import {localPath} from '../api/_local-order-storage.js';

test('Russian VPS accepts, stores and serves an STL order without Yandex Disk', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sitro-orders-'));
  const previous = Object.fromEntries(['ORDER_STORAGE_DIR', 'RATE_LIMIT_SECRET', 'YANDEX_DISK_TOKEN', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'MAX_BOT_TOKEN', 'MAX_CHAT_ID', 'MAX_USER_ID'].map(key => [key, process.env[key]]));
  process.env.ORDER_STORAGE_DIR = directory;
  process.env.RATE_LIMIT_SECRET = 'test-secret-that-is-longer-than-thirty-two-characters';
  delete process.env.YANDEX_DISK_TOKEN;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  delete process.env.MAX_BOT_TOKEN;
  delete process.env.MAX_CHAT_ID;
  delete process.env.MAX_USER_ID;
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const preparedResponse = await fetch(`${base}/api/order`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'prepare', files: [{name: 'detail.stl', size: 5}]})});
    assert.equal(preparedResponse.status, 200);
    const prepared = await preparedResponse.json();
    assert.equal(prepared.uploads.length, 1);

    const uploadResponse = await fetch(`${base}${prepared.uploads[0].href}`, {method: 'PUT', body: Buffer.from('solid'), headers: {'Content-Type': 'application/octet-stream'}});
    assert.equal(uploadResponse.status, 204);

    const submittedResponse = await fetch(`${base}/api/order`, {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https'}, body: JSON.stringify({action: 'submit', orderId: prepared.orderId, kind: 'stl', customer: {name: 'Тест', contact: '+70000000000'}, message: 'Тестовый расчёт', paths: [prepared.uploads[0].path]})});
    assert.equal(submittedResponse.status, 200);
    const submitted = await submittedResponse.json();
    assert.equal(submitted.ok, true);

    const record = JSON.parse(await readFile(localPath(`${orderFolder(prepared.orderId)}/заявка.json`), 'utf8'));
    assert.equal(record.customer.name, 'Тест');
    assert.equal(record.files[0].size, 5);
    const download = new URL(record.files[0].url);
    const downloaded = await fetch(`${base}${download.pathname}${download.search}`);
    assert.equal(await downloaded.text(), 'solid');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, {recursive: true, force: true});
    for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value;
  }
});
