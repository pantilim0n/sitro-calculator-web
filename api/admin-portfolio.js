import {createHash, randomBytes} from 'node:crypto';
export const MAX_IMAGE_BASE64_LENGTH = 2_800_000;
const MAX_ITEMS = 500;
const DEFAULT_DENSITIES = {PLA: 1.24, PETG: 1.27, ABS: 1.04, ASA: 1.07, PA: 1.14};

export function cleanPricing(value) {
  if (!value || typeof value !== 'object') throw new Error('Некорректные тарифы');
  const positive = (input, label) => {
    const number = Number(input);
    if (!Number.isFinite(number) || number <= 0 || number > 100000) throw new Error('Проверьте поле «' + label + '»');
    return Math.round(number * 100) / 100;
  };
  const source = value.materials && typeof value.materials === 'object' ? value.materials : {};
  const materials = {};
  for (const [rawCode, rawMaterial] of Object.entries(source)) {
    const code = String(rawCode).trim().toUpperCase().replace(/[^A-ZА-ЯЁ0-9_-]/g, '').slice(0, 12);
    if (!code || materials[code]) continue;
    const material = rawMaterial && typeof rawMaterial === 'object' ? rawMaterial : {};
    materials[code] = {density: positive(material.density ?? DEFAULT_DENSITIES[code] ?? 1, code + ', плотность'), price: positive(material.price, code + ', ₽/г')};
  }
  if (!Object.keys(materials).length) throw new Error('Добавьте хотя бы один материал');
  return {minimumOrder: positive(value.minimumOrder, 'Минимальный заказ'), machineHour: positive(value.machineHour, 'Работа принтера'), materials};
}

export function cleanServices(values) {
  if (!Array.isArray(values) || values.length > 30) throw new Error('Некорректный список услуг');
  return values.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error('Некорректная услуга в строке ' + (index + 1));
    const title = String(item.title || '').trim().slice(0, 120);
    const short = String(item.short || '').trim().slice(0, 300);
    const description = String(item.description || '').trim().slice(0, 2000);
    if (!title || !short || !description) throw new Error('Заполните название и описание услуги в строке ' + (index + 1));
    return {id: String(item.id || ('service-' + Date.now() + '-' + index)).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 60), title, short, description, visible: item.visible !== false, sort: Number.isFinite(Number(item.sort)) ? Number(item.sort) : index + 1};
  });
}

function cleanSocials(value) {
  if (!value || typeof value !== 'object') throw new Error('Некорректные соцсети');
  const text = (input, max=200) => String(input || '').trim().slice(0, max);
  const allowedTypes = new Set(['max', 'telegram', 'whatsapp', 'phone', 'email', 'vk', 'map', 'web', 'custom']);
  const allowedGroups = new Set(['contact', 'follow']);
  const safeUrl = input => { const value = text(input, 500); if (!value) return ''; try { const parsed = new URL(value); if (!['http:', 'https:', 'tel:', 'mailto:'].includes(parsed.protocol)) throw new Error(); return value; } catch { throw new Error('Проверьте ссылку соцсети'); } };
  if (Array.isArray(value.items)) {
    const items = value.items.slice(0, 30).map((item, index) => {
      if (!item || typeof item !== 'object') throw new Error('Некорректная соцсеть');
      const type = allowedTypes.has(item.type) ? item.type : 'custom';
      const group = allowedGroups.has(item.group) ? item.group : 'contact';
      const label = text(item.label, 100); if (!label) throw new Error('Укажите название соцсети');
      const colorRaw=text(item.color, 20); const color=/^#[0-9a-fA-F]{6}$/.test(colorRaw)?colorRaw:''; return {id: text(item.id, 80) || `${type}-${index+1}`, type, label, url: safeUrl(item.url), group, color, enabled: item.enabled !== false};
    });
    return {items};
  }
  const legacy = value;
  const items = [];
  if (legacy.telegram) items.push({id:'telegram',type:'telegram',label:text(legacy.telegram,80),url:safeUrl(`https://t.me/${text(legacy.telegram,80).replace(/^@/,'')}`),group:'contact',color:'#229ED9',enabled:true});
  if (legacy.email) items.push({id:'email',type:'email',label:text(legacy.email,200),url:safeUrl(`mailto:${text(legacy.email,200)}`),group:'contact',color:'#EA4335',enabled:true});
  if (legacy.telegramChannel) items.push({id:'telegram-channel',type:'telegram',label:'Telegram-канал',url:safeUrl(legacy.telegramChannel),group:'follow',color:'#229ED9',enabled:true});
  if (legacy.vk) items.push({id:'vk',type:'vk',label:'Группа VK',url:safeUrl(legacy.vk),group:'follow',color:'#0077FF',enabled:true});
  return {items};
}

