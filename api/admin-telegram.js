import {verifyAdminSession} from './_admin-security.js';

function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  return res.end(JSON.stringify(payload));
}

async function telegramRequest(token, method, query = {}) {
  const url = new URL(`https://api.telegram.org/bot${token}/${method}`);
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  return {status: response.status, data};
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, {error: 'Метод не поддерживается'});
  if (!verifyAdminSession(req, process.env)) return json(res, 401, {error: 'Сессия завершена. Войдите в админку снова.'});
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return json(res, 503, {error: 'Telegram ещё не настроен', token: Boolean(token), chatId: Boolean(chatId)});
  try {
    const bot = await telegramRequest(token, 'getMe');
    if (!bot.data?.ok) return json(res, 502, {error: 'Telegram отклонил токен бота', status: bot.status, description: bot.data?.description || null});
    const chat = await telegramRequest(token, 'getChat', {chat_id: chatId});
    if (!chat.data?.ok) return json(res, 502, {error: 'Telegram не нашёл чат получателя', status: chat.status, description: chat.data?.description || null});
    return json(res, 200, {
      ok: true,
      bot: {id: bot.data.result?.id || null, username: bot.data.result?.username || null},
      chat: {id: chat.data.result?.id || null, type: chat.data.result?.type || null}
    });
  } catch (error) {
    console.error('Telegram setup check failed', {message: error?.message || 'Unknown error'});
    return json(res, 502, {error: 'Не удалось проверить Telegram'});
  }
}
