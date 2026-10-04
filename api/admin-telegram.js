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

function ambiguousTokenVariants(token) {
  let variants = [{token, changes: []}];
  [...token].forEach((character, index) => {
    if (character !== 'l' && character !== 'I') return;
    variants = variants.flatMap(variant => [
      variant,
      {
        token: `${variant.token.slice(0, index)}${character === 'l' ? 'I' : 'l'}${variant.token.slice(index + 1)}`,
        changes: [...variant.changes, {index, value: character === 'l' ? 'I' : 'l'}]
      }
    ]);
  });
  return variants;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, {error: 'Метод не поддерживается'});
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return json(res, 503, {error: 'Telegram ещё не настроен', token: Boolean(token), chatId: Boolean(chatId)});
  try {
    let selected = null;
    let lastBot = null;
    for (const variant of ambiguousTokenVariants(token)) {
      const bot = await telegramRequest(variant.token, 'getMe');
      lastBot = bot;
      if (bot.data?.ok) {
        selected = {...variant, bot};
        break;
      }
    }
    if (!selected) return json(res, 502, {error: 'Telegram отклонил токен бота', status: lastBot?.status || null, description: lastBot?.data?.description || null});
    const chat = await telegramRequest(selected.token, 'getChat', {chat_id: chatId});
    if (!chat.data?.ok) return json(res, 502, {error: 'Telegram не нашёл чат получателя', status: chat.status, description: chat.data?.description || null});
    return json(res, 200, {
      ok: true,
      tokenChanges: selected.changes,
      bot: {id: selected.bot.data.result?.id || null, username: selected.bot.data.result?.username || null},
      chat: {id: chat.data.result?.id || null, type: chat.data.result?.type || null}
    });
  } catch (error) {
    console.error('Telegram setup check failed', {message: error?.message || 'Unknown error'});
    return json(res, 502, {error: 'Не удалось проверить Telegram'});
  }
}
