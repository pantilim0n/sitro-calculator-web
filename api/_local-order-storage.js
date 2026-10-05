import {createHmac, timingSafeEqual} from 'node:crypto';
import {mkdir, readFile, readdir, rename, stat, writeFile} from 'node:fs/promises';
import {dirname, resolve, sep} from 'node:path';

const ORDER_PREFIX = 'app:/Заявки/';
const ORDER_ID = /^\d{14}-[a-f0-9]{8}$/;

export function localOrderRoot(env = process.env) {
  return String(env.ORDER_STORAGE_DIR || '').trim();
}

function secret(env = process.env) {
  return String(env.RATE_LIMIT_SECRET || env.ADMIN_SESSION_SECRET || '');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function localPath(storagePath, env = process.env) {
  const root = resolve(localOrderRoot(env));
  const value = String(storagePath || '');
  if (!root || !value.startsWith(ORDER_PREFIX) || value.includes('\0')) throw new Error('Некорректный путь файла');
  const relative = value.slice(ORDER_PREFIX.length).split('/').filter(Boolean);
  if (!relative.length || relative.some(part => part === '.' || part === '..')) throw new Error('Некорректный путь файла');
  const absolute = resolve(root, ...relative);
  if (absolute !== root && !absolute.startsWith(root + sep)) throw new Error('Некорректный путь файла');
  return absolute;
}

function signature(path, expires, purpose, env = process.env) {
  const key = secret(env);
  if (key.length < 32) throw new Error('Не настроена подпись файлов заявок');
  return createHmac('sha256', key).update(`${purpose}\n${expires}\n${path}`).digest('base64url');
}

export function signedOrderUrl(route, path, purpose, lifetimeSeconds = 3600, env = process.env) {
  const expires = Math.floor(Date.now() / 1000) + lifetimeSeconds;
  const query = new URLSearchParams({path, expires: String(expires), signature: signature(path, expires, purpose, env)});
  return `${route}?${query}`;
}

export function verifySignedOrderRequest(url, purpose, env = process.env) {
  const path = String(url.searchParams.get('path') || '');
  const expires = Number(url.searchParams.get('expires'));
  const supplied = String(url.searchParams.get('signature') || '');
  if (!path || !Number.isInteger(expires) || expires < Math.floor(Date.now() / 1000) || !safeEqual(supplied, signature(path, expires, purpose, env))) {
    const error = new Error('Ссылка недействительна или устарела');
    error.statusCode = 403;
    throw error;
  }
  return {path, absolute: localPath(path, env)};
}

export async function ensureLocalDirectory(storagePath, env = process.env) {
  const absolute = localPath(`${String(storagePath).replace(/\/$/, '')}/.keep`, env);
  await mkdir(dirname(absolute), {recursive: true});
}

export async function readLocalJson(storagePath, env = process.env) {
  try { return JSON.parse(await readFile(localPath(storagePath, env), 'utf8')); }
  catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
}

export async function writeLocalJson(storagePath, value, env = process.env) {
  const absolute = localPath(storagePath, env);
  await mkdir(dirname(absolute), {recursive: true});
  const temporary = `${absolute}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2), {mode: 0o600});
  await rename(temporary, absolute);
}

export async function localFileInfo(storagePath, env = process.env) {
  const absolute = localPath(storagePath, env);
  const details = await stat(absolute);
  if (!details.isFile()) throw new Error('Файл заказа не найден');
  return {absolute, size: details.size, name: storagePath.split('/').pop()};
}

export async function listLocalOrders(env = process.env, maximum = 200) {
  const root = resolve(localOrderRoot(env));
  const records = [];
  let days = [];
  try { days = await readdir(root, {withFileTypes: true}); } catch (error) { if (error?.code === 'ENOENT') return []; throw error; }
  for (const day of days.filter(item => item.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(item.name)).sort((a, b) => b.name.localeCompare(a.name))) {
    const dayPath = resolve(root, day.name);
    const orders = await readdir(dayPath, {withFileTypes: true});
    for (const order of orders.filter(item => item.isDirectory() && ORDER_ID.test(item.name)).sort((a, b) => b.name.localeCompare(a.name))) {
      try {
        const record = JSON.parse(await readFile(resolve(dayPath, order.name, 'заявка.json'), 'utf8'));
        records.push(record);
      } catch (error) { if (error?.code !== 'ENOENT') console.error('Local order read failed', {orderId: order.name, message: error?.message}); }
      if (records.length >= maximum) return records;
    }
  }
  return records;
}
