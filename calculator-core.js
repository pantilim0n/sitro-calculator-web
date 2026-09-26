export function normalizeQuantity(value) {
  return Math.max(1, Math.floor(Number(value) || 1));
}

export function bindQuantityInput(input, onUpdate) {
  const update = () => onUpdate(normalizeQuantity(input.value));

  input.addEventListener('input', update);
  input.addEventListener('change', () => {
    input.value = String(normalizeQuantity(input.value));
    update();
  });
}

export function calculateMakerWorldQuote({
  unitGrams,
  unitSeconds,
  quantity,
  materialPrice,
  machineHour,
  minimumOrder
}) {
  const normalizedQuantity = normalizeQuantity(quantity);
  const totalGrams = Number(unitGrams || 0) * normalizedQuantity;
  const totalHours = (Number(unitSeconds || 0) / 3600) * normalizedQuantity;
  const rawPrice = totalGrams * materialPrice + totalHours * machineHour;

  return {
    quantity: normalizedQuantity,
    totalGrams,
    totalHours,
    price: Math.max(minimumOrder, rawPrice)
  };
}

export function summarizeStlItems(items, minimumOrder) {
  const groups = new Map();
  const normalizedItems = items.map(item => ({
    ...item,
    qty: normalizeQuantity(item.qty)
  }));

  normalizedItems.forEach(item => {
    const key = item.material + '|' + item.color.toLowerCase();
    const group = groups.get(key) || {
      material: item.material,
      color: item.color,
      count: 0
    };
    group.count += item.qty;
    groups.set(key, group);
  });

  return {
    items: normalizedItems,
    groups: [...groups.values()],
    minimumTotal: groups.size * minimumOrder
  };
}

export async function estimateStlGeometry(file) {
  const buffer = await file.arrayBuffer();
  if (!buffer.byteLength) throw stlError('STL_EMPTY', 'STL file is empty');

  const view = new DataView(buffer);
  let volumeMm3 = 0;
  let areaMm2 = 0;
  let triangleCount = 0;

  function addTriangle(ax,ay,az,bx,by,bz,cx,cy,cz){
    volumeMm3 += ax*(by*cz-bz*cy) - ay*(bx*cz-bz*cx) + az*(bx*cy-by*cx);
    const abx=bx-ax, aby=by-ay, abz=bz-az;
    const acx=cx-ax, acy=cy-ay, acz=cz-az;
    const crx=aby*acz-abz*acy, cry=abz*acx-abx*acz, crz=abx*acy-aby*acx;
    areaMm2 += 0.5*Math.hypot(crx,cry,crz);
  }

  const isBinary = buffer.byteLength >= 84 && (84 + view.getUint32(80, true) * 50 === buffer.byteLength);
  if (isBinary) {
    const count = view.getUint32(80, true);
    if (!count) throw stlError('STL_NO_TRIANGLES', 'Binary STL does not contain triangles');
    triangleCount = count;
    let off = 84;
    for (let i = 0; i < count; i++, off += 50) {
      const ax=view.getFloat32(off+12,true), ay=view.getFloat32(off+16,true), az=view.getFloat32(off+20,true);
      const bx=view.getFloat32(off+24,true), by=view.getFloat32(off+28,true), bz=view.getFloat32(off+32,true);
      const cx=view.getFloat32(off+36,true), cy=view.getFloat32(off+40,true), cz=view.getFloat32(off+44,true);
      if (![ax,ay,az,bx,by,bz,cx,cy,cz].every(Number.isFinite)) throw stlError('STL_INVALID', 'Binary STL contains invalid coordinates');
      addTriangle(ax,ay,az,bx,by,bz,cx,cy,cz);
    }
  } else {
    const text = new TextDecoder().decode(buffer);
    const number = '([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?)';
    const verts = [...text.matchAll(new RegExp('vertex\\s+'+number+'\\s+'+number+'\\s+'+number, 'ig'))].map(m => [Number(m[1]),Number(m[2]),Number(m[3])]);
    if (verts.length < 3 || verts.length % 3 !== 0) throw stlError('STL_NO_TRIANGLES', 'ASCII STL does not contain complete triangles');
    triangleCount = verts.length / 3;
    for (let i=0;i+2<verts.length;i+=3) {
      const [ax,ay,az]=verts[i], [bx,by,bz]=verts[i+1], [cx,cy,cz]=verts[i+2];
      addTriangle(ax,ay,az,bx,by,bz,cx,cy,cz);
    }
  }

  volumeMm3 = Math.abs(volumeMm3 / 6);
  if (!triangleCount || !Number.isFinite(volumeMm3) || !Number.isFinite(areaMm2)) throw stlError('STL_INVALID', 'STL geometry could not be read');
  if (volumeMm3 <= 1e-6) throw stlError('STL_ZERO_VOLUME', 'STL geometry has no enclosed volume');

  return {volumeCm3: volumeMm3/1000, surfaceAreaCm2: areaMm2/100};
}

