import crypto from 'node:crypto';
import {maxApiRequest} from './_max-client.js';

const MAX_FILES = 10;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_MESSAGE_LENGTH = 8000;
// The OAuth app only receives access to its own Yandex Disk folder.
// This keeps customer models isolated from the rest of the owner's Disk.
const ORDER_ROOT = 'app:/Заявки';
const RATE_LIMIT_ROOT = `${ORDER_ROOT}/.system/rate-limits`;
const ALLOWED_EXTENSIONS = new Set(['stl', '3mf']);
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMITS = {prepare: 8, submit: 5};
const memoryRateLimits = new Map();

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

export function requestFingerprint(req, secret = '') {
  const forwarded = cleanText(req?.headers?.['x-forwarded-for'], 300).split(',')[0].trim();
  const address = forwarded || cleanText(req?.headers?.['x-real-ip'], 100) || cleanText(req?.socket?.remoteAddress, 100) || 'unknown';
  const agent = cleanText(req?.headers?.['user-agent'], 300);
  return crypto.createHash('sha256').update(`${secret}:${address}:${agent}`).digest('hex').slice(0, 32);
}

export function nextRateState(state, action, now = Date.now()) {
  const limit = RATE_LIMITS[action];
  if (!limit) throw new Error('Некорректное действие ограничения');
  const threshold = now - RATE_LIMIT_WINDOW_MS;
  const events = Array.isArray(state?.[action]) ? state[action].map(Number).filter(value => Number.isFinite(value) && value > threshold && value <= now) : [];
  if (events.length >= limit) {
    const error = new Error('Слишком много попыток. Подождите несколько минут и попробуйте снова.');
    error.statusCode = 429;
    error.retryAfter = Math.max(1, Math.ceil((events[0] + RATE_LIMIT_WINDOW_MS - now) / 1000));
    throw error;
  }
  return {...(state && typeof state === 'object' ? state : {}), [action]: [...events, now], updatedAt: new Date(now).toISOString()};
}

async function readJsonFile(path, token) {
  const {response, data} = await diskRequest('/resources/download', {token, query: {path}});
  if (response.status === 404) return null;
  if (!response.ok || !data.href) throw new Error('Не удалось проверить частоту отправки');
  const download = await fetch(data.href);
  if (!download.ok) throw new Error('Не удалось проверить частоту отправки');
  return download.json().catch(() => null);
}

async function writeJsonFile(path, value, token) {
  const {response, data} = await diskRequest('/resources/upload', {token, query: {path, overwrite: 'true'}});
  if (!response.ok || !data.href) throw new Error('Не удалось сохранить ограничение отправки');
  const upload = await fetch(data.href, {method: data.method || 'PUT', headers: {'Content-Type': 'application/json; charset=utf-8'}, body: JSON.stringify(value)});
  if (!upload.ok) throw new Error('Не удалось сохранить ограничение отправки');
}

