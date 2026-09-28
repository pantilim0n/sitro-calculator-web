import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import adminPortfolio, {cleanPricing, cleanReviews, cleanServices, cleanSiteConfig, MAX_IMAGE_BASE64_LENGTH} from '../api/admin-portfolio.js';
import {
  categoriesOf,
  filterPortfolioItems,
  generateDescription,
  removeCategoryFromItems,
  renameCategoryInItems,
  setItemCategories
} from '../admin-core.js';
import {
  MAX_UPLOAD_BASE64_LENGTH,
  decodeImageFile,
  estimatedBase64Length,
  prepareImageForUpload
} from '../admin-image.js';

const adminHtml = await readFile(new URL('../admin.html', import.meta.url), 'utf8');
const adminApi = await readFile(new URL('../api/admin-portfolio.js', import.meta.url), 'utf8');
const adminImage = await readFile(new URL('../admin-image.js', import.meta.url), 'utf8');
const adminSettings = await readFile(new URL('../admin-settings.js', import.meta.url), 'utf8');

function responseRecorder() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
}

function githubFetchMock(existingItems = []) {
  const calls = [];
  let blobNumber = 0;
  const fetch = async (url, options = {}) => {
    calls.push({url: String(url), options});
    const path = new URL(url).pathname;
    if (path.endsWith('/git/ref/heads/main') && (!options.method || options.method === 'GET')) return Response.json({object: {sha: 'head'}});
    if (path.endsWith('/git/commits/head')) return Response.json({tree: {sha: 'base-tree'}});
    if (path.endsWith('/contents/portfolio.json')) return Response.json({content: Buffer.from(JSON.stringify(existingItems)).toString('base64')});
    if (path.endsWith('/git/blobs')) return Response.json({sha: 'blob-' + (++blobNumber)});
    if (path.endsWith('/git/trees')) return Response.json({sha: 'new-tree'});
    if (path.endsWith('/git/commits')) return Response.json({sha: 'new-commit'});
    if (path.endsWith('/git/refs/heads/main')) return Response.json({object: {sha: 'new-commit'}});
    return Response.json({message: 'Unexpected mock URL'}, {status: 500});
  };
  return {calls, fetch};
}

test('category edits target stable item ids even when a filter changes row indexes', () => {
  const items = [
    {id: 'first', title: 'First', categories: ['Фигурки']},
    {id: 'second', title: 'Second', categories: ['Авто']}
  ];
  const visible = filterPortfolioItems(items, {category: 'Авто'});

  assert.deepEqual(visible.map(item => item.id), ['second']);
  assert.equal(setItemCategories(items, visible[0].id, ['Авто', 'Технические']), true);
  assert.deepEqual(categoriesOf(items[0]), ['Фигурки']);
  assert.deepEqual(categoriesOf(items[1]), ['Авто', 'Технические']);
  assert.doesNotMatch(adminHtml, /items\[\+r\.dataset\.i\]/);
  assert.match(adminHtml, /setItemCategories\(items,r\.dataset\.id,vals\)/);
});

test('renaming and deleting categories updates every linked work', () => {
  const items = [
    {id: 'one', categories: ['Авто', 'Сувениры']},
    {id: 'two', category: 'Авто'},
    {id: 'three', categories: ['Фигурки']}
  ];

  assert.equal(renameCategoryInItems(items, 'Авто', 'Для авто'), 2);
  assert.deepEqual(categoriesOf(items[0]), ['Для авто', 'Сувениры']);
  assert.deepEqual(categoriesOf(items[1]), ['Для авто']);
  assert.equal(removeCategoryFromItems(items, 'Для авто'), 2);
  assert.deepEqual(categoriesOf(items[0]), ['Сувениры']);
  assert.deepEqual(categoriesOf(items[1]), []);
  assert.deepEqual(categoriesOf(items[2]), ['Фигурки']);
});

test('search includes descriptions and generated descriptions remain category-aware', () => {
  const items = [{id: 'one', title: 'Корпус', description: 'Для платы Meshtastic', categories: ['Технические']}];
  assert.equal(filterPortfolioItems(items, {query: 'meshtastic'}).length, 1);
  assert.match(generateDescription('Корпус', ['Технические']), /точность и прочность/);
});

