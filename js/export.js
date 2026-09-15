// Toutes les opérations d'export. S'appuie sur pdf-lib (global PDFLib) et JSZip (global JSZip).
// Le contexte `ctx` fourni par app.js expose :
//   ctx.getSource(id)            -> source { type, bytes | embedBytes, embedMime, width, height, name }
//   ctx.renderCanvas(page, opts) -> HTMLCanvasElement (rastérisation d'une page, tous types)

import { canvasToBytes } from './pdf-utils.js';

const { PDFDocument, degrees, rgb, StandardFonts } = PDFLib;

/* ------------------------------------------------------------------ */
/*  Téléchargement                                                     */
/* ------------------------------------------------------------------ */

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function download(bytes, filename, mime) {
  downloadBlob(new Blob([bytes], { type: mime }), filename);
}

/* ------------------------------------------------------------------ */
/*  Construction d'un PDF à partir de pages                            */
/* ------------------------------------------------------------------ */

async function embedImageInto(out, source, cache) {
  if (cache.has(source.id)) return cache.get(source.id);
  const bytes = source.embedBytes.slice(0);
  const img = source.embedMime === 'image/jpeg'
    ? await out.embedJpg(bytes)
    : await out.embedPng(bytes);
  cache.set(source.id, img);
  return img;
}

async function loadLibDoc(source, cache) {
  if (cache.has(source.id)) return cache.get(source.id);
  const doc = await PDFDocument.load(source.bytes.slice(0), { ignoreEncryption: true });
  cache.set(source.id, doc);
  return doc;
}

/** Construit un PDFDocument pdf-lib à partir d'une liste de pages ordonnées. */
async function buildPdf(pages, ctx, options = {}) {
  const out = await PDFDocument.create();
  const libCache = new Map();
  const imgCache = new Map();

  for (const p of pages) {
    if (p.type === 'pdf') {
      const source = ctx.getSource(p.sourceId);
      const lib = await loadLibDoc(source, libCache);
      const [copied] = await out.copyPages(lib, [p.pageIndex]);
      if (p.extraRotation) {
        const current = copied.getRotation().angle || 0;
        copied.setRotation(degrees((current + p.extraRotation) % 360));
      }
      out.addPage(copied);
    } else if (p.type === 'image') {
      const source = ctx.getSource(p.sourceId);
      const img = await embedImageInto(out, source, imgCache);
      const page = out.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      if (p.extraRotation) page.setRotation(degrees(((p.extraRotation % 360) + 360) % 360));
    } else if (p.type === 'blank') {
      out.addPage([p.size.w, p.size.h]);
    }
  }

  if (options.metadata) applyMetadata(out, options.metadata);
  if (options.watermark && options.watermark.text) await applyWatermark(out, options.watermark);
  if (options.numbering) await applyNumbering(out, options.numbering);

  return out;
}

/* ------------------------------------------------------------------ */
/*  Finitions : métadonnées, filigrane, numérotation                   */
/* ------------------------------------------------------------------ */

function applyMetadata(out, meta) {
  if (meta.title) out.setTitle(meta.title);
  if (meta.author) out.setAuthor(meta.author);
  if (meta.subject) out.setSubject(meta.subject);
  if (meta.keywords) out.setKeywords(meta.keywords.split(',').map((k) => k.trim()).filter(Boolean));
  out.setProducer('PTN2PDF');
  out.setCreator('PTN2PDF');
}

async function applyWatermark(out, wm) {
  const font = await out.embedFont(StandardFonts.HelveticaBold);
  const opacity = wm.opacity ?? 0.18;
  const color = rgb(0.5, 0.5, 0.5);
  for (const page of out.getPages()) {
    const { width, height } = page.getSize();
    const size = wm.size || Math.min(width, height) / 8;
    const textWidth = font.widthOfTextAtSize(wm.text, size);
    const angle = 45;
    const rad = (angle * Math.PI) / 180;
    // Centre le texte le long de la diagonale.
    const x = width / 2 - (textWidth / 2) * Math.cos(rad);
    const y = height / 2 - (textWidth / 2) * Math.sin(rad);
    page.drawText(wm.text, { x, y, size, font, color, opacity, rotate: degrees(angle) });
  }
}

