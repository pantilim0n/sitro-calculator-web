import {verifyAdminSession} from './_admin-security.js';
import {maxApiRequest} from './_max-client.js';

function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  return res.end(JSON.stringify(payload));
}

function compactUpdate(update) {
  const message = update?.message || {};
  const sender = message?.sender || {};
  const recipient = message?.recipient || {};
  const user = update?.user || {};
  return {
    type: String(update?.update_type || ''),
    senderUserId: sender?.user_id || null,
    eventUserId: user?.user_id || null,
    chatId: recipient?.chat_id || update?.chat_id || null
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, {error: 'Метод не поддерживается'});
  if (!verifyAdminSession(req, process.env)) return json(res, 401, {error: 'Сессия завершена. Войдите в админку снова.'});
  const token = process.env.MAX_BOT_TOKEN;
  if (!token) return json(res, 503, {error: 'MAX ещё не настроен'});
  try {
    const {ok, status, data} = await maxApiRequest('/updates?limit=100&timeout=0', {token});
    if (!ok) return json(res, 502, {error: 'MAX не вернул события', status, code: data?.code || null});
    return json(res, 200, {ok: true, updates: (data?.updates || []).map(compactUpdate)});
  } catch (error) {
    console.error('MAX setup check failed', {message: error?.message || 'Unknown error'});
    return json(res, 502, {error: 'Не удалось проверить события MAX'});
  }
}