export async function estimateStlVolumeCm3(file) {
  const g = await estimateStlGeometry(file);
  return g.volumeCm3;
}

function stlError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function stlCalculationErrorMessage(error) {
  if (error?.code === 'STL_EMPTY') {
    return 'STL-файл пуст. Экспортируйте модель заново и повторите расчёт.';
  }
  if (error?.code === 'STL_NO_TRIANGLES' || error?.code === 'STL_INVALID') {
    return 'Не удалось прочитать геометрию STL. Проверьте файл в Bambu Studio и экспортируйте его заново.';
  }
  if (error?.code === 'STL_ZERO_VOLUME') {
    return 'У модели нет замкнутого объёма. Исправьте геометрию STL в редакторе или отправьте файл для ручной проверки.';
  }
  return 'Внутренняя ошибка STL-калькулятора. Обновите страницу и повторите расчёт. Если ошибка сохранится, отправьте файл нам для проверки.';
}

export function estimateStlQuote({volumeCm3, surfaceAreaCm2=0, quantity, density, materialPrice, minimumOrder, wallThicknessMm=1.2, infill=0.15}) {
  const qty = normalizeQuantity(quantity);
  const solidVolume = Math.max(0, Number(volumeCm3)||0);
  const area = Math.max(0, Number(surfaceAreaCm2)||0);
  const shellCm3 = Math.min(solidVolume, area * (Number(wallThicknessMm)||0) / 10);
  const innerCm3 = Math.max(0, solidVolume - shellCm3);
  const printedCm3 = Math.min(solidVolume, shellCm3 + innerCm3 * Math.max(0, Math.min(1, Number(infill)||0)));
  const estimatedGrams = printedCm3 * Number(density||0) * qty;
  const raw = estimatedGrams * Number(materialPrice||0);
  return {quantity: qty, estimatedGrams, price: Math.max(Number(minimumOrder||0), raw)};
}

