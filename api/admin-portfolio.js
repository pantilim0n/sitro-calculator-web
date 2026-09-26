export const MAX_IMAGE_BASE64_LENGTH = 2_800_000;
const MAX_ITEMS = 500;

function cleanCategories(values) {
  if (!Array.isArray(values)) throw new Error('Некорректный список категорий');
  return [...new Set(values.map(value => String(value).trim()).filter(Boolean))];
}

function cleanItems(values) {
  if (!Array.isArray(values) || values.length > MAX_ITEMS) throw new Error('Некорректные данные портфолио');
  return values.map((item, index) => {
    if (!item || typeof item !== 'object' || !item.src) throw new Error('Некорректная работа в строке ' + (index + 1));
    return {
      id: String(item.id || ('w' + Date.now() + index)),
      src: String(item.src),
      title: String(item.title || '').slice(0, 200),
      description: String(item.description || '').slice(0, 1000),
      categories: cleanCategories(Array.isArray(item.categories) ? item.categories : (item.category ? [item.category] : [])),
      featured: Boolean(item.featured),
      visible: item.visible !== false,
      sort: Number.isFinite(Number(item.sort)) ? Number(item.sort) : index + 1
    };
  });
}

function textToBase64(value) {
  return Buffer.from(JSON.stringify(value, null, 2), 'utf8').toString('base64');
}

function safeImagePath(filename) {
  const safeName = String(filename || 'portfolio.webp').replace(/[^a-zA-Z0-9._-]/g, '-');
  return 'portfolio/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '-' + safeName;
}

function assertImage(filename, dataBase64) {
  if (!filename || !dataBase64) throw new Error('Нет файла');
  if (typeof dataBase64 !== 'string' || dataBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    const error = new Error('Подготовленное изображение превышает безопасный лимит загрузки. Обрежьте фото и попробуйте снова.');
    error.statusCode = 413;
    throw error;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error: 'Метод не поддерживается'});

  const token = process.env.GITHUB_TOKEN;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const repository = process.env.GITHUB_REPO || 'pantilim0n/sitro-calculator-web';
  const branch = process.env.GITHUB_BRANCH || 'main';
  const parts = repository.split('/');
  if (!token || !adminPassword) return res.status(503).json({error: 'Админка ещё не настроена: добавьте GITHUB_TOKEN и ADMIN_PASSWORD в Vercel.'});
  if (parts.length !== 2 || parts.some(part => !part)) return res.status(503).json({error: 'GITHUB_REPO настроен неверно.'});
  if (/[^\x20-\x7E]/.test(token)) return res.status(503).json({error: 'GITHUB_TOKEN в Vercel заполнен неверно: токен должен состоять только из латинских символов и цифр.'});

  const body = req.body || {};
  if (body.password !== adminPassword) return res.status(401).json({error: 'Неверный пароль'});
  if (body.action === 'auth') return res.status(200).json({ok: true});

  const [owner, name] = parts;
  const repoApi = 'https://api.github.com/repos/' + owner + '/' + name;
  const headers = {'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json'};

  async function github(path, options = {}) {
    const response = await fetch(repoApi + path, {...options, headers: {...headers, ...(options.headers || {})}});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error('GitHub: ' + response.status + (data.message ? ' ' + data.message : ''));
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function getHead() {
    const ref = await github('/git/ref/heads/' + branch.split('/').map(encodeURIComponent).join('/'));
    return ref.object.sha;
  }

  async function readJsonAt(path, headSha) {
    const file = await github('/contents/' + path.split('/').map(encodeURIComponent).join('/') + '?ref=' + encodeURIComponent(headSha));
    const content = Buffer.from(String(file.content || '').replace(/\s/g, ''), 'base64').toString('utf8');
    return JSON.parse(content);
  }

  async function commitAtHead(files, message, headSha) {
    const parent = await github('/git/commits/' + encodeURIComponent(headSha));
    const blobs = await Promise.all(files.map(file => github('/git/blobs', {method: 'POST', body: JSON.stringify({content: file.content, encoding: 'base64'})})));
    const tree = await github('/git/trees', {method: 'POST', body: JSON.stringify({base_tree: parent.tree.sha, tree: files.map((file, index) => ({path: file.path, mode: '100644', type: 'blob', sha: blobs[index].sha}))})});
    const commit = await github('/git/commits', {method: 'POST', body: JSON.stringify({message, tree: tree.sha, parents: [headSha]})});
    await github('/git/refs/heads/' + branch.split('/').map(encodeURIComponent).join('/'), {method: 'PATCH', body: JSON.stringify({sha: commit.sha, force: false})});
    return commit.sha;
  }

  async function commitFiles(files, message) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await commitAtHead(files, message, await getHead());
      } catch (error) {
        lastError = error;
        if (error.status !== 409 && error.status !== 422) throw error;
        await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
    throw lastError || new Error('GitHub: конфликт сохранения');
  }

  try {
    if (body.action === 'saveAll') {
      const items = cleanItems(body.items);
      const categories = cleanCategories(body.categories);
      const sha = await commitFiles([
        {path: 'portfolio.json', content: textToBase64(items)},
        {path: 'portfolio-categories.json', content: textToBase64(categories)}
      ], 'Update portfolio and categories from admin');
      return res.status(200).json({ok: true, sha});
    }
    if (body.action === 'save') {
      const sha = await commitFiles([{path: 'portfolio.json', content: textToBase64(cleanItems(body.items))}], 'Update portfolio from admin');
      return res.status(200).json({ok: true, sha});
    }
    if (body.action === 'saveCategories') {
      const sha = await commitFiles([{path: 'portfolio-categories.json', content: textToBase64(cleanCategories(body.categories))}], 'Update portfolio categories from admin');
      return res.status(200).json({ok: true, sha});
    }
    if (body.action === 'uploadOnly') {
      assertImage(body.filename, body.dataBase64);
      const src = safeImagePath(body.filename);
      const sha = await commitFiles([{path: src, content: body.dataBase64}], 'Replace portfolio image');
      return res.status(200).json({ok: true, src, sha});
    }
    if (body.action === 'upload') {
      assertImage(body.filename, body.dataBase64);
      const src = safeImagePath(body.filename);
      let lastError;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const headSha = await getHead();
          const currentItems = cleanItems(await readJsonAt('portfolio.json', headSha));
          const item = {id: 'w' + Date.now() + Math.random().toString(36).slice(2, 6), src, title: String(body.title || '').trim().slice(0, 200) || '3D-печать СИТРО', description: String(body.description || '').trim().slice(0, 1000), categories: cleanCategories(Array.isArray(body.categories) && body.categories.length ? body.categories : ['Прочее']), featured: false, visible: true, sort: currentItems.length + 1};
          currentItems.push(item);
          const sha = await commitAtHead([
            {path: src, content: body.dataBase64},
            {path: 'portfolio.json', content: textToBase64(currentItems)}
          ], 'Add portfolio item', headSha);
          return res.status(200).json({ok: true, src, sha, item});
        } catch (error) {
          lastError = error;
          if (error.status !== 409 && error.status !== 422) throw error;
          await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
        }
      }
      throw lastError || new Error('GitHub: конфликт загрузки');
    }
    return res.status(400).json({error: 'Неизвестное действие'});
  } catch (error) {
    const message = error?.message || 'Ошибка сохранения';
    const status = error?.statusCode || (message.startsWith('Некоррект') || message === 'Нет файла' ? 400 : 500);
    return res.status(status).json({error: message});
  }
}
