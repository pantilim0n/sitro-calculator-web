export function normalizeCategoryList(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(value => String(value).trim()).filter(Boolean))];
}

export function categoriesOf(item) {
  if (Array.isArray(item?.categories)) return normalizeCategoryList(item.categories);
  return item?.category ? [String(item.category).trim()].filter(Boolean) : [];
}

export function setItemCategories(items, id, categories) {
  const item = items.find(entry => String(entry.id) === String(id));
  if (!item) return false;
  item.categories = normalizeCategoryList(categories);
  delete item.category;
  return true;
}

export function renameCategoryInItems(items, previousName, nextName) {
  const previous = String(previousName || '').trim();
  const next = String(nextName || '').trim();
  if (!previous || previous === next) return 0;
  let changed = 0;
  items.forEach(item => {
    const categories = categoriesOf(item);
    if (!categories.includes(previous)) return;
    item.categories = normalizeCategoryList(categories.map(category => category === previous ? next : category));
    delete item.category;
    changed += 1;
  });
  return changed;
}

export function removeCategoryFromItems(items, categoryName) {
  const category = String(categoryName || '').trim();
  if (!category) return 0;
  let changed = 0;
  items.forEach(item => {
    const categories = categoriesOf(item);
    if (!categories.includes(category)) return;
    item.categories = categories.filter(value => value !== category);
    delete item.category;
    changed += 1;
  });
  return changed;
}

export function filterPortfolioItems(items, {query = '', category = '', visibility = '', featuredOnly = false} = {}) {
  const needle = String(query).trim().toLowerCase();
  return items.filter(item => {
    const title = String(item.title || '').toLowerCase();
    const description = String(item.description || '').toLowerCase();
    const categories = categoriesOf(item);
    const searchableCategories = categories.some(value => value.toLowerCase().includes(needle));
    const matchesText = !needle || title.includes(needle) || description.includes(needle) || searchableCategories;
    const matchesCategory = !category || categories.includes(category);
    const matchesVisibility = !visibility || (visibility === 'visible' ? item.visible !== false : item.visible === false);
    return matchesText && matchesCategory && matchesVisibility && (!featuredOnly || item.featured);
  });
}

export function generateDescription(title, categories) {
  const name = String(title || 'изделие').trim() || 'изделие';
  const category = normalizeCategoryList(categories)[0] || '3D-печать';
  const variants = {
    'Технические': 'Функциональная деталь, изготовленная методом 3D-печати. Подходит для практического использования и задач, где важны точность и прочность.',
    'Фигурки': 'Детализированная фигурка, изготовленная методом 3D-печати. Подходит для коллекции, подарка или декоративного оформления.',
    'Сувениры': 'Оригинальное изделие, изготовленное методом 3D-печати. Подходит в качестве сувенира, подарка или небольшого памятного изделия.',
    'Для дома': 'Практичное изделие для дома, изготовленное методом 3D-печати. Помогает удобно решить повседневную задачу.',
    'Брендинг': 'Брендированное изделие, изготовленное методом 3D-печати. Подходит для оформления бизнеса, мероприятий и корпоративных подарков.',
    'Авто': 'Практичное изделие для автомобиля, изготовленное методом 3D-печати. Разработано для удобного использования в повседневной эксплуатации.'
  };
  const base = variants[category] || 'Изделие, изготовленное методом 3D-печати по индивидуальной модели.';
  return name + ' — ' + base.charAt(0).toLowerCase() + base.slice(1);
}
