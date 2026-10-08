import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const pages = [
  '3d-pechat-lipeck.html',
  '3d-modelirovanie.html',
  'tehnicheskie-detali.html',
  '3d-pechat-korpusov-lipeck.html',
  'zapchasti-na-3d-printere-lipeck.html',
  'prototipirovanie-lipeck.html',
  'seriynaya-3d-pechat-lipeck.html',
  'suveniry-3d-pechat-lipeck.html'
];

const read = file => readFile(new URL(file, root), 'utf8');

test('SEO service pages have unique metadata, one H1 and valid structured data', async () => {
  const documents = await Promise.all(pages.map(read));
  const titles = [];
  const canonicals = [];
  for (const [index, html] of documents.entries()) {
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    assert.ok(title?.includes('Липецк'), `${pages[index]} needs a local title`);
    assert.ok(description?.length >= 90 && description.length <= 180, `${pages[index]} needs a useful description`);
    assert.equal((html.match(/<h1>/g) || []).length, 1, `${pages[index]} needs exactly one H1`);
    assert.ok(canonical?.startsWith('https://ситро-3д.рф/'));
    titles.push(title);
    canonicals.push(canonical);
    for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      assert.doesNotThrow(() => JSON.parse(match[1]), `${pages[index]} has invalid JSON-LD`);
    }
  }
  assert.equal(new Set(titles).size, pages.length);
  assert.equal(new Set(canonicals).size, pages.length);
});

test('main page and sitemap link every SEO service page', async () => {
  const [index, sitemap] = await Promise.all([read('index.html'), read('sitemap.xml')]);
  for (const page of pages) {
    assert.match(index, new RegExp(`href="/${page.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
    assert.ok(sitemap.includes(`<loc>https://ситро-3д.рф/${page}</loc>`));
  }
  assert.ok(index.includes('Популярные задачи для 3D-печати'));
});
