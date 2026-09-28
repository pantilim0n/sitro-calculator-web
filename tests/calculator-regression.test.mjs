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
const pricing = JSON.parse(await readFile(new URL('../pricing.json', import.meta.url), 'utf8'));
const siteEnhancements = await readFile(new URL('../site-enhancements.js', import.meta.url), 'utf8');
const siteEnhancementStyles = await readFile(new URL('../site-enhancements.css', import.meta.url), 'utf8');
const designKit = await readFile(new URL('../design-kit.css', import.meta.url), 'utf8');
const designKitScript = await readFile(new URL('../design-kit.js', import.meta.url), 'utf8');
const businessStructuredData = JSON.parse(indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] || '{}');

test('calculator loads editable pricing and keeps current production tariffs', () => {
  assert.match(indexHtml, /fetch\('\/pricing\.json\?pricing='/);
  assert.match(indexHtml, /await pricingReady/);
  const materialPrices = Object.fromEntries(Object.entries(pricing.materials).map(([code, value]) => [code, value.price]));
  assert.deepEqual(Object.fromEntries(['PLA', 'PETG', 'ABS', 'ASA', 'PA'].map(code => [code, materialPrices[code]])), {PLA:12, PETG:8, ABS:11, ASA:24, PA:20});
  assert.equal(materialPrices.TPU, 18);
  assert.ok(Object.values(pricing.materials).every(material => Number(material.price) > 0 && Number(material.density) > 0));
  assert.equal(pricing.machineHour, 10);
  assert.equal(pricing.minimumOrder, 300);
});

test('calculator directs customers to MakerWorld when they need a model', () => {
  assert.equal((indexHtml.match(/href="https:\/\/makerworld\.com\/en\/3d-models"/g) || []).length, 2);
  assert.match(indexHtml, /Найти модель на MakerWorld/);
  assert.match(indexHtml, /профиль <a href="https:\/\/makerworld\.com\/en\/3d-models"[^>]*>MakerWorld ↗<\/a>/);
  assert.match(indexHtml, /placeholder="https:\/\/makerworld\.com\/models\/3331794"/);
});

test('site follows the supplied СИТРО hero direction', () => {
  assert.match(indexHtml, /hero-line-one/);
  assert.match(indexHtml, /детали <em>в 3D<\/em>/);
  assert.doesNotMatch(indexHtml, /class="header-cta"/);
  assert.match(indexHtml, /Контакты и соцсети/);
  assert.match(indexHtml, /Материалы и цены/);
  assert.match(indexHtml, /hero-benefits/);
  assert.match(indexHtml, /hero-visual/);
  assert.match(indexHtml, /floatingHeader\.style\.transform/);
  assert.match(indexHtml, /floatingMenu\.innerHTML/);
  assert.match(indexHtml, /mobileButton\.onclick/);
  assert.match(indexHtml, /brandLink\.addEventListener\('click'/);
  assert.match(indexHtml, /heroIcons=\[/);
  assert.match(indexHtml, /design-assets\/hero-printing\.png/);
  assert.match(indexHtml, /design-assets\/sitro-logo\.png/);
  assert.match(indexHtml, /href="\/design-kit\.css\?v=/);
  assert.match(indexHtml, /src="\/design-kit\.js\?v=/);
  assert.match(indexHtml, /href="https:\/\/yandex\.ru\/maps\/\?rtext=~52\.578173,39\.510493&amp;rtt=automt"/);
  assert.match(indexHtml, /src="\/site-enhancements\.js\?v=/);
  assert.match(indexHtml, /href="\/site-enhancements\.css"/);
  assert.match(indexHtml, /streetAddress/);
  assert.match(indexHtml, /rel="canonical"/);
  assert.equal(businessStructuredData['@type'], 'LocalBusiness');
  assert.equal(businessStructuredData.address.streetAddress, 'ул. Свиридова, 9, 2 этаж');
  assert.match(siteEnhancements, /fetchJson\('\/site-config\.json'/);
  assert.match(siteEnhancements, /fetchJson\('\/reviews\.json'/);
  assert.match(siteEnhancements, /Отзывы заказчиков/);
  assert.match(siteEnhancements, /Отзыв на/);
  assert.match(siteEnhancementStyles, /\.reviews-grid/);
  assert.match(designKit, /url\("\/design-assets\/hero-printing\.png"\)/);
  assert.match(designKit, /@media \(max-width: 760px\)/);
  assert.match(designKit, /\.calc \.color-swatch/);
  assert.match(designKit, /min-width: 761px/);
  assert.match(designKitScript, /icon-clients\.svg/);
});

test('a browser refresh returns to the top instead of restoring the portfolio anchor', () => {
  assert.match(indexHtml, /type==='reload'/);
  assert.match(indexHtml, /history\.scrollRestoration='manual'/);
  assert.match(indexHtml, /history\.replaceState\(null,'',location\.pathname\+location\.search\)/);
  assert.match(indexHtml, /scrollTo\(0,0\)/);
});

test('calculator separates MakerWorld and STL into clear modes', () => {
  assert.match(indexHtml, /class="calc-mode-tabs" role="tablist"/);
  assert.match(indexHtml, /id="modeMakerworld"[^>]+aria-controls="makerworldFields"/);
  assert.match(indexHtml, /id="modeStl"[^>]+aria-controls="stlFields"/);
  assert.match(indexHtml, /function setCalculatorMode\(mode\)/);
  assert.match(indexHtml, /stlFields\.hidden=maker/);
});

test('services open full descriptions and mobile portfolio is a horizontal strip', () => {
  assert.match(indexHtml, /fetch\('\/services\.json\?services='/);
  assert.match(indexHtml, /id="serviceModal" role="dialog"/);
  assert.match(indexHtml, /serviceModalDescription/);
  assert.match(indexHtml, /\.portfolio-grid\{display:flex;overflow-x:auto/);
});

test('STL result exposes all order actions', () => {
  assert.match(indexHtml, /class="order-btn show" id="shareStlOrder"/);
  assert.match(indexHtml, /class="order-btn show" id="copyStlOrder"/);
  assert.match(indexHtml, /class="order-btn show" href="https:\/\/taplink\.cc\/sitro"/);
});

test('MakerWorld result creates a complete shareable order', () => {
  assert.match(indexHtml, /id="shareMakerOrder"/);
  assert.match(indexHtml, /id="copyMakerOrder"/);
  assert.match(indexHtml, /function buildMakerOrderText\(\)/);
  assert.match(indexHtml, /Модель:.*Профиль:.*Ссылка:.*Количество:.*Материал:.*Вес:.*Время печати:.*Предварительная стоимость:/s);
  assert.match(indexHtml, /Укажите телефон или Telegram/);
});

test('STL order reads customer details when the user sends it', () => {
  assert.match(indexHtml, /const buildStlOrderText=\(\)=>/);
  assert.match(indexHtml, /navigator\.share\(\{title:'Заявка на 3D-печать СИТРО',text:buildStlOrderText\(\),files:activeFiles\}\)/);
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

test('portfolio lightbox places details beside the image on desktop and below it on mobile', () => {
  assert.match(indexHtml, /\.lightbox-stage\{[^}]*grid-template-columns:minmax\(0,1fr\) minmax\(260px,340px\)/);
  assert.match(indexHtml, /@media\(max-width:760px\)\{[\s\S]{0,200}\.lightbox-stage\{grid-template-columns:1fr/);
  assert.match(indexHtml, /\.lightbox-info\{[^}]*max-height:calc\(100vh - 80px\);overflow:auto/);
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
