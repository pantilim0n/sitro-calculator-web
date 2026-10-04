import http from 'node:http';
import {createReadStream, existsSync, statSync} from 'node:fs';
import {extname, join, normalize, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import adminOrders from './api/admin-orders.js';
import adminPortfolio from './api/admin-portfolio.js';
import makerworld from './api/makerworld.js';
import order from './api/order.js';
import {GET as testGet} from './api/test.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Math.max(1, Math.min(65535, Number(process.env.PORT) || 3000));
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const API_HANDLERS = new Map([
  ['/api/admin-orders', adminOrders],
  ['/api/admin-portfolio', adminPortfolio],
  ['/api/order', order]
]);
const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8', '.gif': 'image/gif', '.heic': 'image/heic',
  '.html': 'text/html; charset=utf-8', '.ico': 'image/x-icon', '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.webp': 'image/webp', '.xml': 'application/xml; charset=utf-8'
};

function setCommonHeaders(res, pathname) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', pathname.startsWith('/admin') || pathname.startsWith('/api/admin-') ? 'no-referrer' : 'strict-origin-when-cross-origin');
  if (pathname === '/admin.html') {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  } else if (pathname.startsWith('/api/admin-')) {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  }
}

function enhanceResponse(res) {
  res.status = status => { res.statusCode = status; return res; };
  res.json = value => {
    if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(value));
    return res;
  };
  return res;
}

async function readJsonBody(req) {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method || '')) return undefined;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error('Запрос слишком большой');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { const error = new Error('Некорректный JSON'); error.statusCode = 400; throw error; }
}

async function handleMakerWorld(req, res) {
  const protocol = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = req.headers.host || 'localhost';
  const request = new Request(`${protocol}://${host}${req.url}`, {method: req.method, headers: req.headers});
  const response = await makerworld.fetch(request);
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

function staticPath(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  const requested = decoded === '/' ? '/index.html' : decoded;
  const clean = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, '');
  const absolute = resolve(join(ROOT, clean));
  return absolute.startsWith(resolve(ROOT) + '/') ? absolute : null;
}

function serveStatic(req, res, pathname) {
  const path = staticPath(pathname);
  if (!path || !existsSync(path) || !statSync(path).isFile()) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('Страница не найдена');
  }
  const extension = extname(path).toLowerCase();
  res.setHeader('Content-Type', CONTENT_TYPES[extension] || 'application/octet-stream');
  const immutable = pathname.startsWith('/design-assets/') || pathname.startsWith('/portfolio/') || ['.jpg', '.jpeg', '.png', '.webp'].includes(extension);
  if (!res.hasHeader('Cache-Control')) res.setHeader('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate');
  if (req.method === 'HEAD') return res.end();
  createReadStream(path).on('error', () => { if (!res.headersSent) res.statusCode = 500; res.end(); }).pipe(res);
}

export function createServer() {
  return http.createServer(async (req, rawRes) => {
    const res = enhanceResponse(rawRes);
    let pathname = '/';
    try { pathname = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname; } catch {}
    setCommonHeaders(res, pathname);
    try {
      if (pathname === '/healthz') return res.status(200).json({ok: true});
      if (pathname === '/api/test') {
        if (req.method !== 'GET') return res.status(405).json({error: 'Метод не поддерживается'});
        const response = await testGet();
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        return res.end(Buffer.from(await response.arrayBuffer()));
      }
      if (pathname === '/api/makerworld') return await handleMakerWorld(req, res);
      const handler = API_HANDLERS.get(pathname);
      if (handler) {
        req.body = await readJsonBody(req);
        return await handler(req, res);
      }
      if (pathname.startsWith('/api/')) return res.status(404).json({error: 'Метод API не найден'});
      if (!['GET', 'HEAD'].includes(req.method || '')) return res.status(405).json({error: 'Метод не поддерживается'});
      return serveStatic(req, res, pathname);
    } catch (error) {
      console.error('Request failed', {path: pathname, message: error?.message || 'Unknown error'});
      if (!res.headersSent) return res.status(error?.statusCode || 500).json({error: error?.statusCode ? error.message : 'Ошибка сервера'});
      res.end();
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  createServer().listen(PORT, '0.0.0.0', () => console.log(`SITRO server listening on port ${PORT}`));
}
