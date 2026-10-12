import crypto from 'node:crypto';
import {mkdir, readdir, unlink, writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {maxApiRequest} from './_max-client.js';
import {localOrderRoot, localPath, readLocalJson, signedOrderUrl, writeLocalJson} from './_local-order-storage.js';
import {makeOrderId, orderFolder, saveOrderRecord, sendOrderNotifications} from './order.js';

const STATE_ROOT = 'app:/Заявки/.system/max-customer-bot';
const INBOX_ROOT = `${STATE_ROOT}/inbox`;
const MAX_ATTACHMENTS = 10;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const clean = (value, limit = 8000) => String(value ?? '').trim().slice(0, limit);

function equalSecret(received, expected) {
  const a = Buffer.from(String(received || ''));
  const b = Buffer.from(String(expected || ''));
  return Boolean(b.length) && a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function phoneFromText(value) {
  const match = String(value || '').match(/(?:\+7|8)[\s()\-]*\d{3}[\s()\-]*\d{3}[\s()\-]*\d{2}[\s()\-]*\d{2}/);
  return match ? match[0].replace(/[^+\d]/g, '') : '';
}

function userIdFrom(update) {
  const value = update?.message?.sender?.user_id ?? update?.user?.user_id;
  return /^\d+$/.test(String(value || '')) ? String(value) : '';
}

function statePath(userId) { return `${STATE_ROOT}/${userId}.json`; }

async function say(userId, text) {
  const {ok, data} = await maxApiRequest(`/messages?user_id=${userId}`, {
    token: process.env.MAX_CUSTOMER_BOT_TOKEN,
    method: 'POST',
    body: {text: text.slice(0, 4000), disable_link_preview: true}
  });
  if (!ok || !data.message) throw new Error('Не удалось ответить клиенту в MAX');
}

function incomingFiles(message) {
  return (Array.isArray(message?.body?.attachments) ? message.body.attachments : [])
    .filter(item => ['image', 'file'].includes(item?.type))
    .slice(0, MAX_ATTACHMENTS)
    .map((item, index) => ({
      type: item.type,
      name: clean(item?.payload?.filename || item?.payload?.file_name || `Вложение-${index + 1}${item.type === 'image' ? '.jpg' : ''}`, 180),
      url: clean(item?.payload?.url, 2000)
    }));
}

function trustedMediaUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (url.hostname === 'max.ru' || url.hostname.endsWith('.max.ru') || url.hostname === 'oneme.ru' || url.hostname.endsWith('.oneme.ru'));
  } catch { return false; }
}

async function keepFiles(orderId, attachments, req) {
  const files = [];
  for (const [index, item] of attachments.slice(0, MAX_ATTACHMENTS).entries()) {
    if (!trustedMediaUrl(item.url)) continue;
    try {
      const response = await fetch(item.url, {signal: AbortSignal.timeout(8000)});
      const declared = Number(response.headers.get('content-length') || 0);
      if (!response.ok || declared > MAX_FILE_BYTES) continue;
      const chunks = [];
      let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > MAX_FILE_BYTES) { await response.body.cancel().catch(() => {}); break; }
        chunks.push(chunk);
      }
      if (!size || size > MAX_FILE_BYTES) continue;
      const name = item.name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_') || `Вложение-${index + 1}`;
      const path = `${orderFolder(orderId)}/${index + 1}-${name}`;
      const absolute = localPath(path);
      await mkdir(dirname(absolute), {recursive: true});
      await writeFile(absolute, Buffer.concat(chunks), {mode: 0o600});
      const protocol = req.headers['x-forwarded-proto'] === 'http' ? 'http' : 'https';
      const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'ситро-3д.рф').split(',')[0].trim();
      files.push({name, size, url: `${protocol}://${host}${signedOrderUrl('/api/order-file', path, 'download', 90 * 24 * 60 * 60)}`});
    } catch (error) { console.error('MAX attachment save failed', {message: error?.message}); }
  }
  return files;
}