test('admin UI keeps required controls, upload optimization and responsive layout', () => {
  assert.match(adminHtml, /id="bulkGenerateDescriptions">Сгенерировать описание выбранным/);
  assert.match(adminHtml, /function renderNewUploadCategories\(\)/);
  assert.match(adminHtml, /id="cameraFile"[^>]+capture="environment"/);
  assert.match(adminHtml, /prepareImageForUpload/);
  assert.match(adminHtml, /MAX_UPLOAD_REQUEST_BYTES/);
  assert.match(adminHtml, /response\.status===413/);
  assert.match(adminImage, /createImageBitmap\(file, \{imageOrientation: 'from-image'\}\)/);
  assert.match(adminImage, /canvas\.toBlob\(resolve, 'image\/jpeg', quality\)/);
  assert.match(adminHtml, /@media\(max-width:980px\)/);
  assert.match(adminHtml, /action:'saveAll'/);
  assert.match(adminHtml, /<details class="categories-spoiler"><summary>Добавить фотографию<\/summary>/);
  assert.match(adminHtml, /<details class="categories-spoiler"><summary>Фотографии портфолио<\/summary>/);
  assert.match(adminHtml, /batchFileInput\.multiple=true/);
  assert.match(adminHtml, /id="openMaterialsEditor"/);
  assert.doesNotMatch(adminHtml, /id="materialsAdmin" open/);
  assert.doesNotMatch(adminHtml, /id="servicesAdmin" open/);
  assert.match(adminHtml, /src="\/admin-settings\.js"/);
  assert.match(adminSettings, /id='siteSettingsAdmin'/);
  assert.match(adminSettings, /id='reviewsAdmin'/);
  assert.match(adminSettings, /action:'saveSiteContent'/);

  const script = adminHtml.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1] || '';
  assert.doesNotThrow(() => new Function(script.replace(/^import .*;$/gm, '')));
});

test('site contacts and real reviews are validated for the admin', () => {
  const config = cleanSiteConfig({
    phoneLabel: '+7 905 688-44-43',
    phoneUrl: 'tel:+79056884443',
    address: 'Липецк, ул. Свиридова, 9, 2 этаж',
    addressNote: 'Рынок «Европейский»',
    routeUrl: 'https://yandex.ru/maps/?rtext=~52.578173,39.510493&rtt=automt',
    city: 'Липецк',
    region: 'Липецкая область'
  });
  assert.equal(config.city, 'Липецк');
  assert.throws(() => cleanSiteConfig({...config, routeUrl: 'javascript:alert(1)'}), /Проложить маршрут/);

  const reviews = cleanReviews({items: [{name: 'Заказчик', text: 'Отзыв', photo: '/portfolio/work.jpg', source: '2ГИС', sourceUrl: 'https://2gis.ru/example', visible: true}]});
  assert.equal(reviews.items.length, 1);
  assert.equal(reviews.items[0].source, '2ГИС');
  assert.throws(() => cleanReviews({items: [{name: 'Заказчик', text: 'Отзыв', sourceUrl: 'javascript:alert(1)'}]}), /источник отзыва/i);
  assert.throws(() => cleanReviews({items: [{name: '', text: ''}]}), /имя и текст/i);
});

test('large iPhone JPEG is repeatedly resized until its request is safe', async () => {
  let encodeCalls = 0;
  let cleanedUp = false;
  const encodedSizes = [3_000_000, 2_500_000, 1_800_000];
  const result = await prepareImageForUpload(
    {name: 'IMG_1234.JPG', type: 'image/jpeg', size: 12_000_000},
    {
      decodeImage: async () => ({source: {}, width: 4032, height: 3024, cleanup: () => { cleanedUp = true; }}),
      createCanvas: () => ({
        getContext: () => ({fillRect() {}, drawImage() {}, set fillStyle(value) { void value; }})
      }),
      encodeCanvas: async () => {
        const size = encodedSizes[Math.min(encodeCalls, encodedSizes.length - 1)];
        encodeCalls += 1;
        return new Blob([new Uint8Array(size)], {type: 'image/jpeg'});
      },
      createFileReader: () => ({
        readAsDataURL(blob) {
          this.result = 'data:image/jpeg;base64,' + 'A'.repeat(estimatedBase64Length(blob.size));
          this.onload();
        }
      })
    }
  );

  assert.equal(result.filename, 'IMG_1234.jpg');
  assert.ok(result.dataBase64.length <= MAX_UPLOAD_BASE64_LENGTH);
  assert.equal(encodeCalls, 3);
  assert.equal(cleanedUp, true);
  assert.equal(estimatedBase64Length(2_100_000), 2_800_000);
});