async function applyNumbering(out, num) {
  const font = await out.embedFont(StandardFonts.Helvetica);
  const size = num.fontSize || 11;
  const margin = 28;
  const start = Number.isFinite(num.start) ? num.start : 1;
  const pages = out.getPages();
  pages.forEach((page, i) => {
    const label = num.total
      ? `${start + i} / ${start + pages.length - 1}`
      : String(start + i);
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(label, size);
    const pos = num.position || 'bottom-center';
    const bottom = pos.startsWith('bottom');
    const y = bottom ? margin : height - margin;
    let x;
    if (pos.endsWith('left')) x = margin;
    else if (pos.endsWith('right')) x = width - margin - textWidth;
    else x = width / 2 - textWidth / 2;
    page.drawText(label, { x, y, size, font, color: rgb(0.2, 0.2, 0.2) });
  });
}

/* ------------------------------------------------------------------ */
/*  Points d'entrée d'export                                           */
/* ------------------------------------------------------------------ */

/** Fusionne (ou extrait) une liste de pages en un seul PDF. */
export async function exportPdf(pages, ctx, options, filename) {
  const out = await buildPdf(pages, ctx, options);
  const bytes = await out.save();
  download(bytes, ensureExt(filename, 'pdf'), 'application/pdf');
}

/** Découpe : un PDF par document source, le tout dans un ZIP. */
export async function exportSplitZip(pages, ctx, options, zipName) {
  const zip = new JSZip();
  const groups = new Map();
  const order = [];
  for (const p of pages) {
    const key = p.type === 'blank' ? '__blank__' : p.sourceId;
    if (!groups.has(key)) { groups.set(key, []); order.push(key); }
    groups.get(key).push(p);
  }

  const used = new Set();
  for (const key of order) {
    const groupPages = groups.get(key);
    const out = await buildPdf(groupPages, ctx, options);
    const bytes = await out.save();
    let base;
    if (key === '__blank__') base = 'pages-blanches';
    else base = stripExt(ctx.getSource(key)?.name || 'document');
    let name = `${base}.pdf`;
    let n = 2;
    while (used.has(name.toLowerCase())) name = `${base} (${n++}).pdf`;
    used.add(name.toLowerCase());
    zip.file(name, bytes);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, ensureExt(zipName, 'zip'));
}

/** Rastérise chaque page en JPEG et reconstruit un PDF compressé. */
export async function exportCompressed(pages, ctx, { dpi = 150, quality = 0.7 }, filename) {
  const out = await PDFDocument.create();
  for (const p of pages) {
    const canvas = await ctx.renderCanvas(p, { dpi });
    const jpg = await canvasToBytes(canvas, 'image/jpeg', quality);
    const img = await out.embedJpg(jpg);
    const page = out.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  const bytes = await out.save();
  download(bytes, ensureExt(filename, 'pdf'), 'application/pdf');
}

/** Exporte chaque page en image dans un ZIP. */
export async function exportImagesZip(pages, ctx, { format = 'png', dpi = 150, quality = 0.85 }, zipName) {
  const zip = new JSZip();
  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const ext = format === 'jpeg' ? 'jpg' : 'png';
  const pad = String(pages.length).length;
  for (let i = 0; i < pages.length; i++) {
    const canvas = await ctx.renderCanvas(pages[i], { dpi });
    const bytes = await canvasToBytes(canvas, mime, quality);
    const name = `page-${String(i + 1).padStart(Math.max(2, pad), '0')}.${ext}`;
    zip.file(name, bytes);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, ensureExt(zipName, 'zip'));
}

/** Exporte une seule page en image PNG (bouton rapide sur la vignette). */
export async function exportSinglePageImage(page, ctx, index) {
  const canvas = await ctx.renderCanvas(page, { dpi: 150 });
  const bytes = await canvasToBytes(canvas, 'image/png', 1);
  download(bytes, `page-${index + 1}.png`, 'image/png');
}

/* ------------------------------------------------------------------ */
/*  Helpers noms de fichiers                                           */
/* ------------------------------------------------------------------ */

function ensureExt(name, ext) {
  const clean = (name || '').trim() || `export`;
  return clean.toLowerCase().endsWith(`.${ext}`) ? clean : `${clean}.${ext}`;
}

function stripExt(name) {
  return name.replace(/\.[^.]+$/, '');
}
