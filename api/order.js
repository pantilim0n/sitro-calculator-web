import crypto from 'node:crypto';

const MAX_FILES = 10;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_MESSAGE_LENGTH = 8000;
const ORDER_ROOT = '/СИТРО/Заявки';
const ALLOWED_EXTENSIONS = new Set(['stl', '3mf']);

function cleanText(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function safeFileName(value) {
  const original = cleanText(value, 180).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_');
  const extension = original.split('.').pop()?.toLowerCase();
  if (!original || !ALLOWED_EXTENSIONS.has(extension)) throw new Error('Разрешены только файлы STL и 3MF');
  return original;
}

function dayStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function makeOrderId(now = new Date(), randomBytes = crypto.randomBytes) {
  const time = now.toISOString().replace(/\D/g, '').slice(0, 14);
  return `${time}-${randomBytes(4).toString('hex')}`;
}

export function validateFiles(files) {
  if (!Array.isArray(files) || files.length > MAX_FILES) throw new Error(`Можно отправить не более ${MAX_FILES} файлов`);
  const used = new Map();
  return files.map(file => {
    const original = safeFileName(file?.name);
    const dot = original.lastIndexOf('.');
    const base = original.slice(0, dot);
    const extension = original.slice(dot);
    const copy = used.get(original.toLowerCase()) || 0;
    used.set(original.toLowerCase(), copy + 1);
    const name = copy ? `${base}-${copy + 1}${extension}` : original;
    const size = Number(file?.size || 0);
    if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_BYTES) {
      throw new Error('Размер каждого файла должен быть от 1 байта до 50 МБ');
    }
    return {name, size};
  });
}

export function orderFolder(orderId) {
  if (!/^\d{14}-[a-f0-9]{8}$/.test(orderId)) throw new Error('Некорректный номер заявки');
  const stamp = `${orderId.slice(0, 4)}-${orderId.slice(4, 6)}-${orderId.slice(6, 8)}`;
  return `${ORDER_ROOT}/${stamp}/${orderId}`;
}

function diskHeaders(token) {
  return {Authorization: `OAuth ${token}`, Accept: 'application/json'};
}

async function diskRequest(path, {token, method = 'GET', query = {}} = {}) {
  const url = new URL(`https://cloud-api.yandex.net/v1/disk${path}`);
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, {method, headers: diskHeaders(token)});
  const data = await response.json().catch(() => ({}));
  return {response, data};
}

async function ensureFolder(path, token) {
  const {response, data} = await diskRequest('/resources', {token, method: 'PUT', query: {path}});
  if (response.ok || response.status === 409 && data.error === 'DiskPathPointsToExistentDirectoryError') return;
  throw new Error('Не удалось подготовить папку для заказа');
}

async function prepareUploads(files, token, now = new Date()) {
  const orderId = makeOrderId(now);
  const folder = orderFolder(orderId);
  await ensureFolder(ORDER_ROOT, token);
  await ensureFolder(`${ORDER_ROOT}/${dayStamp(now)}`, token);
  await ensureFolder(folder, token);
  const uploads = [];
  for (const file of files) {
    const path = `${folder}/${file.name}`;
    const {response, data} = await diskRequest('/resources/upload', {token, query: {path, overwrite: 'true'}});
    if (!response.ok || !data.href) throw new Error('Не удалось подготовить загрузку файла');
    uploads.push({name: file.name, path, href: data.href, method: data.method || 'PUT'});
  }
  return {orderId, uploads};
}

function validateStoredPaths(orderId, paths) {
  const folder = `${orderFolder(orderId)}/`;
  if (!Array.isArray(paths) || paths.length > MAX_FILES) throw new Error('Некорректный список файлов');
  return paths.map(path => {
    const value = cleanText(path, 500);
    if (!value.startsWith(folder) || value.includes('..')) throw new Error('Некорректный путь файла');
    return value;
  });
}

async function publishFiles(paths, token) {
  const links = [];
  for (const path of paths) {
    const published = await diskRequest('/resources/publish', {token, method: 'PUT', query: {path}});
    if (!published.response.ok && published.response.status !== 409) throw new Error('Не удалось открыть доступ к файлу заказа');
    const meta = await diskRequest('/resources', {token, query: {path, fields: 'name,size,public_url'}});
    if (!meta.response.ok || !meta.data.public_url) throw new Error('Не удалось получить ссылку на файл заказа');
    links.push({name: meta.data.name || path.split('/').pop(), size: Number(meta.data.size || 0), url: meta.data.public_url});
  }
  return links;
}

export function telegramText({orderId, kind, customer, message, files}) {
  const type = kind === 'stl' ? 'STL / 3MF' : 'MakerWorld';
  const fileLines = files.length
    ? files.map((file, index) => `${index + 1}. ${file.name}: ${file.url}`).join('\n')
    : 'Файлы: модель указана ссылкой MakerWorld';
  return [
    `Новая заявка СИТРО №${orderId}`,
    `Тип: ${type}`,
    `Имя: ${customer.name || 'не указано'}`,
    `Телефон: ${customer.contact}`,
    customer.comment ? `Комментарий: ${customer.comment}` : '',
    '',
    cleanText(message, MAX_MESSAGE_LENGTH),
    '',
    fileLines
  ].filter(line => line !== '').join('\n').slice(0, 4090);
}

async function sendTelegram(text, token, chatId) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({chat_id: chatId, text, disable_web_page_preview: true})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error('Не удалось передать заявку в Telegram');
}

function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const ready = Boolean(process.env.YANDEX_DISK_TOKEN && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
    return json(res, 200, {ready});
  }
  if (req.method !== 'POST') return json(res, 405, {error: 'Метод не поддерживается'});
  const diskToken = process.env.YANDEX_DISK_TOKEN;
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;
  if (!diskToken || !telegramToken || !telegramChatId) {
    return json(res, 503, {error: 'Прямая отправка ещё настраивается. Используйте Telegram или MAX.'});
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  if (cleanText(body.website, 200)) return json(res, 200, {ok: true});
  try {
    if (body.action === 'prepare') {
      const files = validateFiles(body.files || []);
      const prepared = await prepareUploads(files, diskToken);
      return json(res, 200, {ok: true, ...prepared});
    }
    if (body.action !== 'submit') return json(res, 400, {error: 'Неизвестное действие'});

    const orderId = cleanText(body.orderId, 40);
    const kind = body.kind === 'stl' ? 'stl' : 'maker';
    const customer = {
      name: cleanText(body.customer?.name, 120),
      contact: cleanText(body.customer?.contact, 160),
      comment: cleanText(body.customer?.comment, 1500)
    };
    const message = cleanText(body.message, MAX_MESSAGE_LENGTH);
    if (!customer.contact) throw new Error('Укажите телефон для обратной связи');
    if (!message) throw new Error('Сначала рассчитайте заказ');
    const paths = validateStoredPaths(orderId, body.paths || []);
    if (kind === 'stl' && !paths.length) throw new Error('Добавьте файл STL или 3MF');
    const files = await publishFiles(paths, diskToken);
    await sendTelegram(telegramText({orderId, kind, customer, message, files}), telegramToken, telegramChatId);
    return json(res, 200, {ok: true, orderId});
  } catch (error) {
    console.error('Order request failed', {message: error?.message || 'Unknown error'});
    return json(res, 400, {error: error?.message || 'Не удалось отправить заявку'});
  }
}
