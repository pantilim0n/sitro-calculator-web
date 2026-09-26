import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import makerworld from '../api/makerworld.js';
import {
  bindQuantityInput,
  calculateMakerWorldQuote,
  estimateStlVolumeCm3,
  normalizeQuantity,
  stlCalculationErrorMessage,
  summarizeStlItems
} from '../calculator-core.js';

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

test('portfolio lightbox supports mouse, keyboard, navigation and mobile swipe', () => {
  assert.match(indexHtml, /id="lightbox" role="dialog" aria-modal="true"/);
  assert.match(indexHtml, /id="lightboxPrev"/);
  assert.match(indexHtml, /id="lightboxNext"/);
  assert.match(indexHtml, /portfolioGrid\.addEventListener\('keydown'/);
  assert.match(indexHtml, /\['Enter',' '\]\.includes\(e\.key\)/);
  assert.match(indexHtml, /e\.key==='ArrowLeft'/);
  assert.match(indexHtml, /e\.key==='ArrowRight'/);
  assert.match(indexHtml, /e\.key==='Escape'/);
  assert.match(indexHtml, /addEventListener\('touchend'/);
  assert.match(indexHtml, /document\.body\.classList\.add\('lightbox-open'\)/);
  assert.match(indexHtml, /role="button" tabindex="0" aria-label="Открыть:/);
});

test('quantity changes recalculate MakerWorld totals for input and change events', () => {
  const listeners = {};
  const input = {
    value: '1',
    addEventListener(type, listener) {
      listeners[type] = listener;
    }
  };
  const seen = [];
  bindQuantityInput(input, quantity => seen.push(quantity));

  input.value = '3';
  listeners.input();
  input.value = '2';
  listeners.change();

  assert.deepEqual(seen, [3, 2]);
  assert.equal(input.value, '2');

  const quote = calculateMakerWorldQuote({
    unitGrams: 48,
    unitSeconds: 14724,
    quantity: 3,
    materialPrice: 10,
    machineHour: 10,
    minimumOrder: 300
  });
  assert.equal(quote.quantity, 3);
  assert.equal(quote.totalGrams, 144);
  assert.equal(quote.totalHours, 12.27);
  assert.equal(Math.ceil(quote.price), 1563);

  const minimumQuote = calculateMakerWorldQuote({
    unitGrams: 1,
    unitSeconds: 60,
    quantity: 1,
    materialPrice: 8,
    machineHour: 10,
    minimumOrder: 300
  });
  assert.equal(minimumQuote.price, 300);
});

test('quantity normalization and minimum order cover decreases and multiple STL rows', () => {
  assert.equal(normalizeQuantity(0), 1);
  assert.equal(normalizeQuantity(-4), 1);
  assert.equal(normalizeQuantity(2.9), 2);

  const batch = summarizeStlItems([
    {file: 'cube.stl', qty: 2, material: 'PLA', color: 'Чёрный'},
    {file: 'pyramid.stl', qty: 1, material: 'PLA', color: 'Чёрный'},
    {file: 'part.stl', qty: 1, material: 'PETG', color: 'Белый'}
  ], 300);

  assert.deepEqual(batch.groups.map(group => group.count), [3, 1]);
  assert.equal(batch.minimumTotal, 600);
  assert.match(indexHtml, /Количество: '\+quote\.quantity\+' шт\./);
  assert.match(indexHtml, /bindQuantityInput\(row\.querySelector\('\.stl-qty'\)/);
});

test('ASCII and binary STL geometry produces a volume estimate', async () => {
  const ascii = `solid tetra
facet normal 0 0 0
outer loop
vertex 0 0 0
vertex 10 0 0
vertex 0 10 0
endloop
endfacet
facet normal 0 0 0
outer loop
vertex 0 0 0
vertex 0 0 10
vertex 10 0 0
endloop
endfacet
facet normal 0 0 0
outer loop
vertex 0 0 0
vertex 0 10 0
vertex 0 0 10
endloop
endfacet
facet normal 0 0 0
outer loop
vertex 10 0 0
vertex 0 0 10
vertex 0 10 0
endloop
endfacet
endsolid tetra`;
  const triangles = [
    [[0,0,0],[10,0,0],[0,10,0]],
    [[0,0,0],[0,0,10],[10,0,0]],
    [[0,0,0],[0,10,0],[0,0,10]],
    [[10,0,0],[0,0,10],[0,10,0]]
  ];
  const binary = new ArrayBuffer(84 + triangles.length * 50);
  const view = new DataView(binary);
  view.setUint32(80, triangles.length, true);
  triangles.forEach((triangle, index) => {
    let offset = 84 + index * 50 + 12;
    triangle.flat().forEach(value => {
      view.setFloat32(offset, value, true);
      offset += 4;
    });
  });

  const asciiVolume = await estimateStlVolumeCm3(new Blob([ascii]));
  const binaryVolume = await estimateStlVolumeCm3(new Blob([binary]));

  assert.ok(Math.abs(asciiVolume - 1 / 6) < 1e-9);
  assert.ok(Math.abs(binaryVolume - 1 / 6) < 1e-9);
  assert.match(indexHtml, /stlGeometry=new Map\(\)/);
  assert.match(indexHtml, /stlGeometry\.clear\(\)/);
});

test('invalid STL errors explain the actual recovery path', async () => {
  await assert.rejects(
    estimateStlVolumeCm3(new Blob(['not an STL'])),
    error => error.code === 'STL_NO_TRIANGLES'
  );
  await assert.rejects(
    estimateStlVolumeCm3(new Blob([''])),
    error => error.code === 'STL_EMPTY'
  );
  assert.match(stlCalculationErrorMessage({code:'STL_ZERO_VOLUME'}), /нет замкнутого объёма/);
  assert.match(stlCalculationErrorMessage(new ReferenceError('boom')), /Внутренняя ошибка STL-калькулятора/);
  assert.doesNotMatch(indexHtml, /Не удалось рассчитать STL\. Попробуйте другой файл/);
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