// First-screen presentation enhancement. Kept here so the existing HTML and calculator logic stay untouched.
function enhanceSitroHero() {
  const hero = document.querySelector('.hero');
  const wrap = hero?.querySelector('.wrap');
  if (!hero || !wrap || wrap.querySelector('.hero-visual')) return;

  const style = document.createElement('style');
  style.dataset.sitroHero = '1';
  style.textContent = `
    .brand img{width:232px;transition:opacity .2s ease,transform .2s ease}.brand:hover img{transform:translateY(-1px)}
    .hero{position:relative;overflow:hidden;padding:82px 0 72px;background:radial-gradient(circle at 82% 38%,rgba(255,121,0,.22),transparent 30%),radial-gradient(circle at 72% 78%,rgba(255,121,0,.08),transparent 32%)}
    .hero .wrap{display:grid;grid-template-columns:minmax(0,1.12fr) minmax(320px,.88fr);gap:52px;align-items:center}
    .hero-copy{min-width:0}.hero h1{font-size:clamp(48px,6.4vw,78px);max-width:720px}.hero p{max-width:650px}
    .hero-visual{position:relative;min-height:430px;display:grid;place-items:center;perspective:1100px;isolation:isolate}
    .hero-visual:before{content:'';position:absolute;width:330px;height:330px;border-radius:50%;background:radial-gradient(circle,rgba(255,121,0,.30),rgba(255,121,0,.08) 48%,transparent 70%);filter:blur(4px);z-index:-2}
    .hero-visual:after{content:'';position:absolute;width:310px;height:58px;bottom:28px;border-radius:50%;background:#000;filter:blur(22px);opacity:.62;z-index:-1}
    .hero-object{position:relative;width:min(100%,410px);aspect-ratio:4/5;border-radius:30px;overflow:hidden;border:1px solid rgba(255,255,255,.12);background:#121212;box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 55px rgba(255,121,0,.10);transform:rotateY(-8deg) rotateX(2deg);animation:sitro-float 6s ease-in-out infinite;transition:transform .18s ease-out}
    .hero-object img{display:block;width:100%;height:100%;object-fit:cover;object-position:center 22%;filter:saturate(.96) contrast(1.03)}
    .hero-object:after{content:'';position:absolute;inset:0;background:linear-gradient(145deg,rgba(255,255,255,.08),transparent 24%,transparent 70%,rgba(255,121,0,.14));pointer-events:none}
    .hero-badge{position:absolute;left:-14px;bottom:52px;padding:10px 13px;border:1px solid #3a3a3a;border-radius:12px;background:rgba(12,12,12,.86);backdrop-filter:blur(12px);box-shadow:0 12px 32px rgba(0,0,0,.35);font-size:12px;color:#cfcfcf;font-weight:750;letter-spacing:.02em}
    .hero-badge b{display:block;color:#ff7900;font-size:15px;margin-bottom:1px}
    @keyframes sitro-float{0%,100%{transform:translateY(0) rotateY(-8deg) rotateX(2deg)}50%{transform:translateY(-10px) rotateY(-5deg) rotateX(1deg)}}
    @media(max-width:900px){.hero .wrap{grid-template-columns:1fr;gap:24px}.hero-visual{min-height:330px}.hero-object{width:min(78vw,360px);aspect-ratio:1/1}.hero-badge{left:calc(50% - 190px);bottom:28px}.hero h1{max-width:800px}}
    @media(max-width:560px){.brand img{width:182px}.hero{padding:42px 0 38px}.hero .wrap{display:block}.hero-visual{min-height:270px;margin-top:30px}.hero-object{width:min(86vw,300px);border-radius:22px}.hero-badge{left:8px;bottom:16px}.hero h1{font-size:42px}}
    @media(prefers-reduced-motion:reduce){.hero-object{animation:none!important;transition:none!important}}
  `;
  document.head.appendChild(style);

  const copy = document.createElement('div');
  copy.className = 'hero-copy';
  while (wrap.firstChild) copy.appendChild(wrap.firstChild);
  wrap.appendChild(copy);

  const visual = document.createElement('div');
  visual.className = 'hero-visual';
  visual.setAttribute('aria-hidden', 'true');
  visual.innerHTML = '<div class="hero-object"><img src="/3B0AB546-8C8E-420B-9811-F5C1962A443A.PNG" alt="" decoding="async"><div class="hero-badge"><b>СИТРО</b>Реальная работа · 3D-печать</div></div>';
  wrap.appendChild(visual);

  const object = visual.querySelector('.hero-object');
  if (matchMedia('(pointer:fine)').matches && !matchMedia('(prefers-reduced-motion:reduce)').matches) {
    visual.addEventListener('pointermove', event => {
      const r = visual.getBoundingClientRect();
      const x = (event.clientX - r.left) / r.width - .5;
      const y = (event.clientY - r.top) / r.height - .5;
      object.style.animation = 'none';
      object.style.transform = `translateY(-5px) rotateY(${x * 10 - 7}deg) rotateX(${-y * 7 + 2}deg)`;
    });
    visual.addEventListener('pointerleave', () => {
      object.style.animation = '';
      object.style.transform = '';
    });
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhanceSitroHero, {once:true});
  else enhanceSitroHero();
}

// deployment refresh 2026-09-27
