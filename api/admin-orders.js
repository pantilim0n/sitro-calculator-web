import {createHash} from 'node:crypto';
import {orderFolder, sendOrderNotifications} from './order.js';

const ORDER_ROOT = 'app:/Заявки';
const ORDER_ID = /^\d{14}-[a-f0-9]{8}$/;
export const ORDER_STATUSES = new Set(['new', 'contacted', 'in_progress', 'ready', 'cancelled']);

function cleanText(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

export function cleanOrderStatus(value) {
  const status = cleanText(value, 30);
  if (!ORDER_STATUSES.has(status)) throw new Error('Некорректный статус заявки');
  return status;
}

export function orderRecordPath(orderId) {
  if (!ORDER_ID.test(orderId)) throw new Error('Некорректный номер заявки');
  return `${orderFolder(orderId)}/заявка.json`;
}

export function normalizeOrderRecord(value) {
  if (!value || typeof value !== 'object' || !ORDER_ID.test(String(value.orderId || ''))) throw new Error('Некорректная запись заявки');
  const safeUrl = input => {
    const url = cleanText(input, 1000);
    if (!url) return '';
    try { return new URL(url).protocol === 'https:' ? url : ''; } catch { return ''; }
  };
  return {
    orderId: String(value.orderId),
    createdAt: cleanText(value.createdAt, 60),
    kind: value.kind === 'stl' ? 'stl' : 'maker',
    customer: {
      name: cleanText(value.customer?.name, 120),
      contact: cleanText(value.customer?.contact, 160),
      comment: cleanText(value.customer?.comment, 1500)
    },
    message: cleanText(value.message, 8000),
    files: Array.isArray(value.files) ? value.files.slice(0, 10).map(file => ({name: cleanText(file?.name, 180), size: Number(file?.size || 0), url: safeUrl(file?.url)})).filter(file => file.name) : [],
    status: ORDER_STATUSES.has(value.status) ? value.status : 'new',
    statusUpdatedAt: cleanText(value.statusUpdatedAt, 60),
    notifications: value.notifications && typeof value.notifications === 'object' ? value.notifications : {}
  };
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

async function listFolder(path, token, limit = 200) {
  const items = [];
  for (let offset = 0; items.length < limit; offset += 100) {
    const {response, data} = await diskRequest('/resources', {token, query: {path, limit: Math.min(100, limit - items.length), offset, sort: '-name'}});
    if (response.status === 404) return [];
    if (!response.ok) throw new Error('Не удалось прочитать папку заявок на Яндекс Диске');
    const page = Array.isArray(data?._embedded?.items) ? data._embedded.items : [];
    items.push(...page);
    if (page.length < 100) break;
  }
  return items;
}

async function readOrder(orderId, token) {
  const path = orderRecordPath(orderId);
  const {response, data} = await diskRequest('/resources/download', {token, query: {path}});
  if (!response.ok || !data.href) throw new Error('Не удалось открыть заявку');
  const download = await fetch(data.href);
  if (!download.ok) throw new Error('Не удалось прочитать заявку');
  return normalizeOrderRecord(await download.json());
}

async function saveOrder(record, token) {
  const clean = normalizeOrderRecord(record);
  const {response, data} = await diskRequest('/resources/upload', {token, query: {path: orderRecordPath(clean.orderId), overwrite: 'true'}});
  if (!response.ok || !data.href) throw new Error('Не удалось сохранить заявку');
  const upload = await fetch(data.href, {method: data.method || 'PUT', headers: {'Content-Type': 'application/json; charset=utf-8'}, body: JSON.stringify(clean, null, 2)});
  if (!upload.ok) throw new Error('Не удалось сохранить заявку');
  return clean;
}

async function listOrders(token, maximum = 200) {
  const days = (await listFolder(ORDER_ROOT, token, 120)).filter(item => item.type === 'dir' && /^\d{4}-\d{2}-\d{2}$/.test(item.name)).sort((a, b) => b.name.localeCompare(a.name));
  const ids = [];
  for (const day of days) {
    const folders = await listFolder(day.path || `${ORDER_ROOT}/${day.name}`, token, maximum - ids.length);
    ids.push(...folders.filter(item => item.type === 'dir' && ORDER_ID.test(item.name)).map(item => item.name));
    if (ids.length >= maximum) break;
  }
  const orders = [];
  for (let index = 0; index < ids.length; index += 8) {
    const batch = await Promise.allSettled(ids.slice(index, index + 8).map(id => readOrder(id, token)));
    batch.forEach(result => { if (result.status === 'fulfilled') orders.push(result.value); });
  }
  return orders.sort((a, b) => String(b.createdAt || b.orderId).localeCompare(String(a.createdAt || a.orderId)));
}

async function adminPasswordMatches(password, env) {
  if (typeof password !== 'string' || !password) return false;
  if (password === env.ADMIN_PASSWORD) return true;
  const token = env.GITHUB_TOKEN;
  if (!token) return false;
  const repository = env.GITHUB_REPO || 'pantilim0n/sitro-calculator-web';
  const branch = env.GITHUB_BRANCH || 'main';
  const [owner, name] = repository.split('/');
  if (!owner || !name) return false;
  const headers = {Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'};
  const base = `https://api.github.com/repos/${owner}/${name}`;
  const ref = await fetch(`${base}/git/ref/heads/${branch.split('/').map(encodeURIComponent).join('/')}`, {headers});
  if (!ref.ok) return false;
  const head = await ref.json();
  const file = await fetch(`${base}/contents/admin-password.json?ref=${encodeURIComponent(head.object.sha)}`, {headers});
  if (!file.ok) return false;
  const config = JSON.parse(Buffer.from(String((await file.json()).content || '').replace(/\s/g, ''), 'base64').toString('utf8'));
  if (!config?.hash || !config?.salt) return false;
  const hash = createHash('sha256').update(`${config.salt}:${password}`).digest('hex');
  return hash === config.hash;
}

function json(res, status, payload) {
  return res.status(status).json(payload);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, {error: 'Метод не поддерживается'});
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  try {
    if (!(await adminPasswordMatches(body.password, process.env))) return json(res, 401, {error: 'Неверный пароль'});
    const token = process.env.YANDEX_DISK_TOKEN;
    if (!token) return json(res, 503, {error: 'Хранилище заявок ещё не настроено'});
    if (body.action === 'list') {
      const orders = await listOrders(token, Math.min(200, Math.max(1, Number(body.limit) || 100)));
      return json(res, 200, {ok: true, orders});
    }
    const orderId = cleanText(body.orderId, 40);
    if (!ORDER_ID.test(orderId)) return json(res, 400, {error: 'Некорректный номер заявки'});
    if (body.action === 'status') {
      const record = await readOrder(orderId, token);
      record.status = cleanOrderStatus(body.status);
      record.statusUpdatedAt = new Date().toISOString();
      return json(res, 200, {ok: true, order: await saveOrder(record, token)});
    }
    if (body.action === 'retry') {
      const record = await readOrder(orderId, token);
      const retryEnvironment = {...process.env};
      if (record.notifications?.telegram?.sent) {
        delete retryEnvironment.TELEGRAM_BOT_TOKEN;
        delete retryEnvironment.TELEGRAM_CHAT_ID;
      }
      if (record.notifications?.max?.sent) {
        delete retryEnvironment.MAX_BOT_TOKEN;
        delete retryEnvironment.MAX_USER_ID;
      }
      const retried = await sendOrderNotifications(record, retryEnvironment);
      record.notifications = {
        telegram: record.notifications?.telegram?.sent ? record.notifications.telegram : retried.telegram,
        max: record.notifications?.max?.sent ? record.notifications.max : retried.max
      };
      record.notificationRetriedAt = new Date().toISOString();
      return json(res, 200, {ok: true, order: await saveOrder(record, token)});
    }
    return json(res, 400, {error: 'Неизвестное действие'});
  } catch (error) {
    console.error('Admin orders request failed', {message: error?.message || 'Unknown error'});
    return json(res, 500, {error: error?.message || 'Не удалось обработать заявки'});
  }
}