async function processUpdate(update, req) {
  if (update?.update_type === 'bot_added' && update.is_channel && /^-?\d+$/.test(String(update.chat_id))) {
    await writeLocalJson(`${STATE_ROOT}/channel.json`, {chatId: String(update.chat_id), addedAt: new Date().toISOString()});
    return;
  }
  if (!['bot_started', 'message_created'].includes(update?.update_type)) return;
  const userId = userIdFrom(update);
  if (!userId) return;
  const current = await readLocalJson(statePath(userId)) || {};
  if (update.update_type === 'bot_started') {
    await say(userId, 'Здравствуйте! Это СИТРО, 3D-печать в Липецке. Напишите, что нужно изготовить, и пришлите фото или STL/3MF при наличии. Затем укажите телефон для связи. Адрес: ул. Свиридова, 9. Сайт: ситро-3д.рф');
    return;
  }
  const message = update.message || {};
  if (message?.recipient?.chat_type && message.recipient.chat_type !== 'dialog') return;
  const mid = clean(message?.body?.mid, 100);
  if (mid && current.lastMid === mid) return;
  const text = clean(message?.body?.text);
  if (/^\/(start|cancel)(\s|$)/i.test(text)) {
    await writeLocalJson(statePath(userId), {lastMid: mid});
    await say(userId, 'Начнём заново. Опишите изделие или пришлите фото/модель, затем укажите телефон для связи.');
    return;
  }
  const phone = phoneFromText(text) || phoneFromText((message?.body?.attachments || []).find(item => item.type === 'contact')?.payload?.vcf_info);
  const description = clean(text.replace(phone ? /(?:\+7|8)[\s()\-]*\d{3}[\s()\-]*\d{3}[\s()\-]*\d{2}[\s()\-]*\d{2}/ : /$^/, '').trim());
  const attachments = [...(current.attachments || []), ...incomingFiles(message)].slice(0, MAX_ATTACHMENTS);
  const draft = {
    description: description || current.description || '',
    phone: phone || current.phone || '',
    attachments,
    lastMid: mid,
    updatedAt: new Date().toISOString()
  };
  await writeLocalJson(statePath(userId), draft);
  if (!draft.description && !draft.attachments.length) return say(userId, 'Расскажите, что нужно напечатать или смоделировать. Можно прислать фото или STL/3MF.');
  if (!draft.phone) return say(userId, 'Спасибо! Укажите номер телефона для связи, и мы получим вашу заявку.');
  const orderId = makeOrderId();
  const files = await keepFiles(orderId, draft.attachments, req);
  const now = new Date().toISOString();
  const record = {
    orderId, createdAt: now, kind: 'max',
    customer: {name: clean(message.sender?.name || `${message.sender?.first_name || ''} ${message.sender?.last_name || ''}`, 120), contact: draft.phone, comment: `Клиент MAX: ${userId}`},
    message: draft.description || 'Описание в приложенных файлах', files,
    status: 'new', statusUpdatedAt: now,
    notifications: {telegram: {configured: false, sent: false}, max: {configured: false, sent: false}}
  };
  await saveOrderRecord(orderId, record, process.env.YANDEX_DISK_TOKEN);
  await writeLocalJson(statePath(userId), {lastMid: mid, lastOrderId: orderId});
  const notifications = await sendOrderNotifications(record);
  await saveOrderRecord(orderId, {...record, notifications}, process.env.YANDEX_DISK_TOKEN);
  await say(userId, `Заявка №${orderId} получена. Мы свяжемся с вами, уточним стоимость и сроки. СИТРО: Липецк, ул. Свиридова, 9. Сайт: ситро-3д.рф`);
}

let draining = false;
let retryTimer;
export async function drainMaxCustomerInbox() {
  if (draining || !localOrderRoot() || !process.env.MAX_CUSTOMER_BOT_TOKEN) return;
  draining = true;
  try {
    const directory = localPath(INBOX_ROOT);
    await mkdir(directory, {recursive: true});
    for (const name of (await readdir(directory)).filter(value => /^\d{13}-[a-f0-9]{64}\.json$/.test(value)).sort()) {
      const path = `${INBOX_ROOT}/${name}`;
      const event = await readLocalJson(path);
      if (event?.update) await processUpdate(event.update, {headers: event.headers || {}});
      await unlink(localPath(path));
    }
  } catch (error) {
    console.error('MAX customer inbox failed', {message: error?.message});
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => { void drainMaxCustomerInbox(); }, 10000);
    retryTimer.unref?.();
  } finally { draining = false; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error: 'Метод не поддерживается'});
  if (!process.env.MAX_CUSTOMER_WEBHOOK_SECRET || !equalSecret(req.headers['x-max-bot-api-secret'], process.env.MAX_CUSTOMER_WEBHOOK_SECRET)) {
    return res.status(403).json({error: 'Доступ запрещён'});
  }
  if (!localOrderRoot() || !process.env.MAX_CUSTOMER_BOT_TOKEN) return res.status(503).json({error: 'Бот не настроен'});
  const update = req.body;
  if (!update || typeof update !== 'object' || !['bot_started', 'message_created', 'bot_added'].includes(update.update_type)) {
    return res.status(200).json({ok: true});
  }
  const key = crypto.createHash('sha256').update(req.rawBody || JSON.stringify(update)).digest('hex');
  const timestamp = String(Number(update.timestamp) || Date.now()).padStart(13, '0').slice(-13);
  await writeLocalJson(`${INBOX_ROOT}/${timestamp}-${key}.json`, {
    update,
    headers: {
      host: req.headers.host,
      'x-forwarded-host': req.headers['x-forwarded-host'],
      'x-forwarded-proto': req.headers['x-forwarded-proto']
    }
  });
  setImmediate(() => { void drainMaxCustomerInbox(); });
  return res.status(200).json({ok: true});
}