function safeContactUrl(input, label, protocols) {
  const value = String(input || '').trim().slice(0, 800);
  if (!value) throw new Error('Заполните поле «' + label + '»');
  try {
    const parsed = new URL(value);
    if (!protocols.includes(parsed.protocol)) throw new Error();
    return value;
  } catch {
    throw new Error('Проверьте поле «' + label + '»');
  }
}

export function cleanSiteConfig(value) {
  if (!value || typeof value !== 'object') throw new Error('Некорректные контакты сайта');
  const required = (input, label, max = 300) => {
    const result = String(input || '').trim().slice(0, max);
    if (!result) throw new Error('Заполните поле «' + label + '»');
    return result;
  };
  return {
    phoneLabel: required(value.phoneLabel, 'Телефон', 80),
    phoneUrl: safeContactUrl(value.phoneUrl, 'Ссылка телефона', ['tel:']),
    address: required(value.address, 'Адрес', 300),
    addressNote: String(value.addressNote || '').trim().slice(0, 500),
    routeUrl: safeContactUrl(value.routeUrl, 'Проложить маршрут', ['http:', 'https:']),
    city: required(value.city, 'Город', 100),
    region: required(value.region, 'Регион', 150)
  };
}

export function cleanReviews(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.items) || value.items.length > 30) throw new Error('Некорректные отзывы');
  return {items: value.items.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error('Некорректный отзыв в строке ' + (index + 1));
    const name = String(item.name || '').trim().slice(0, 120);
    const text = String(item.text || '').trim().slice(0, 1500);
    if ((!name || !text) && item.visible !== false) throw new Error('Заполните имя и текст отзыва в строке ' + (index + 1));
    const photo = String(item.photo || '').trim().slice(0, 800);
    if (photo && !photo.startsWith('/portfolio/') && !/^https:\/\//i.test(photo)) throw new Error('Проверьте фото отзыва в строке ' + (index + 1));
    return {
      id: String(item.id || ('review-' + Date.now() + '-' + index)).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80),
      name,
      meta: String(item.meta || '').trim().slice(0, 200),
      text,
      photo,
      sort: Number.isFinite(Number(item.sort)) ? Number(item.sort) : index + 1,
      visible: item.visible !== false
    };
  })};
}
function cleanCategories(values) {
  if (!Array.isArray(values)) throw new Error('Некорректный список категорий');
  return [...new Set(values.map(value => String(value).trim()).filter(Boolean))];
}

function cleanItems(values) {
  if (!Array.isArray(values) || values.length > MAX_ITEMS) throw new Error('Некорректные данные портфолио');
  return values.map((item, index) => {
    if (!item || typeof item !== 'object' || !item.src) throw new Error('Некорректная работа в строке ' + (index + 1));
    return {
      id: String(item.id || ('w' + Date.now() + index)),
      src: String(item.src),
      title: String(item.title || '').slice(0, 200),
      description: String(item.description || '').slice(0, 1000),
      categories: cleanCategories(Array.isArray(item.categories) ? item.categories : (item.category ? [item.category] : [])),
      featured: Boolean(item.featured),
      visible: item.visible !== false,
      sort: Number.isFinite(Number(item.sort)) ? Number(item.sort) : index + 1
    };
  });
}

function textToBase64(value) {
  return Buffer.from(JSON.stringify(value, null, 2), 'utf8').toString('base64');
}

function safeImagePath(filename) {
  const safeName = String(filename || 'portfolio.webp').replace(/[^a-zA-Z0-9._-]/g, '-');
  return 'portfolio/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '-' + safeName;
}

