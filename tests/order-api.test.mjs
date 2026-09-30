import test from 'node:test';
import assert from 'node:assert/strict';
import {makeOrderId, orderFolder, telegramText, validateFiles} from '../api/order.js';

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
