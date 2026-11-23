// تصغير وضغط الصور في المتصفح قبل الرفع.
// الفائدة: رفع أسرع، مساحة أقل على Turso، وتوافق مع صور الهاتف الكبيرة.
export async function prepareImage(file, options = {}) {
  if (!file || typeof file.type !== 'string' || !file.type.startsWith('image/')) return file;
  const { max = 1400, quality = 0.82, maxBytes = 900 * 1024 } = options;
  let source = null;
  let objectUrl = null;
  try {
    if (typeof createImageBitmap === 'function') {
      source = await createImageBitmap(file);
    } else {
      objectUrl = URL.createObjectURL(file);
      source = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = objectUrl;
      });
    }
    const width = source.width || source.naturalWidth;
    const height = source.height || source.naturalHeight;
    if (!width || !height) return file;
    const scale = Math.min(1, max / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    context.drawImage(source, 0, 0, canvas.width, canvas.height);

    let q = quality;
    let blob = null;
    do {
      blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', q));
      q -= 0.12;
    } while (blob && blob.size > maxBytes && q > 0.4);
    if (!blob) return file;

    const baseName = (file.name || 'image').replace(/\.[^.]+$/, '');
    const prepared = new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now()
    });
    return prepared;
  } catch {
    // لو تعذّر فك الصورة (مثل HEIC على متصفح لا يدعمها) اتركها كما هي
    // ليظهر خطأ واضح من الخادم بدل فشل صامت.
    return file;
  } finally {
    source?.close?.();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export const prepareAvatar = (file) => prepareImage(file, { max: 640, quality: 0.85, maxBytes: 300 * 1024 });
export const prepareCourseImage = (file) => prepareImage(file, { max: 1600, quality: 0.82, maxBytes: 900 * 1024 });
