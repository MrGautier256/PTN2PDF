import * as pdfjsLib from '../vendor/pdf.min.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.js', import.meta.url).href;

export { pdfjsLib };

/** Ouvre un document PDF avec pdf.js à partir d'octets (une copie est passée pour ne pas neutraliser le buffer d'origine). */
export function loadPdf(bytes) {
  return pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
}

/**
 * Rend une page pdf.js dans un canvas.
 * opts : { width } largeur cible en px, { dpi } résolution, ou { scale } facteur direct.
 */
export async function renderPdfPageCanvas(page, rotation, opts = {}) {
  let viewport;
  if (opts.width) {
    const base = page.getViewport({ scale: 1, rotation });
    viewport = page.getViewport({ scale: opts.width / base.width, rotation });
  } else if (opts.dpi) {
    viewport = page.getViewport({ scale: opts.dpi / 72, rotation });
  } else {
    viewport = page.getViewport({ scale: opts.scale || 1, rotation });
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

/** Dessine une image (HTMLImageElement) dans un canvas, avec rotation et largeur cible optionnelle. */
export function imageToCanvas(img, rotation, targetWidth) {
  const rot = (((rotation || 0) % 360) + 360) % 360;
  const swap = rot === 90 || rot === 270;
  const natW = img.naturalWidth || img.width;
  const natH = img.naturalHeight || img.height;
  const dispW = swap ? natH : natW;
  const dispH = swap ? natW : natH;
  const scale = targetWidth ? targetWidth / dispW : 1;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(dispW * scale));
  canvas.height = Math.max(1, Math.round(dispH * scale));
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rot * Math.PI) / 180);
  const drawW = natW * scale;
  const drawH = natH * scale;
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  return canvas;
}

/** Canvas blanc représentant une page vierge, à une largeur cible donnée. */
export function blankCanvas(sizePt, targetWidth) {
  const ratio = sizePt.h / sizePt.w;
  const w = targetWidth || 260;
  const h = Math.round(w * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  return canvas;
}

/** Décode des octets image, renvoie l'élément Image, ses dimensions et des octets embarquables par pdf-lib (PNG/JPEG). */
export async function decodeImage(bytes, mime, objectUrls) {
  const blob = new Blob([bytes], { type: mime || 'image/png' });
  const url = URL.createObjectURL(blob);
  if (objectUrls) objectUrls.push(url);
  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image illisible'));
    image.src = url;
  });

  const width = img.naturalWidth;
  const height = img.naturalHeight;
  let embedMime = mime;
  let embedBytes = bytes;

  // pdf-lib ne sait embarquer que du PNG ou du JPEG : on rastérise le reste en PNG.
  if (embedMime !== 'image/png' && embedMime !== 'image/jpeg') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0);
    const pngBlob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    embedBytes = await pngBlob.arrayBuffer();
    embedMime = 'image/png';
  }

  return { img, url, width, height, embedMime, embedBytes };
}

/** Convertit un canvas en octets JPEG/PNG. */
export async function canvasToBytes(canvas, format = 'image/png', quality = 0.85) {
  const blob = await new Promise((r) => canvas.toBlob(r, format, quality));
  return new Uint8Array(await blob.arrayBuffer());
}
