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


export async function estimateStlVolumeCm3(file) {
  const buffer = await file.arrayBuffer();
  if (!buffer.byteLength) {
    throw stlError('STL_EMPTY', 'STL file is empty');
  }

  const view = new DataView(buffer);
  let volumeMm3 = 0;
  let triangleCount = 0;

  const isBinary = buffer.byteLength >= 84 && (84 + view.getUint32(80, true) * 50 === buffer.byteLength);
  if (isBinary) {
    const count = view.getUint32(80, true);
    if (!count) {
      throw stlError('STL_NO_TRIANGLES', 'Binary STL does not contain triangles');
    }
    triangleCount = count;
    let off = 84;
    for (let i = 0; i < count; i++, off += 50) {
      const ax=view.getFloat32(off+12,true), ay=view.getFloat32(off+16,true), az=view.getFloat32(off+20,true);
      const bx=view.getFloat32(off+24,true), by=view.getFloat32(off+28,true), bz=view.getFloat32(off+32,true);
      const cx=view.getFloat32(off+36,true), cy=view.getFloat32(off+40,true), cz=view.getFloat32(off+44,true);
      if (![ax,ay,az,bx,by,bz,cx,cy,cz].every(Number.isFinite)) {
        throw stlError('STL_INVALID', 'Binary STL contains invalid coordinates');
      }
      volumeMm3 += ax*(by*cz-bz*cy) - ay*(bx*cz-bz*cx) + az*(bx*cy-by*cx);
    }
    volumeMm3 = Math.abs(volumeMm3 / 6);
  } else {
    const text = new TextDecoder().decode(buffer);
    const number = '([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?)';
    const verts = [...text.matchAll(new RegExp('vertex\\s+'+number+'\\s+'+number+'\\s+'+number, 'ig'))]
      .map(m => [Number(m[1]),Number(m[2]),Number(m[3])]);
    if (verts.length < 3 || verts.length % 3 !== 0) {
      throw stlError('STL_NO_TRIANGLES', 'ASCII STL does not contain complete triangles');
    }
    triangleCount = verts.length / 3;
    for (let i=0;i+2<verts.length;i+=3) {
      const [ax,ay,az]=verts[i], [bx,by,bz]=verts[i+1], [cx,cy,cz]=verts[i+2];
      volumeMm3 += ax*(by*cz-bz*cy) - ay*(bx*cz-bz*cx) + az*(bx*cy-by*cx);
    }
    volumeMm3 = Math.abs(volumeMm3 / 6);
  }

  if (!triangleCount || !Number.isFinite(volumeMm3)) {
    throw stlError('STL_INVALID', 'STL geometry could not be read');
  }
  if (volumeMm3 <= 1e-6) {
    throw stlError('STL_ZERO_VOLUME', 'STL geometry has no enclosed volume');
  }
  return volumeMm3 / 1000;
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

export function estimateStlQuote({volumeCm3, quantity, density, materialPrice, minimumOrder, fillFactor=0.45}) {
  const qty = normalizeQuantity(quantity);
  const estimatedGrams = Math.max(0, Number(volumeCm3)||0) * Number(density||0) * fillFactor * qty;
  const raw = estimatedGrams * Number(materialPrice||0);
  return {quantity: qty, estimatedGrams, price: Math.max(Number(minimumOrder||0), raw)};
}
