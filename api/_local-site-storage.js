import {mkdir, readFile, rename, writeFile} from 'node:fs/promises';
import {dirname, resolve, sep} from 'node:path';

const ROOT_FILES = new Set([
  'admin-password.json',
  'portfolio-categories.json',
  'portfolio.json',
  'pricing.json',
  'reviews.json',
  'services.json',
  'site-config.json',
  'socials.json'
]);

export function localSiteRoot(env = process.env) {
  return String(env.SITE_CONTENT_DIR || '').trim();
}

export function localSitePath(relativePath, env = process.env) {
  const configuredRoot = localSiteRoot(env);
  if (!configuredRoot) throw new Error('Локальное хранилище сайта не настроено');
  const root = resolve(configuredRoot);
  const relative = String(relativePath || '').replace(/^\/+/, '');
  const allowed = ROOT_FILES.has(relative) || relative.startsWith('portfolio/');
  if (!relative || !allowed || relative.includes('\0')) throw new Error('Некорректный путь данных сайта');
  const absolute = resolve(root, relative);
  if (absolute !== root && !absolute.startsWith(root + sep)) throw new Error('Некорректный путь данных сайта');
  return absolute;
}

export async function readLocalSiteFile(relativePath, env = process.env) {
  try { return await readFile(localSitePath(relativePath, env)); }
  catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
}

export async function readLocalSiteJson(relativePath, env = process.env) {
  const value = await readLocalSiteFile(relativePath, env);
  return value ? JSON.parse(value.toString('utf8')) : null;
}

export async function writeLocalSiteFile(relativePath, value, env = process.env) {
  const absolute = localSitePath(relativePath, env);
  await mkdir(dirname(absolute), {recursive: true});
  const temporary = `${absolute}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, value, {mode: 0o600});
  await rename(temporary, absolute);
}
