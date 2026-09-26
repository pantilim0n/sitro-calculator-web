import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import adminPortfolio from '../api/admin-portfolio.js';
import {
  categoriesOf,
  filterPortfolioItems,
  generateDescription,
  removeCategoryFromItems,
  renameCategoryInItems,
  setItemCategories
} from '../admin-core.js';

const adminHtml = await readFile(new URL('../admin.html', import.meta.url), 'utf8');
const adminApi = await readFile(new URL('../api/admin-portfolio.js', import.meta.url), 'utf8');

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
  assert.match(adminHtml, /createImageBitmap\(file\)/);
  assert.match(adminHtml, /canvas\.toBlob\(resolve,'image\/webp',\.86\)/);
  assert.match(adminHtml, /@media\(max-width:980px\)/);
  assert.match(adminHtml, /action:'saveAll'/);

  const script = adminHtml.match(/<script type="module">([\s\S]*)<\/script>/)?.[1] || '';
  assert.doesNotThrow(() => new Function(script.replace(/^import .*;$/m, '')));
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