function assertImage(filename, dataBase64) {
  if (!filename || !dataBase64) throw new Error('Нет файла');
  if (typeof dataBase64 !== 'string' || dataBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    const error = new Error('Подготовленное изображение превышает безопасный лимит загрузки. Обрежьте фото и попробуйте снова.');
    error.statusCode = 413;
    throw error;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error: 'Метод не поддерживается'});

  const token = process.env.GITHUB_TOKEN;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const repository = process.env.GITHUB_REPO || 'pantilim0n/sitro-calculator-web';
  const branch = process.env.GITHUB_BRANCH || 'main';
  const parts = repository.split('/');
  if (!token || !adminPassword) return res.status(503).json({error: 'Админка ещё не настроена: добавьте GITHUB_TOKEN и ADMIN_PASSWORD в Vercel.'});
  if (parts.length !== 2 || parts.some(part => !part)) return res.status(503).json({error: 'GITHUB_REPO настроен неверно.'});
  if (/[^\x20-\x7E]/.test(token)) return res.status(503).json({error: 'GITHUB_TOKEN в Vercel заполнен неверно: токен должен состоять только из латинских символов и цифр.'});

  const [owner, name] = parts;
  const repoApi = 'https://api.github.com/repos/' + owner + '/' + name;
  const headers = {'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json'};

  const body = req.body || {};
  if (!(await passwordMatches(body.password))) return res.status(401).json({error: 'Неверный пароль'});
  if (body.action === 'auth') return res.status(200).json({ok: true});

  async function github(path, options = {}) {
    const response = await fetch(repoApi + path, {...options, headers: {...headers, ...(options.headers || {})}});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error('GitHub: ' + response.status + (data.message ? ' ' + data.message : ''));
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function getHead() {
    const ref = await github('/git/ref/heads/' + branch.split('/').map(encodeURIComponent).join('/'));
    return ref.object.sha;
  }

  async function readJsonAt(path, headSha) {
    const file = await github('/contents/' + path.split('/').map(encodeURIComponent).join('/') + '?ref=' + encodeURIComponent(headSha));
    const content = Buffer.from(String(file.content || '').replace(/\s/g, ''), 'base64').toString('utf8');
    return JSON.parse(content);
  }

  async function readPasswordConfig(headSha) {
    try { return await readJsonAt('admin-password.json', headSha); } catch (error) { if (error.status === 404) return null; throw error; }
  }

  function passwordHash(password, salt) { return createHash('sha256').update(String(salt) + ':' + String(password)).digest('hex'); }

  async function passwordMatches(password) {
    if (typeof password !== 'string' || !password) return false;
    if (password === adminPassword) return true;
    const config = await readPasswordConfig(await getHead());
    return Boolean(config?.hash && config?.salt) && passwordHash(password, config.salt) === config.hash;
  }

  async function commitAtHead(files, message, headSha) {
    const parent = await github('/git/commits/' + encodeURIComponent(headSha));
    const blobs = await Promise.all(files.map(file => github('/git/blobs', {method: 'POST', body: JSON.stringify({content: file.content, encoding: 'base64'})})));
    const tree = await github('/git/trees', {method: 'POST', body: JSON.stringify({base_tree: parent.tree.sha, tree: files.map((file, index) => ({path: file.path, mode: '100644', type: 'blob', sha: blobs[index].sha}))})});
    const commit = await github('/git/commits', {method: 'POST', body: JSON.stringify({message, tree: tree.sha, parents: [headSha]})});
    await github('/git/refs/heads/' + branch.split('/').map(encodeURIComponent).join('/'), {method: 'PATCH', body: JSON.stringify({sha: commit.sha, force: false})});
    return commit.sha;
  }

  async function commitFiles(files, message) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await commitAtHead(files, message, await getHead());
      } catch (error) {
        lastError = error;
        if (error.status !== 409 && error.status !== 422) throw error;
        await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
    throw lastError || new Error('GitHub: конфликт сохранения');
  }

  try {
    if (body.action === 'saveAll') {
      const items = cleanItems(body.items);
      const categories = cleanCategories(body.categories);
      const sha = await commitFiles([
        {path: 'portfolio.json', content: textToBase64(items)},
        {path: 'portfolio-categories.json', content: textToBase64(categories)}
      ], 'Update portfolio and categories from admin');
      return res.status(200).json({ok: true, sha});
    }
    if (body.action === 'save') {
      const sha = await commitFiles([{path: 'portfolio.json', content: textToBase64(cleanItems(body.items))}], 'Update portfolio from admin');
      return res.status(200).json({ok: true, sha});
    }
    if (body.action === 'saveCategories') {
      const sha = await commitFiles([{path: 'portfolio-categories.json', content: textToBase64(cleanCategories(body.categories))}], 'Update portfolio categories from admin');
      return res.status(200).json({ok: true, sha});
    }
    if (body.action === 'savePricing') {
      const sha = await commitFiles([{path: 'pricing.json', content: textToBase64(cleanPricing(body.pricing))}], 'Update calculator pricing from admin');
      return res.status(200).json({ok: true, sha});
    }
    if (body.action === 'saveServices') {
      const sha = await commitFiles([{path: 'services.json', content: textToBase64(cleanServices(body.services))}], 'Update services from admin');
      return res.status(200).json({ok: true, sha});
    }
    if (body.action === 'saveSocials') {
      const sha = await commitFiles([{path: 'socials.json', content: textToBase64(cleanSocials(body.socials))}], 'Update social links from admin');
      return res.status(200).json({ok: true, sha});
    }
    if (body.action === 'saveSiteContent') {
      const sha = await commitFiles([
        {path: 'site-config.json', content: textToBase64(cleanSiteConfig(body.siteConfig))},
        {path: 'reviews.json', content: textToBase64(cleanReviews(body.reviews))}
      ], 'Update site contacts and reviews from admin');
      return res.status(200).json({ok: true, sha});
    }
    if (body.action === 'changePassword') {
      const nextPassword = String(body.newPassword || '');
      if (nextPassword.length < 8 || nextPassword.length > 200) return res.status(400).json({error: 'Новый пароль должен содержать от 8 до 200 символов.'});
      const salt = randomBytes(16).toString('hex');
      const config = {version: 1, salt, hash: passwordHash(nextPassword, salt), updatedAt: new Date().toISOString()};
      const sha = await commitFiles([{path: 'admin-password.json', content: textToBase64(config)}], 'Update admin password');
      return res.status(200).json({ok: true, sha});
    }
    if (body.action === 'resetPassword') {
      const config = {version: 1, resetToEnvironment: true, updatedAt: new Date().toISOString()};
      const sha = await commitFiles([{path: 'admin-password.json', content: textToBase64(config)}], 'Reset admin password to environment setting');
      return res.status(200).json({ok: true, sha, reset: true});
    }
    if (body.action === 'uploadOnly') {
      assertImage(body.filename, body.dataBase64);
      const src = safeImagePath(body.filename);
      const sha = await commitFiles([{path: src, content: body.dataBase64}], 'Replace portfolio image');
      return res.status(200).json({ok: true, src, sha});
    }
    if (body.action === 'upload') {
      assertImage(body.filename, body.dataBase64);
      const src = safeImagePath(body.filename);
      let lastError;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const headSha = await getHead();
          const currentItems = cleanItems(await readJsonAt('portfolio.json', headSha));
          const item = {id: 'w' + Date.now() + Math.random().toString(36).slice(2, 6), src, title: String(body.title || '').trim().slice(0, 200) || '3D-печать СИТРО', description: String(body.description || '').trim().slice(0, 1000), categories: cleanCategories(Array.isArray(body.categories) && body.categories.length ? body.categories : ['Прочее']), featured: false, visible: true, sort: currentItems.length + 1};
          currentItems.push(item);
          const sha = await commitAtHead([
            {path: src, content: body.dataBase64},
            {path: 'portfolio.json', content: textToBase64(currentItems)}
          ], 'Add portfolio item', headSha);
          return res.status(200).json({ok: true, src, sha, item});
        } catch (error) {
          lastError = error;
          if (error.status !== 409 && error.status !== 422) throw error;
          await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
        }
      }
      throw lastError || new Error('GitHub: конфликт загрузки');
    }
    return res.status(400).json({error: 'Неизвестное действие'});
  } catch (error) {
    const message = error?.message || 'Ошибка сохранения';
    const status = error?.statusCode || (message.startsWith('Некоррект') || message === 'Нет файла' ? 400 : 500);
    return res.status(status).json({error: message});
  }
}
