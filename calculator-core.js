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
