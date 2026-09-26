export const MAX_UPLOAD_BASE64_LENGTH = 2_800_000;
export const MAX_UPLOAD_REQUEST_BYTES = 3_300_000;

const INITIAL_MAX_SIDE = 1800;
const MIN_MAX_SIDE = 720;
const INITIAL_QUALITY = 0.84;
const MIN_QUALITY = 0.46;

export function estimatedBase64Length(byteLength) {
  return 4 * Math.ceil(Number(byteLength || 0) / 3);
}

export function isHeicFile(file) {
  const type = String(file?.type || '').toLowerCase();
  const name = String(file?.name || '').toLowerCase();
  return type === 'image/heic' || type === 'image/heif' || /\.(heic|heif)$/.test(name);
}

function decodeWithImageElement(file, dependencies) {
  return new Promise((resolve, reject) => {
    const image = dependencies.createImage();
    const url = dependencies.createObjectURL(file);
    const cleanup = () => dependencies.revokeObjectURL(url);
    image.onload = () => resolve({source: image, width: image.naturalWidth || image.width, height: image.naturalHeight || image.height, cleanup});
    image.onerror = () => {
      cleanup();
      reject(new Error('IMAGE_DECODE_FAILED'));
    };
    image.src = url;
  });
}

export async function decodeImageFile(file, overrides = {}) {
  const dependencies = {
    createImageBitmap: globalThis.createImageBitmap?.bind(globalThis),
    createImage: () => new Image(),
    createObjectURL: value => URL.createObjectURL(value),
    revokeObjectURL: value => URL.revokeObjectURL(value),
    ...overrides
  };

  if (dependencies.createImageBitmap) {
    try {
      const bitmap = await dependencies.createImageBitmap(file, {imageOrientation: 'from-image'});
      return {source: bitmap, width: bitmap.width, height: bitmap.height, cleanup: () => bitmap.close?.()};
    } catch {}
  }

  try {
    return await decodeWithImageElement(file, dependencies);
  } catch {
    if (isHeicFile(file)) {
      throw new Error('Формат HEIC не поддерживается этим браузером. На iPhone выберите «Поделиться» → «Сохранить в Файлы» как JPEG или включите: Настройки → Камера → Форматы → Наиболее совместимый.');
    }
    throw new Error('Браузер не смог прочитать изображение. Выберите JPG, PNG или WebP.');
  }
}

function canvasToJpeg(canvas, quality, encoder) {
  if (encoder) return encoder(canvas, quality);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
}

function blobToBase64(blob, readerFactory) {
  return new Promise((resolve, reject) => {
    const reader = readerFactory ? readerFactory() : new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Не удалось прочитать подготовленное изображение.'));
    reader.readAsDataURL(blob);
  });
}

export async function prepareImageForUpload(file, overrides = {}) {
  if (!file || (!String(file.type || '').startsWith('image/') && !isHeicFile(file))) throw new Error('Выберите файл изображения.');
  const decoded = await (overrides.decodeImage || decodeImageFile)(file, overrides);
  const createCanvas = overrides.createCanvas || (() => document.createElement('canvas'));
  let maxSide = Math.min(INITIAL_MAX_SIDE, Math.max(decoded.width, decoded.height));
  let quality = INITIAL_QUALITY;
  let bestBlob = null;

  try {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const scale = Math.min(1, maxSide / Math.max(decoded.width, decoded.height));
      const width = Math.max(1, Math.round(decoded.width * scale));
      const height = Math.max(1, Math.round(decoded.height * scale));
      const canvas = createCanvas();
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Браузер не смог подготовить изображение.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(decoded.source, 0, 0, width, height);
      const blob = await canvasToJpeg(canvas, quality, overrides.encodeCanvas);
      if (!blob) throw new Error('Браузер не смог сжать изображение.');
      if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
      if (estimatedBase64Length(blob.size) <= MAX_UPLOAD_BASE64_LENGTH) {
        const dataBase64 = await blobToBase64(blob, overrides.createFileReader);
        if (dataBase64.length > MAX_UPLOAD_BASE64_LENGTH) break;
        const base = (String(file.name || 'portfolio').replace(/\.[^.]+$/, '') || 'portfolio').replace(/[^a-zA-Z0-9._-]/g, '-');
        return {filename: base + '.jpg', dataBase64};
      }
      if (quality > MIN_QUALITY) quality = Math.max(MIN_QUALITY, quality - 0.1);
      else {
        maxSide = Math.max(MIN_MAX_SIDE, Math.round(maxSide * 0.8));
        quality = 0.72;
      }
    }
  } finally {
    decoded.cleanup?.();
  }

  const size = bestBlob ? Math.ceil(estimatedBase64Length(bestBlob.size) / 1_000_000 * 10) / 10 : 0;
  throw new Error('Фото не удалось уменьшить до безопасного размера' + (size ? ' (' + size + ' MB после кодирования)' : '') + '. Обрежьте его на iPhone и попробуйте снова.');
}
