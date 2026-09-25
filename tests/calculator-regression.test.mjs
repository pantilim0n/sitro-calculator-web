import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import makerworld from '../api/makerworld.js';

const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('STL result exposes all order actions', () => {
  assert.match(indexHtml, /class="order-btn show" id="shareStlOrder"/);
  assert.match(indexHtml, /class="order-btn show" id="copyStlOrder"/);
  assert.match(indexHtml, /class="order-btn show" href="https:\/\/taplink\.cc\/sitro"/);
});

test('multi-STL preview selection and color sync stay wired', () => {
  assert.match(indexHtml, /row\.addEventListener\('click'.*selectRow\(row,f\)/s);
  assert.match(indexHtml, /sitro-stl-selected.*detail:\{file,color:/s);
  assert.match(indexHtml, /sitro-stl-color/);
  assert.match(indexHtml, /\.stl-row\.active\{/);
});

test('STL and MakerWorld keep separate result containers', () => {
  assert.match(indexHtml, /id="stlResult"/);
  assert.match(indexHtml, /id="calcResult"/);
  assert.match(indexHtml, /stlResult\.innerHTML=/);
});

test('MakerWorld API normalizes a current design-service response', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  globalThis.fetch = async url => {
    requestedUrl = String(url);
    return Response.json({
      title: 'Test model',
      coverUrl: 'https://example.test/model.png',
      modelId: 'model-1',
      instances: [{
        id: 7,
        profileId: 11,
        title: '0.20mm Standard',
        prediction: 3600,
        materialCnt: 1,
        instanceFilaments: [{type: 'PLA', color: '#ff0000', weight: 12.5}],
        pictures: [{url: 'https://example.test/profile.png'}]
      }]
    });
  };

  try {
    const response = await makerworld.fetch(new Request(
      'http://localhost/api/makerworld?url=' +
      encodeURIComponent('https://makerworld.com/models/3331794?appSharePlatform=copy')
    ));
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requestedUrl, 'https://api.bambulab.com/v1/design-service/design/3331794');
    assert.equal(data.profiles[0].printTimeSeconds, 3600);
    assert.equal(data.profiles[0].totalWeightGrams, 12.5);
    assert.equal(data.profiles[0].filaments[0].type, 'PLA');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