test('unsupported iPhone HEIC gets a useful conversion message', async () => {
  await assert.rejects(
    decodeImageFile(
      {name: 'IMG_1234.HEIC', type: 'image/heic'},
      {
        createImageBitmap: async () => { throw new Error('unsupported'); },
        createImage: () => ({set src(value) { void value; this.onerror(); }}),
        createObjectURL: () => 'blob:test',
        revokeObjectURL() {}
      }
    ),
    error => /HEIC/.test(error.message) && /Наиболее совместимый/.test(error.message)
  );
});

test('admin API reports oversized image payloads as HTTP 413', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {...process.env};
  let fetched = false;
  globalThis.fetch = async () => { fetched = true; return Response.json({}); };
  process.env.GITHUB_TOKEN = 'test-token';
  process.env.ADMIN_PASSWORD = 'test-password';
  process.env.GITHUB_REPO = 'owner/repository';
  try {
    const response = responseRecorder();
    await adminPortfolio({
      method: 'POST',
      body: {
        action: 'uploadOnly',
        password: 'test-password',
        filename: 'too-large.jpg',
        dataBase64: 'A'.repeat(MAX_IMAGE_BASE64_LENGTH + 1)
      }
    }, response);
    assert.equal(response.statusCode, 413);
    assert.match(response.payload.error, /превышает безопасный лимит/i);
    assert.equal(fetched, false);
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
});

