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
import {buildMakerOrderText,buildStlOrderText,messengerDraftUrl} from '../order-core.js';

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

test('PETG is the default material for new STL calculations', () => {
  assert.match(indexHtml, /<option value="PETG" selected>PETG/);
  assert.match(indexHtml, /m==='PETG'\?' selected'/);
  assert.match(indexHtml, /rates\.PETG\?'PETG'/);
  assert.match(indexHtml, /if\(!hasStlFiles\)[\s\S]*option\.value==='PETG'[\s\S]*material\.value='PETG'/);
});

test('calculator directs customers to MakerWorld when they need a model', () => {
  assert.equal((indexHtml.match(/href="https:\/\/makerworld\.com\/en\/3d-models"/g) || []).length, 2);
  assert.match(indexHtml, /Найти модель на MakerWorld/);
  assert.match(indexHtml, /профиль <a href="https:\/\/makerworld\.com\/en\/3d-models"[^>]*>MakerWorld ↗<\/a>/);
  assert.match(indexHtml, /placeholder="Вставьте ссылку на модель MakerWorld"/);
  assert.match(indexHtml, /Пример: makerworld\.com\/models\/123456/);
  assert.match(indexHtml, /function normalizeMakerWorldUrl\(value\)/);
  assert.match(indexHtml, /Нужна ссылка вида makerworld\.com\/models\/123456/);
  assert.match(siteEnhancements, /keepCalculatorFieldsAboveKeyboard/);
  assert.match(siteEnhancements, /window\.visualViewport\?\.addEventListener\('resize'/);
  assert.match(siteEnhancementStyles, /\.keyboard-safe-field/);
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
  assert.match(indexHtml, /design-assets\/hero-printing\.jpg/);
  assert.match(indexHtml, /design-assets\/sitro-logo-small\.png/);
  assert.match(indexHtml, /href="\/design-kit\.css\?v=/);
  assert.match(indexHtml, /src="\/design-kit\.js\?v=/);
  assert.match(indexHtml, /href="https:\/\/yandex\.ru\/maps\/\?rtext=~52\.578173,39\.510493&amp;rtt=automt"/);
  assert.match(indexHtml, /src="\/site-enhancements\.js\?v=/);
  assert.match(indexHtml, /href="\/site-enhancements\.css\?v=/);
  assert.match(indexHtml, /streetAddress/);
  assert.match(indexHtml, /rel="canonical"/);
  assert.equal(businessStructuredData['@type'], 'LocalBusiness');
  assert.equal(businessStructuredData.address.streetAddress, 'ул. Свиридова, 9, 2 этаж');
  assert.match(siteEnhancements, /fetchJson\('\/site-config\.json'/);
  assert.match(siteEnhancements, /fetchJson\('\/reviews\.json'/);
  assert.match(siteEnhancements, /Отзывы заказчиков/);
  assert.match(siteEnhancements, /Отзыв на/);
  assert.match(siteEnhancements, /Оставить отзыв в 2ГИС/);
  assert.match(siteEnhancements, /70000001092449856\/tab\/reviews/);
  assert.match(siteEnhancements, /134340194788\/reviews\/\?add-review=true/);
  assert.match(siteEnhancementStyles, /\.reviews-grid/);
  assert.match(siteEnhancementStyles, /\.review-invitation/);
  assert.match(designKit, /url\("\/design-assets\/hero-printing\.jpg"\)/);
  assert.match(designKit, /@media \(max-width: 760px\)/);
  assert.match(designKit, /\.prompt-mobile-photo::after/);
  assert.match(designKit, /background-size: 100% 100%, var\(--hero-mobile-scale, 100%\) auto/);
  assert.match(designKit, /margin-top: -170px !important/);
  assert.match(siteEnhancements, /review-service-icon/);
  assert.match(siteEnhancements, /SitroSocialIcons\?\.render\('2gis'\)/);
  assert.match(designKit, /\.mobile-call-button/);
  assert.match(indexHtml, /class="mobile-call-button"[^>]+href="tel:\+79056884443"/);
  assert.match(designKit, /\.calc \.color-swatch/);
  assert.match(designKit, /min-width: 761px/);
  assert.match(designKitScript, /icon-clients\.svg/);
  assert.match(designKitScript, /tel:\+79056884443/);
});

test('desktop hero artwork stays balanced on wide screens', () => {
  assert.match(designKit, /\.hero::after\s*\{[\s\S]*inset:\s*0 auto 0 50%\s*!important/);
  assert.match(designKit, /width:\s*min\(100%,\s*1240px\)\s*!important/);
  assert.match(designKit, /transform:\s*translateX\(-50%\)\s*!important/);
  assert.match(designKit, /@media \(min-width:\s*1680px\)[\s\S]*\.hero::after\s*\{[\s\S]*width:\s*min\(100%,\s*1480px\)/);
});

test('first render uses the final layout without a refresh jump', () => {
  const headEnd = indexHtml.indexOf('</head>');
  const bodyStart = indexHtml.indexOf('<body>');
  const designStyles = indexHtml.indexOf('/design-kit.css?v=');

  assert.ok(designStyles > -1 && designStyles < headEnd, 'design stylesheet must block the first render');
  assert.equal(indexHtml.indexOf('/design-kit.css?v=', bodyStart), -1, 'design stylesheet must not load at the end of body');
  assert.match(indexHtml, /<section class="hero"><div class="prompt-mobile-photo"/);
  assert.match(indexHtml, /<section class="trust-section" id="sitroTrust">/);
  assert.match(indexHtml, /if\(hero&&!hero\.querySelector\('\.hero-layout'\)\)/);
  assert.doesNotMatch(indexHtml, /servicesGrid\.setAttribute\('aria-busy','true'\);servicesGrid\.innerHTML=/);
  assert.match(indexHtml, /\.sitro-scroll-reveal,\.sitro-scroll-reveal\.is-visible\{opacity:1;transform:none;transition:none\}/);
});

test('mobile hero keeps the headline above the printed part', () => {
  assert.match(designKit, /top:\s*clamp\(18px,\s*5vw,\s*24px\)/);
  assert.match(designKit, /font-size:\s*clamp\(30px,\s*8\.6vw,\s*36px\)/);
});

test('calculator communicates three simple steps and keeps one primary order action', () => {
  assert.match(siteEnhancements, /className='calc-progress'/);
  assert.match(siteEnhancements, /Модель[\s\S]*Стоимость[\s\S]*Заявка/);
  assert.doesNotMatch(siteEnhancements, /<span>Параметры<\/span>/);
  assert.equal(messengerDraftUrl('telegram','Тест'), 'https://t.me/SITMAKER?text='+encodeURIComponent('Тест'));
  assert.equal(messengerDraftUrl('max','Тест'), 'https://max.ru/u/f9LHodD0cOJGycqhJHkPaD-ymeKK6oYbrxtihzH4KBOgABKCslGcU7jGl_8');
  assert.doesNotMatch(messengerDraftUrl('max','Тест'), /:share/);
  assert.match(siteEnhancements, /window\.SitroSubmitOrder=async kind/);
  assert.doesNotMatch(siteEnhancements, /location\.href=messengerDraftUrl/);
  assert.match(siteEnhancements, /Внутренняя отправка заявок сейчас подключается/);
  assert.match(indexHtml, /id="continueOrder" type="button">Отправить заявку/);
  assert.doesNotMatch(indexHtml, /Перейти к заявке|Перейти к отправке заявки/);
});

test('mobile keyboard support does not create a viewport scroll feedback loop', () => {
  assert.match(siteEnhancements, /visualViewport\?\.addEventListener\('resize'/);
  assert.doesNotMatch(siteEnhancements, /visualViewport\?\.addEventListener\('scroll'/);
  assert.match(siteEnhancements, /window\.scrollBy\(0,delta\)/);
});

test('native site order sends the selected model without a second form', () => {
  assert.match(siteEnhancements, /fetch\('\/api\/order'/);
  assert.match(siteEnhancements, /action:'prepare'/);
  assert.match(siteEnhancements, /action:'submit'/);
  assert.match(siteEnhancements, /Загружаю модель/);
  assert.match(indexHtml, /window\.SitroOrderFiles=/);
  assert.doesNotMatch(siteEnhancements, /forms\.yandex\.ru/);
  assert.doesNotMatch(siteEnhancementStyles, /\.yandex-order-panel/);
});

test('messenger preview uses a dedicated branded social card', () => {
  assert.match(indexHtml, /property="og:image" content="https:\/\/sitrocalculatorvercelv04\.vercel\.app\/design-assets\/sitro-share-card\.png\?v=20260930"/);
  assert.match(indexHtml, /property="og:image:width" content="1200"/);
  assert.match(indexHtml, /property="og:image:height" content="630"/);
  assert.match(indexHtml, /name="twitter:image" content="https:\/\/sitrocalculatorvercelv04\.vercel\.app\/design-assets\/sitro-share-card\.png\?v=20260930"/);
});

test('portfolio supports optional production details without inventing values', () => {
  assert.match(indexHtml, /data-material/);
  assert.match(indexHtml, /data-dimensions/);
  assert.match(indexHtml, /data-lead-time/);
  assert.match(indexHtml, /data-price-from/);
  assert.match(indexHtml, /id="lightboxMeta"/);
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

test('STL result exposes the contact fields immediately after the price', () => {
  assert.doesNotMatch(indexHtml, /id="shareStlOrder"/);
  assert.doesNotMatch(indexHtml, /id="copyStlOrder"/);
  assert.doesNotMatch(indexHtml, /id="downloadStlOrder"/);
  assert.match(indexHtml, /showOrderFormAfterResult\('stl',stlResult,status\)/);
  assert.match(indexHtml, /resultNode\.after\(fields\)/);
  assert.doesNotMatch(indexHtml, /showStlOrderStep|Перейти к заявке/);
  assert.doesNotMatch(indexHtml, /taplink\.cc/i);
});

test('calculator progress advances only after a visible result', () => {
  assert.match(siteEnhancements, /syncCalculatedStep/);
  assert.match(siteEnhancements, /getComputedStyle\(result\)\.display!==['"]none['"]/);
  assert.doesNotMatch(siteEnhancements, /#calculate,#sliceStl['"]\)\)setTimeout\(\(\)=>setStep\(2\)/);
});

test('MakerWorld result creates a complete shareable order', () => {
  assert.doesNotMatch(indexHtml, /id="shareMakerOrder"/);
  assert.doesNotMatch(indexHtml, /id="copyMakerOrder"/);
  assert.doesNotMatch(indexHtml, /id="downloadMakerOrder"/);
  assert.match(indexHtml, /function buildMakerOrderText\(\)/);
  assert.match(indexHtml, /id="orderContactHelp"/);
  assert.match(indexHtml, /id="continueOrder"/);
  assert.match(indexHtml, /Телефон для обратной связи/);
  assert.doesNotMatch(indexHtml, /id="stlCustomerContact"[^>]+required/);
  assert.match(indexHtml, /showOrderFormAfterResult\('maker',result,document\.getElementById\('makerOrderStatus'\)\)/);
  assert.match(indexHtml, /window\.SitroRevealOrderForm=/);
  assert.doesNotMatch(indexHtml, /showOrderStep|Состав заявки/);
  assert.match(indexHtml, /SitroOrderDrafts\.maker=buildMakerOrderText/);
  const draft=buildMakerOrderText({customer:{name:'Иван',contact:'@ivan',comment:'Позвонить вечером'},order:{model:'Тестовая модель',profile:'Стандарт',quantity:2,material:'PLA',grams:96,hours:8.18,price:1234,url:'https://makerworld.com/models/123'}});
  assert.match(draft, /ЗАЯВКА С САЙТА СИТРО[\s\S]*Заказчик: Иван[\s\S]*Контакт для ответа: @ivan/);
  assert.match(draft, /Название: Тестовая модель[\s\S]*Количество: 2 шт\.[\s\S]*Предварительная стоимость: 1234 ₽/);
  assert.ok(draft.includes('\n'));
  assert.doesNotMatch(draft, /\\n/);
});

test('STL order reads customer details when the user sends it', () => {
  assert.match(indexHtml, /const buildStlOrderText=\(\)=>/);
  assert.match(indexHtml, /SitroOrderDrafts\.stl=buildStlOrderText/);
  const draft=buildStlOrderText({customer:{contact:'+7 900 000-00-00'},items:[{file:'detail.stl',qty:3,material:'PETG',color:'Чёрный',estimatedGrams:72.4}],groupCount:1,total:850});
  assert.match(draft, /1\. detail\.stl[\s\S]*Количество: 3 шт\. · Материал: PETG · Цвет: Чёрный/);
  assert.match(draft, /Предварительная стоимость: ≈ 850 ₽[\s\S]*Файлы STL нужно приложить к сообщению/);
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