async function enforceRateLimit(req, action, token) {
  const fingerprint = requestFingerprint(req, process.env.RATE_LIMIT_SECRET || token.slice(-24));
  const memoryKey = `${action}:${fingerprint}`;
  const memoryState = nextRateState({[action]: memoryRateLimits.get(memoryKey) || []}, action);
  memoryRateLimits.set(memoryKey, memoryState[action]);
  await ensureFolder(ORDER_ROOT, token);
  await ensureFolder(`${ORDER_ROOT}/.system`, token);
  await ensureFolder(RATE_LIMIT_ROOT, token);
  const path = `${RATE_LIMIT_ROOT}/${fingerprint}.json`;
  const state = nextRateState(await readJsonFile(path, token), action);
  await writeJsonFile(path, state, token);
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

async function saveOrderRecord(orderId, record, token) {
  const path = `${orderFolder(orderId)}/заявка.json`;
  const {response, data} = await diskRequest('/resources/upload', {
    token,
    query: {path, overwrite: 'true'}
  });
  if (!response.ok || !data.href) throw new Error('Не удалось сохранить данные заявки');
  const upload = await fetch(data.href, {
    method: data.method || 'PUT',
    headers: {'Content-Type': 'application/json; charset=utf-8'},
    body: JSON.stringify(record, null, 2)
  });
  if (!upload.ok) throw new Error('Не удалось сохранить данные заявки');
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
  if (!response.ok || !data.ok) {
    const reason = cleanText(data.description || `HTTP ${response.status}`, 180);
    throw new Error(`Не удалось передать заявку в Telegram: ${reason}`);
  }
}

async function sendMax(text, token, {chatId, userId} = {}) {
  const query = new URLSearchParams(chatId ? {chat_id: chatId} : {user_id: userId});
  const {ok, data} = await maxApiRequest(`/messages?${query}`, {
    token,
    method: 'POST',
    body: {
      text: text.slice(0, 4000),
      disable_link_preview: true
    }
  });
  if (!ok || !data.message) throw new Error('Не удалось передать заявку в MAX');
}

export async function sendOrderNotifications(record, env = process.env) {
  const attemptedAt = new Date().toISOString();
  const notificationText = telegramText(record);
  const notifications = {
    telegram: {configured: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID), sent: false, attemptedAt},
    max: {configured: Boolean(env.MAX_BOT_TOKEN && (env.MAX_CHAT_ID || env.MAX_USER_ID)), sent: false, attemptedAt}
  };
  if (notifications.telegram.configured) {
    try {
      await sendTelegram(notificationText, env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID);
      notifications.telegram.sent = true;
    } catch (error) {
      notifications.telegram.error = cleanText(error?.message || 'Ошибка Telegram', 300);
      console.error('Telegram order notification failed', {message: notifications.telegram.error});
    }
  }
  if (notifications.max.configured) {
    try {
      await sendMax(notificationText, env.MAX_BOT_TOKEN, {chatId: env.MAX_CHAT_ID, userId: env.MAX_USER_ID});
      notifications.max.sent = true;
    } catch (error) {
      notifications.max.error = cleanText(error?.message || 'Ошибка MAX', 300);
      console.error('MAX order notification failed', {message: notifications.max.error});
    }
  }
  return notifications;
}

function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const ready = Boolean(process.env.YANDEX_DISK_TOKEN);
    return json(res, 200, {ready});
  }
  if (req.method !== 'POST') return json(res, 405, {error: 'Метод не поддерживается'});
  const diskToken = process.env.YANDEX_DISK_TOKEN;
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;
  const maxToken = process.env.MAX_BOT_TOKEN;
  const maxChatId = process.env.MAX_CHAT_ID;
  const maxUserId = process.env.MAX_USER_ID;
  if (!diskToken) {
    return json(res, 503, {error: 'Прямая отправка ещё настраивается. Попробуйте немного позже.'});
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  if (cleanText(body.website, 200)) return json(res, 200, {ok: true});
  try {
    if (body.action === 'prepare') {
      await enforceRateLimit(req, 'prepare', diskToken);
      const files = validateFiles(body.files || []);
      const prepared = await prepareUploads(files, diskToken);
      return json(res, 200, {ok: true, ...prepared});
    }
    if (body.action !== 'submit') return json(res, 400, {error: 'Неизвестное действие'});
    await enforceRateLimit(req, 'submit', diskToken);

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
    const record = {
      orderId,
      createdAt: new Date().toISOString(),
      kind,
      customer,
      message,
      files,
      status: 'new',
      statusUpdatedAt: new Date().toISOString(),
      notifications: {
        telegram: {configured: Boolean(telegramToken && telegramChatId), sent: false},
        max: {configured: Boolean(maxToken && (maxChatId || maxUserId)), sent: false}
      }
    };
    await saveOrderRecord(orderId, record, diskToken);
    const notifications = await sendOrderNotifications(record, {TELEGRAM_BOT_TOKEN: telegramToken, TELEGRAM_CHAT_ID: telegramChatId, MAX_BOT_TOKEN: maxToken, MAX_CHAT_ID: maxChatId, MAX_USER_ID: maxUserId});
    try {
      await saveOrderRecord(orderId, {...record, notifications}, diskToken);
    } catch (error) {
      console.error('Order notification state save failed', {message: error?.message || 'Unknown error'});
    }
    const telegramNotified = notifications.telegram.sent;
    const maxNotified = notifications.max.sent;
    return json(res, 200, {
      ok: true,
      orderId,
      notified: telegramNotified || maxNotified,
      notifications: {telegram: telegramNotified, max: maxNotified}
    });
  } catch (error) {
    console.error('Order request failed', {message: error?.message || 'Unknown error'});
    if (error?.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
    return json(res, error?.statusCode || 400, {error: error?.message || 'Не удалось отправить заявку', retryAfter: error?.retryAfter || undefined});
  }
}
