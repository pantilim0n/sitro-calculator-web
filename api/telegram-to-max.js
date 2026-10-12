import crypto from 'node:crypto';
import {maxApiRequest} from './_max-client.js';
import {localOrderRoot, readLocalJson, writeLocalJson} from './_local-order-storage.js';

const STATE_PATH = 'app:/Заявки/.system/telegram-max-state.json';
const CHANNEL_ID = '-80007982189962';

function authenticated(rawBody, signature, key) {
  if (!key || !signature || !/^[a-f0-9]{64}$/.test(String(signature))) return false;
  const decoded = Buffer.from(key, 'base64');
  if (decoded.length !== 32) return false;
  const expected = crypto.createHmac('sha256', decoded).update(rawBody || '').digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function telegramImage(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      ['telesco.pe', 'telegram.org', 'telegram-cdn.org'].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch { return false; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error: 'Метод не поддерживается'});
  if (!authenticated(req.rawBody, req.headers['x-sitro-relay-signature'], process.env.TELEGRAM_RELAY_KEY)) return res.status(403).json({error: 'Доступ запрещён'});
  if (!localOrderRoot() || !process.env.MAX_CUSTOMER_BOT_TOKEN) return res.status(503).json({error: 'Публикация не настроена'});
  const posts = Array.isArray(req.body?.posts) ? req.body.posts.slice(0, 30).sort((a, b) => Number(a.id) - Number(b.id)) : [];
  let lastId = Number((await readLocalJson(STATE_PATH))?.lastId || 46);
  let published = 0;
  for (const post of posts) {
    const id = Number(post?.id);
    if (!Number.isInteger(id) || id <= lastId || id > 100000000) continue;
    const text = String(post?.text || '').slice(0, 4000).trim();
    const photos = (Array.isArray(post?.photos) ? post.photos : []).slice(0, 10).filter(telegramImage);
    if (!text && !photos.length) continue;
    const body = {text, disable_link_preview: true};
    if (photos.length) body.attachments = photos.map(url => ({type: 'image', payload: {url}}));
    const {ok, data, status} = await maxApiRequest(`/messages?chat_id=${CHANNEL_ID}`, {token: process.env.MAX_CUSTOMER_BOT_TOKEN, method: 'POST', body});
    if (!ok || !data.message) {
      console.error('Telegram to MAX post failed', {telegramId: id, status, code: data?.code});
      return res.status(502).json({error: 'MAX не принял публикацию', telegramId: id, published});
    }
    lastId = id;
    published++;
    await writeLocalJson(STATE_PATH, {lastId, updatedAt: new Date().toISOString()});
  }
  return res.status(200).json({ok: true, lastId, published});
}