test('admin API commits portfolio data atomically without a stale raw GitHub read', () => {
  assert.doesNotMatch(adminApi, /raw\.githubusercontent\.com/);
  assert.match(adminApi, /body\.action === 'saveAll'/);
  assert.match(adminApi, /commitAtHead/);
  assert.match(adminApi, /\{path: src, content: body\.dataBase64\}[\s\S]*\{path: 'portfolio\.json'/);
});

test('saveAll writes portfolio and categories in one Git tree update', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {...process.env};
  const mock = githubFetchMock();
  globalThis.fetch = mock.fetch;
  process.env.GITHUB_TOKEN = 'test-token';
  process.env.ADMIN_PASSWORD = 'test-password';
  process.env.GITHUB_REPO = 'owner/repository';
  try {
    const response = responseRecorder();
    await adminPortfolio({method: 'POST', body: {action: 'saveAll', password: 'test-password', items: [{id: 'one', src: 'one.webp', title: 'One'}], categories: ['Технические']}}, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.sha, 'new-commit');
    const treeCall = mock.calls.find(call => new URL(call.url).pathname.endsWith('/git/trees'));
    const tree = JSON.parse(treeCall.options.body).tree;
    assert.deepEqual(tree.map(entry => entry.path), ['portfolio.json', 'portfolio-categories.json']);
    assert.equal(mock.calls.filter(call => call.options.method === 'PATCH').length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
});

test('site contacts and reviews are saved in one Git commit', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {...process.env};
  const mock = githubFetchMock();
  globalThis.fetch = mock.fetch;
  process.env.GITHUB_TOKEN = 'test-token';
  process.env.ADMIN_PASSWORD = 'test-password';
  process.env.GITHUB_REPO = 'owner/repository';
  try {
    const response = responseRecorder();
    await adminPortfolio({method: 'POST', body: {
      action: 'saveSiteContent',
      password: 'test-password',
      siteConfig: {phoneLabel: '+7 905 688-44-43', phoneUrl: 'tel:+79056884443', address: 'Липецк, ул. Свиридова, 9', routeUrl: 'https://yandex.ru/maps/', city: 'Липецк', region: 'Липецкая область'},
      reviews: {items: []}
    }}, response);
    assert.equal(response.statusCode, 200);
    const treeCall = mock.calls.find(call => new URL(call.url).pathname.endsWith('/git/trees'));
    const tree = JSON.parse(treeCall.options.body).tree;
    assert.deepEqual(tree.map(entry => entry.path), ['site-config.json', 'reviews.json']);
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
});

test('calculator pricing is validated and written as one atomic file update', async () => {
  const pricing = cleanPricing({minimumOrder: 300, machineHour: 10, materials: {PLA:{price:10}, PETG:{price:8}, ABS:{price:10}, ASA:{price:24}, PA:{price:20}}});
  assert.equal(pricing.materials.ASA.price, 24);
  assert.equal(pricing.materials.PLA.density, 1.24);
  assert.throws(() => cleanPricing({...pricing, machineHour: 0}), /Работа принтера/);
  assert.match(adminHtml, /Тарифы калькулятора/);
  assert.match(adminHtml, /action:'savePricing'/);

  const originalFetch = globalThis.fetch;
  const originalEnv = {...process.env};
  const mock = githubFetchMock();
  globalThis.fetch = mock.fetch;
  process.env.GITHUB_TOKEN = 'test-token';
  process.env.ADMIN_PASSWORD = 'test-password';
  process.env.GITHUB_REPO = 'owner/repository';
  try {
    const response = responseRecorder();
    await adminPortfolio({method: 'POST', body: {action: 'savePricing', password: 'test-password', pricing}}, response);
    assert.equal(response.statusCode, 200);
    const treeCall = mock.calls.find(call => new URL(call.url).pathname.endsWith('/git/trees'));
    const tree = JSON.parse(treeCall.options.body).tree;
    assert.deepEqual(tree.map(entry => entry.path), ['pricing.json']);
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
});

test('admin supports dynamic materials and editable services', () => {
  const pricing = cleanPricing({minimumOrder: 300, machineHour: 10, materials: {PLA: {price: 12, density: 1.24}, TPU: {price: 30, density: 1.2}}});
  assert.deepEqual(Object.keys(pricing.materials), ['PLA', 'TPU']);
  assert.equal(pricing.materials.TPU.price, 30);
  const services = cleanServices([{id: 'x', title: 'Печать', short: 'Коротко', description: 'Полное описание', visible: true, sort: 1}]);
  assert.equal(services[0].description, 'Полное описание');
  assert.match(adminHtml, /id="materialAdminList"/);
  assert.match(adminHtml, /id="addMaterial"/);
  assert.match(adminHtml, /id="serviceAdminList"/);
  assert.match(adminHtml, /action:'saveServices'/);
  assert.match(adminApi, /body\.action === 'saveServices'/);
  assert.match(adminHtml, /material-admin-row\{grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
});

test('upload adds the image and fresh portfolio state in one commit', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {...process.env};
  const mock = githubFetchMock([{id: 'existing', src: 'existing.webp', title: 'Existing'}]);
  globalThis.fetch = mock.fetch;
  process.env.GITHUB_TOKEN = 'test-token';
  process.env.ADMIN_PASSWORD = 'test-password';
  process.env.GITHUB_REPO = 'owner/repository';
  try {
    const response = responseRecorder();
    await adminPortfolio({method: 'POST', body: {action: 'upload', password: 'test-password', filename: 'new.webp', dataBase64: 'dGVzdA==', title: 'New', categories: ['Авто']}}, response);
    assert.equal(response.statusCode, 200);
    assert.match(response.payload.src, /^portfolio\/.*-new\.webp$/);
    assert.equal(mock.calls.some(call => call.url.includes('raw.githubusercontent.com')), false);
    const treeCall = mock.calls.find(call => new URL(call.url).pathname.endsWith('/git/trees'));
    const tree = JSON.parse(treeCall.options.body).tree;
    assert.equal(tree.length, 2);
    assert.equal(tree.some(entry => entry.path === 'portfolio.json'), true);
    assert.equal(tree.some(entry => entry.path === response.payload.src), true);
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
});
