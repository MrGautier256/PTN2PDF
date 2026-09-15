import {
  loadPdf,
  renderPdfPageCanvas,
  imageToCanvas,
  blankCanvas,
  decodeImage,
} from './pdf-utils.js';
import * as exporter from './export.js';
import { saveSession, loadSession, clearSession } from './persistence.js';

const THUMB_WIDTH = 260;
const HISTORY_LIMIT = 60;

const PAGE_SIZES = {
  a4: { w: 595.28, h: 841.89 },
  letter: { w: 612, h: 792 },
};

const SOURCE_COLORS = [
  { light: '#2a78d6', dark: '#3987e5' },
  { light: '#1baf7a', dark: '#199e70' },
  { light: '#eda100', dark: '#c98500' },
  { light: '#008300', dark: '#008300' },
  { light: '#4a3aa7', dark: '#9085e9' },
  { light: '#e34948', dark: '#e66767' },
  { light: '#e87ba4', dark: '#d55181' },
  { light: '#eb6834', dark: '#d95926' },
];
const BLANK_COLOR = { light: '#8a8f98', dark: '#6c7079' };

/* ------------------------------------------------------------------ */
/*  État                                                               */
/* ------------------------------------------------------------------ */

const sourceDocs = new Map();
let pages = [];
let selectedUids = new Set();
let lastSelectedIndex = null;
let colorIndex = 0;
const objectUrls = [];

const exportState = { filename: 'document' };

const history = { undo: [], redo: [] };

/* ------------------------------------------------------------------ */
/*  Références DOM                                                     */
/* ------------------------------------------------------------------ */

const el = {
  fileInput: document.getElementById('file-input'),
  dropzone: document.getElementById('dropzone'),
  toolbar: document.getElementById('toolbar'),
  selectAllBtn: document.getElementById('select-all-btn'),
  invertBtn: document.getElementById('invert-btn'),
  insertBlankBtn: document.getElementById('insert-blank-btn'),
  zoomRange: document.getElementById('zoom-range'),
  undoBtn: document.getElementById('undo-btn'),
  redoBtn: document.getElementById('redo-btn'),
  pagesPanel: document.getElementById('pages-panel'),
  pagesGrid: document.getElementById('pages-grid'),
  pageCount: document.getElementById('page-count'),
  emptyState: document.getElementById('empty-state'),
  exportBar: document.getElementById('export-bar'),
  exportSummary: document.getElementById('export-summary'),
  openExportBtn: document.getElementById('open-export-btn'),
  clearAllBtn: document.getElementById('clear-all-btn'),
  toast: document.getElementById('toast'),
  loadingOverlay: document.getElementById('loading-overlay'),
  loadingText: document.getElementById('loading-text'),
  previewModal: document.getElementById('preview-modal'),
  previewImage: document.getElementById('preview-image'),
  previewCaption: document.getElementById('preview-caption'),
  previewClose: document.getElementById('preview-close'),
  previewPrev: document.getElementById('preview-prev'),
  previewNext: document.getElementById('preview-next'),
  selectionBar: document.getElementById('selection-bar'),
  selectionCount: document.getElementById('selection-count'),
  selRotateLeft: document.getElementById('sel-rotate-left'),
  selRotateRight: document.getElementById('sel-rotate-right'),
  selDuplicate: document.getElementById('sel-duplicate'),
  selDelete: document.getElementById('sel-delete'),
  selClear: document.getElementById('sel-clear'),
  // Modale export
  exportModal: document.getElementById('export-modal'),
  optMergeCount: document.getElementById('opt-merge-count'),
  optSelectionCount: document.getElementById('opt-selection-count'),
  exportFilename: document.getElementById('export-filename'),
  exportFilenameLabel: document.getElementById('export-filename-label'),
  pdfOptions: document.getElementById('pdf-options'),
  optCompressWrap: document.getElementById('opt-compress-wrap'),
  optCompress: document.getElementById('opt-compress'),
  optCompressDpi: document.getElementById('opt-compress-dpi'),
  optCompressQuality: document.getElementById('opt-compress-quality'),
  optNumber: document.getElementById('opt-number'),
  optNumberPos: document.getElementById('opt-number-pos'),
  optNumberStart: document.getElementById('opt-number-start'),
  optNumberTotal: document.getElementById('opt-number-total'),
  optWatermark: document.getElementById('opt-watermark'),
  optWatermarkText: document.getElementById('opt-watermark-text'),
  optWatermarkOpacity: document.getElementById('opt-watermark-opacity'),
  optMetaTitle: document.getElementById('opt-meta-title'),
  optMetaAuthor: document.getElementById('opt-meta-author'),
  imageOptions: document.getElementById('image-options'),
  optImgFormat: document.getElementById('opt-img-format'),
  optImgDpi: document.getElementById('opt-img-dpi'),
  optImgQualityWrap: document.getElementById('opt-img-quality-wrap'),
  optImgQuality: document.getElementById('opt-img-quality'),
  doExportBtn: document.getElementById('do-export-btn'),
  // Modale page blanche
  blankModal: document.getElementById('blank-modal'),
  blankFormat: document.getElementById('blank-format'),
  blankOrientation: document.getElementById('blank-orientation'),
  blankPosition: document.getElementById('blank-position'),
  doBlankBtn: document.getElementById('do-blank-btn'),
};

const exportCtx = {
  getSource: (id) => sourceDocs.get(id),
  renderCanvas: renderCanvasForExport,
};

/* ------------------------------------------------------------------ */
/*  Historique (annuler / rétablir)                                    */
/* ------------------------------------------------------------------ */

function clonePage(p) {
  return { ...p, size: p.size ? { ...p.size } : undefined };
}

function snapshot() {
  return { pages: pages.map(clonePage), sel: [...selectedUids], last: lastSelectedIndex };
}

function commitHistory(snap) {
  history.undo.push(snap || snapshot());
  if (history.undo.length > HISTORY_LIMIT) history.undo.shift();
  history.redo.length = 0;
  updateHistoryButtons();
}

function pushHistory() {
  commitHistory(snapshot());
}

function restore(s) {
  pages = s.pages.map(clonePage);
  selectedUids = new Set(s.sel);
  lastSelectedIndex = s.last;
}

function undo() {
  if (!history.undo.length) return;
  history.redo.push(snapshot());
  restore(history.undo.pop());
  updateHistoryButtons();
  render();
  scheduleSave();
}

function redo() {
  if (!history.redo.length) return;
  history.undo.push(snapshot());
  restore(history.redo.pop());
  updateHistoryButtons();
  render();
  scheduleSave();
}

function updateHistoryButtons() {
  el.undoBtn.disabled = history.undo.length === 0;
  el.redoBtn.disabled = history.redo.length === 0;
}

/* ------------------------------------------------------------------ */
/*  Import                                                             */
/* ------------------------------------------------------------------ */

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp)$/i;

function isPdf(file) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}
function isImage(file) {
  return (file.type && file.type.startsWith('image/')) || IMAGE_EXT.test(file.name);
}
function guessMime(name) {
  const m = name.toLowerCase().match(/\.(png|jpe?g|webp|gif|bmp)$/);
  if (!m) return 'image/png';
  const ext = m[1] === 'jpg' ? 'jpeg' : m[1];
  return `image/${ext}`;
}

function nextColor() {
  return SOURCE_COLORS[colorIndex++ % SOURCE_COLORS.length];
}

async function thumbFor(p) {
  if (p.type === 'pdf') {
    const src = sourceDocs.get(p.sourceId);
    const page = await src.pdfDoc.getPage(p.pageIndex + 1);
    const rotation = (page.rotate + p.extraRotation) % 360;
    const canvas = await renderPdfPageCanvas(page, rotation, { width: THUMB_WIDTH });
    return canvas.toDataURL('image/png');
  }
  if (p.type === 'image') {
    const src = sourceDocs.get(p.sourceId);
    return imageToCanvas(src.img, p.extraRotation, THUMB_WIDTH).toDataURL('image/png');
  }
  return blankCanvas(p.size, THUMB_WIDTH).toDataURL('image/png');
}

async function addFiles(fileList) {
  const files = Array.from(fileList).filter((f) => isPdf(f) || isImage(f));
  if (!files.length) {
    showToast('Aucun fichier PDF ou image valide sélectionné.', true);
    return;
  }

  showLoading('Import en cours…');
  pushHistory();
  try {
    for (const file of files) {
      const bytes = await file.arrayBuffer();
      if (isPdf(file)) {
        const pdfDoc = await loadPdf(bytes);
        const id = crypto.randomUUID();
        sourceDocs.set(id, {
          id, name: file.name, type: 'pdf', bytes, pdfDoc,
          numPages: pdfDoc.numPages, color: nextColor(),
        });
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const rotation = page.rotate % 360;
          const canvas = await renderPdfPageCanvas(page, rotation, { width: THUMB_WIDTH });
          pages.push({
            uid: crypto.randomUUID(), type: 'pdf', sourceId: id,
            pageIndex: i - 1, extraRotation: 0, thumbUrl: canvas.toDataURL('image/png'),
          });
        }
      } else {
        const mime = file.type || guessMime(file.name);
        const { img, url, width, height, embedMime, embedBytes } = await decodeImage(bytes, mime, objectUrls);
        const id = crypto.randomUUID();
        sourceDocs.set(id, {
          id, name: file.name, type: 'image', img, url, width, height,
          embedMime, embedBytes, color: nextColor(),
        });
        pages.push({
          uid: crypto.randomUUID(), type: 'image', sourceId: id,
          extraRotation: 0, thumbUrl: imageToCanvas(img, 0, THUMB_WIDTH).toDataURL('image/png'),
        });
      }
    }
    render();
    scheduleSave();
  } catch (err) {
    console.error(err);
    showToast(`Impossible de lire un fichier : ${err?.name ?? ''} ${err?.message ?? err}`, true);
    render();
  } finally {
    hideLoading();
  }
}

/* ------------------------------------------------------------------ */
/*  Opérations sur les pages                                           */
/* ------------------------------------------------------------------ */

async function applyRotation(targets, delta) {
  for (const p of targets) {
    p.extraRotation = ((p.extraRotation + delta) % 360 + 360) % 360;
    p.thumbUrl = await thumbFor(p);
  }
}

async function rotatePage(uid, delta) {
  const p = pages.find((pg) => pg.uid === uid);
  if (!p) return;
  pushHistory();
  await applyRotation([p], delta);
  render();
  scheduleSave();
}

async function rotateSelected(delta) {
  if (!selectedUids.size) return;
  pushHistory();
  showLoading('Rotation en cours…');
  try {
    await applyRotation(pages.filter((p) => selectedUids.has(p.uid)), delta);
    render();
    scheduleSave();
  } finally {
    hideLoading();
  }
}

function deletePage(uid) {
  pushHistory();
  pages = pages.filter((p) => p.uid !== uid);
  selectedUids.delete(uid);
  render();
  scheduleSave();
}

function deleteSelected() {
  if (!selectedUids.size) return;
  pushHistory();
  pages = pages.filter((p) => !selectedUids.has(p.uid));
  selectedUids = new Set();
  lastSelectedIndex = null;
  render();
  scheduleSave();
}

function duplicateUids(uids) {
  const set = new Set(uids);
  if (!set.size) return;
  pushHistory();
  const out = [];
  for (const p of pages) {
    out.push(p);
    if (set.has(p.uid)) out.push({ ...clonePage(p), uid: crypto.randomUUID() });
  }
  pages = out;
  render();
  scheduleSave();
}

function insertBlank() {
  const base = PAGE_SIZES[el.blankFormat.value] || PAGE_SIZES.a4;
  const landscape = el.blankOrientation.value === 'landscape';
  const size = landscape ? { w: base.h, h: base.w } : { w: base.w, h: base.h };
  pushHistory();
  const page = {
    uid: crypto.randomUUID(), type: 'blank', size, extraRotation: 0,
    thumbUrl: blankCanvas(size, THUMB_WIDTH).toDataURL('image/png'),
  };
  if (el.blankPosition.value === 'after' && selectedUids.size) {
    const idxs = pages.map((p, i) => (selectedUids.has(p.uid) ? i : -1)).filter((i) => i >= 0);
    pages.splice(Math.max(...idxs) + 1, 0, page);
  } else {
    pages.push(page);
  }
  closeBlank();
  render();
  scheduleSave();
}

function clearAll() {
  if (!pages.length && !sourceDocs.size) return;
  pushHistory();
  pages = [];
  selectedUids = new Set();
  lastSelectedIndex = null;
  render();
  scheduleSave();
}

function selectAll() {
  selectedUids = new Set(pages.map((p) => p.uid));
  updateSelectionVisuals();
}

function invertSelection() {
  selectedUids = new Set(pages.filter((p) => !selectedUids.has(p.uid)).map((p) => p.uid));
  updateSelectionVisuals();
}

function clearSelection() {
  selectedUids = new Set();
  lastSelectedIndex = null;
  updateSelectionVisuals();
}

/* ------------------------------------------------------------------ */
/*  Rendu pour export (rastérisation)                                  */
/* ------------------------------------------------------------------ */

async function renderCanvasForExport(p, { dpi = 150 } = {}) {
  if (p.type === 'pdf') {
    const src = sourceDocs.get(p.sourceId);
    const page = await src.pdfDoc.getPage(p.pageIndex + 1);
    const rotation = (page.rotate + p.extraRotation) % 360;
    return renderPdfPageCanvas(page, rotation, { dpi });
  }
  if (p.type === 'image') {
    const src = sourceDocs.get(p.sourceId);
    return imageToCanvas(src.img, p.extraRotation, undefined);
  }
  const scale = dpi / 72;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(p.size.w * scale));
  canvas.height = Math.max(1, Math.round(p.size.h * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

/* ------------------------------------------------------------------ */
/*  Aperçu                                                             */
/* ------------------------------------------------------------------ */

let previewIndex = null;

async function showPreviewAt(index) {
  if (index < 0 || index >= pages.length) return;
  previewIndex = index;
  const p = pages[index];
  showLoading('Chargement de l’aperçu…');
  try {
    let imgUrl;
    const targetWidth = Math.min(window.innerWidth * 0.85, 1400);
    if (p.type === 'pdf') {
      const src = sourceDocs.get(p.sourceId);
      const page = await src.pdfDoc.getPage(p.pageIndex + 1);
      const rotation = (page.rotate + p.extraRotation) % 360;
      imgUrl = (await renderPdfPageCanvas(page, rotation, { width: targetWidth })).toDataURL('image/png');
    } else if (p.type === 'image') {
      const src = sourceDocs.get(p.sourceId);
      imgUrl = imageToCanvas(src.img, p.extraRotation, targetWidth).toDataURL('image/png');
    } else {
      imgUrl = blankCanvas(p.size, targetWidth).toDataURL('image/png');
    }
    el.previewImage.src = imgUrl;
    el.previewCaption.textContent = `${labelForPage(p)} - page ${index + 1} / ${pages.length}`;
    el.previewModal.hidden = false;
    el.previewPrev.disabled = index === 0;
    el.previewNext.disabled = index === pages.length - 1;
  } catch (err) {
    console.error(err);
    showToast("Impossible de générer l'aperçu de cette page.", true);
  } finally {
    hideLoading();
  }
}

function openPreview(uid) {
  const idx = pages.findIndex((p) => p.uid === uid);
  if (idx >= 0) showPreviewAt(idx);
}

function closePreview() {
  el.previewModal.hidden = true;
  el.previewImage.src = '';
  previewIndex = null;
}

function labelForPage(p) {
  if (p.type === 'blank') return 'Page blanche';
  return truncate(sourceDocs.get(p.sourceId)?.name ?? '', 40);
}

/* ------------------------------------------------------------------ */
/*  Rendu de la grille                                                 */
/* ------------------------------------------------------------------ */

function truncate(str, max) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function makeIconBtn(label, title, onClick, danger = false) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'page-card__icon-btn' + (danger ? ' page-card__icon-btn--danger' : '');
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.textContent = label;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return btn;
}

async function exportSinglePage(uid) {
  const idx = pages.findIndex((p) => p.uid === uid);
  if (idx < 0) return;
  showLoading('Génération de l’image…');
  try {
    await exporter.exportSinglePageImage(pages[idx], exportCtx, idx);
  } catch (err) {
    console.error(err);
    showToast("Impossible d'exporter cette page en image.", true);
  } finally {
    hideLoading();
  }
}

function buildPageCard(p, index) {
  const selected = selectedUids.has(p.uid);
  const color = p.type === 'blank' ? BLANK_COLOR : sourceDocs.get(p.sourceId)?.color;

  const card = document.createElement('div');
  card.className = 'page-card' + (selected ? ' page-card--selected' : '');
  card.dataset.uid = p.uid;
  card.setAttribute('role', 'listitem');
  if (color) {
    card.style.setProperty('--source-color-light', color.light);
    card.style.setProperty('--source-color-dark', color.dark);
  }

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'page-card__checkbox';
  checkbox.checked = selected;
  checkbox.setAttribute('aria-label', 'Sélectionner cette page');
  checkbox.addEventListener('click', (e) => e.stopPropagation());
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) selectedUids.add(p.uid);
    else selectedUids.delete(p.uid);
    lastSelectedIndex = index;
    updateSelectionVisuals();
  });

  const toolbar = document.createElement('div');
  toolbar.className = 'page-card__toolbar';
  toolbar.appendChild(makeIconBtn('🔍', 'Prévisualiser en grand', () => openPreview(p.uid)));
  toolbar.appendChild(makeIconBtn('⟲', 'Pivoter à gauche', () => rotatePage(p.uid, -90)));
  toolbar.appendChild(makeIconBtn('⟳', 'Pivoter à droite', () => rotatePage(p.uid, 90)));
  toolbar.appendChild(makeIconBtn('⧉', 'Dupliquer', () => duplicateUids([p.uid])));
  toolbar.appendChild(makeIconBtn('🖼', 'Exporter en image', () => exportSinglePage(p.uid)));
  toolbar.appendChild(makeIconBtn('✕', 'Supprimer cette page', () => deletePage(p.uid), true));

  const thumbWrap = document.createElement('div');
  thumbWrap.className = 'page-card__thumb-wrap';
  const img = document.createElement('img');
  img.src = p.thumbUrl;
  img.alt = `Aperçu page ${index + 1}`;
  img.draggable = false;
  thumbWrap.appendChild(img);
  if (p.type !== 'pdf') {
    const badge = document.createElement('span');
    badge.className = 'page-card__badge';
    badge.textContent = p.type === 'image' ? 'Image' : 'Vierge';
    thumbWrap.appendChild(badge);
  }

  const footer = document.createElement('div');
  footer.className = 'page-card__footer';
  const numberSpan = document.createElement('span');
  numberSpan.className = 'page-card__number';
  numberSpan.textContent = `#${index + 1}`;
  const sourceSpan = document.createElement('span');
  const label = labelForPage(p);
  sourceSpan.textContent = truncate(label, 16);
  sourceSpan.title = label;
  footer.append(numberSpan, sourceSpan);

  card.append(checkbox, toolbar, thumbWrap, footer);

  card.addEventListener('click', (e) => {
    if (e.target.closest('.page-card__icon-btn') || e.target.closest('.page-card__checkbox')) return;
    handleCardClick(p.uid, index, e);
  });

  return card;
}

function handleCardClick(uid, index, e) {
  if (e.shiftKey && lastSelectedIndex !== null) {
    const [from, to] = [lastSelectedIndex, index].sort((a, b) => a - b);
    const rangeUids = pages.slice(from, to + 1).map((pg) => pg.uid);
    if (e.ctrlKey || e.metaKey) rangeUids.forEach((u) => selectedUids.add(u));
    else selectedUids = new Set(rangeUids);
  } else if (e.ctrlKey || e.metaKey) {
    if (selectedUids.has(uid)) selectedUids.delete(uid);
    else selectedUids.add(uid);
    lastSelectedIndex = index;
  } else {
    selectedUids = selectedUids.size === 1 && selectedUids.has(uid) ? new Set() : new Set([uid]);
    lastSelectedIndex = index;
  }
  updateSelectionVisuals();
}

function updateSelectionVisuals() {
  el.pagesGrid.querySelectorAll('.page-card').forEach((card) => {
    const uid = card.dataset.uid;
    const selected = selectedUids.has(uid);
    card.classList.toggle('page-card--selected', selected);
    const cb = card.querySelector('.page-card__checkbox');
    if (cb) cb.checked = selected;
  });
  el.pagesGrid.classList.toggle('pages-grid--selecting', selectedUids.size > 0);
  el.selectionBar.hidden = selectedUids.size === 0;
  const n = selectedUids.size;
  el.selectionCount.textContent = `${n} page${n > 1 ? 's' : ''} sélectionnée${n > 1 ? 's' : ''}`;
}

function render() {
  const validUids = new Set(pages.map((p) => p.uid));
  selectedUids.forEach((uid) => {
    if (!validUids.has(uid)) selectedUids.delete(uid);
  });
  if (lastSelectedIndex !== null) {
    lastSelectedIndex = Math.min(lastSelectedIndex, pages.length - 1);
    if (lastSelectedIndex < 0) lastSelectedIndex = null;
  }

  el.pagesGrid.innerHTML = '';
  pages.forEach((p, idx) => el.pagesGrid.appendChild(buildPageCard(p, idx)));
  updateSelectionVisuals();

  const hasSources = pages.length > 0;
  el.pagesPanel.hidden = pages.length === 0;
  el.toolbar.hidden = pages.length === 0;
  el.emptyState.hidden = !(sourceDocs.size > 0 && pages.length === 0);
  el.exportBar.hidden = pages.length === 0;
  el.clearAllBtn.hidden = pages.length === 0;
  el.dropzone.classList.toggle('dropzone--compact', hasSources);
  el.pageCount.textContent = `${pages.length} page${pages.length > 1 ? 's' : ''}`;
  el.exportSummary.textContent = `${pages.length} page${pages.length > 1 ? 's' : ''} prête${pages.length > 1 ? 's' : ''} à l'export`;
  updateHistoryButtons();
}

/* ------------------------------------------------------------------ */
/*  Persistance                                                        */
/* ------------------------------------------------------------------ */

let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(doSave, 500);
}

function serializeSource(s) {
  if (s.type === 'pdf') {
    return { id: s.id, name: s.name, type: 'pdf', bytes: s.bytes, color: s.color };
  }
  return {
    id: s.id, name: s.name, type: 'image', embedBytes: s.embedBytes,
    embedMime: s.embedMime, width: s.width, height: s.height, color: s.color,
  };
}

async function doSave() {
  const usedIds = new Set(pages.filter((p) => p.sourceId).map((p) => p.sourceId));
  const sources = [];
  for (const id of usedIds) {
    const s = sourceDocs.get(id);
    if (s) sources.push(serializeSource(s));
  }
  const pageData = pages.map((p) => ({
    uid: p.uid, type: p.type, sourceId: p.sourceId,
    pageIndex: p.pageIndex, extraRotation: p.extraRotation, thumbUrl: p.thumbUrl, size: p.size,
  }));
  const ok = await saveSession({ sources, pages: pageData, filename: exportState.filename });
  if (!ok && pages.length) showToast('Session non sauvegardée (stockage saturé ?).', true);
}

async function restoreSession() {
  const s = await loadSession();
  if (!s || !s.pages || !s.pages.length) return;
  showLoading('Restauration de la session…');
  try {
    for (const src of s.sources) {
      if (src.type === 'pdf') {
        const pdfDoc = await loadPdf(src.bytes);
        sourceDocs.set(src.id, { ...src, pdfDoc, numPages: pdfDoc.numPages });
      } else {
        const { img, url, width, height, embedMime, embedBytes } = await decodeImage(src.embedBytes, src.embedMime, objectUrls);
        sourceDocs.set(src.id, { ...src, img, url, width, height, embedMime, embedBytes });
      }
    }
    pages = s.pages.map((p) => ({ ...p }));
    colorIndex = s.sources.length;
    if (s.filename) exportState.filename = s.filename;
    render();
    showToast('Session précédente restaurée.');
  } catch (err) {
    console.error(err);
    showToast('Session précédente illisible, elle a été ignorée.', true);
    await clearSession();
  } finally {
    hideLoading();
  }
}

/* ------------------------------------------------------------------ */
/*  Modale d'export                                                    */
/* ------------------------------------------------------------------ */

function currentExportMode() {
  return document.querySelector('input[name="export-mode"]:checked')?.value || 'merge';
}

function refreshExportUI() {
  const mode = currentExportMode();
  const isImages = mode === 'images';
  const isSplit = mode === 'split';
  el.pdfOptions.hidden = isImages;
  el.imageOptions.hidden = !isImages;
  // La compression (rastérisation) n'a de sens que sur un PDF unique.
  el.optCompressWrap.style.display = isSplit ? 'none' : '';
  el.exportFilenameLabel.textContent = isImages || isSplit ? 'Nom de l’archive ZIP' : 'Nom du fichier';
  el.optImgQualityWrap.hidden = el.optImgFormat.value !== 'jpeg';
}

function openExport() {
  const n = pages.length;
  const sel = selectedUids.size;
  el.optMergeCount.textContent = `(${n} page${n > 1 ? 's' : ''})`;
  el.optSelectionCount.textContent = `(${sel} page${sel > 1 ? 's' : ''})`;
  const selRadio = document.querySelector('input[name="export-mode"][value="selection"]');
  selRadio.disabled = sel === 0;
  if (sel === 0 && currentExportMode() === 'selection') {
    document.querySelector('input[name="export-mode"][value="merge"]').checked = true;
  }
  el.exportFilename.value = exportState.filename;
  refreshExportUI();
  el.exportModal.hidden = false;
}

function closeExport() {
  el.exportModal.hidden = true;
}

function readExportOptions() {
  const options = {};
  if (el.optNumber.checked) {
    options.numbering = {
      position: el.optNumberPos.value,
      start: parseInt(el.optNumberStart.value, 10) || 0,
      total: el.optNumberTotal.checked,
    };
  }
  if (el.optWatermark.checked && el.optWatermarkText.value.trim()) {
    options.watermark = {
      text: el.optWatermarkText.value.trim(),
      opacity: parseFloat(el.optWatermarkOpacity.value),
    };
  }
  const meta = {};
  if (el.optMetaTitle.value.trim()) meta.title = el.optMetaTitle.value.trim();
  if (el.optMetaAuthor.value.trim()) meta.author = el.optMetaAuthor.value.trim();
  if (Object.keys(meta).length) options.metadata = meta;
  return options;
}

async function runExport() {
  const mode = currentExportMode();
  const filename = el.exportFilename.value.trim() || 'document';
  exportState.filename = filename;
  const list = mode === 'selection' ? pages.filter((p) => selectedUids.has(p.uid)) : pages;
  if (!list.length) {
    showToast('Rien à exporter.', true);
    return;
  }
  closeExport();
  showLoading('Génération en cours…');
  try {
    if (mode === 'images') {
      await exporter.exportImagesZip(list, exportCtx, {
        format: el.optImgFormat.value,
        dpi: parseInt(el.optImgDpi.value, 10),
        quality: parseFloat(el.optImgQuality.value),
      }, filename);
    } else if (mode === 'split') {
      await exporter.exportSplitZip(list, exportCtx, readExportOptions(), filename);
    } else if (el.optCompress.checked) {
      await exporter.exportCompressed(list, exportCtx, {
        dpi: parseInt(el.optCompressDpi.value, 10),
        quality: parseFloat(el.optCompressQuality.value),
      }, filename);
    } else {
      await exporter.exportPdf(list, exportCtx, readExportOptions(), filename);
    }
    showToast('Export terminé.');
    scheduleSave();
  } catch (err) {
    console.error(err);
    showToast("Erreur lors de l'export.", true);
  } finally {
    hideLoading();
  }
}

function openBlank() {
  el.blankModal.hidden = false;
}
function closeBlank() {
  el.blankModal.hidden = true;
}

/* ------------------------------------------------------------------ */
/*  Toast / loading                                                    */
/* ------------------------------------------------------------------ */

let toastTimer = null;
function showToast(message, isError = false) {
  el.toast.textContent = message;
  el.toast.classList.toggle('toast--error', isError);
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.toast.hidden = true;
  }, isError ? 12000 : 3500);
}

function showLoading(text) {
  el.loadingText.textContent = text;
  el.loadingOverlay.hidden = false;
}
function hideLoading() {
  el.loadingOverlay.hidden = true;
}

/* ------------------------------------------------------------------ */
/*  Zoom des vignettes                                                 */
/* ------------------------------------------------------------------ */

function applyZoom(value) {
  el.pagesGrid.style.setProperty('--thumb-size', `${value}px`);
  try {
    localStorage.setItem('ptn2pdf.zoom', String(value));
  } catch (_) { /* stockage indisponible */ }
}

/* ------------------------------------------------------------------ */
/*  Sélection au lasso                                                 */
/* ------------------------------------------------------------------ */

let marqueeState = null;

function startMarquee(e) {
  const additive = e.ctrlKey || e.metaKey || e.shiftKey;
  marqueeState = {
    startX: e.clientX,
    startY: e.clientY,
    baseSelection: additive ? new Set(selectedUids) : new Set(),
  };
  const box = document.createElement('div');
  box.className = 'marquee-box';
  document.body.appendChild(box);
  marqueeState.box = box;
  positionMarqueeBox(e.clientX, e.clientY);
  if (!additive) {
    selectedUids = new Set();
    updateSelectionVisuals();
  }
  window.addEventListener('mousemove', onMarqueeMove);
  window.addEventListener('mouseup', onMarqueeUp);
  e.preventDefault();
}

function positionMarqueeBox(curX, curY) {
  const { startX, startY, box } = marqueeState;
  const rect = {
    left: Math.min(startX, curX),
    top: Math.min(startY, curY),
    right: Math.max(startX, curX),
    bottom: Math.max(startY, curY),
  };
  box.style.left = `${rect.left}px`;
  box.style.top = `${rect.top}px`;
  box.style.width = `${rect.right - rect.left}px`;
  box.style.height = `${rect.bottom - rect.top}px`;
  return rect;
}

function onMarqueeMove(e) {
  if (!marqueeState) return;
  const rect = positionMarqueeBox(e.clientX, e.clientY);
  const newSelection = new Set(marqueeState.baseSelection);
  el.pagesGrid.querySelectorAll('.page-card').forEach((card) => {
    const r = card.getBoundingClientRect();
    const intersects = !(r.right < rect.left || r.left > rect.right || r.bottom < rect.top || r.top > rect.bottom);
    if (intersects) newSelection.add(card.dataset.uid);
  });
  selectedUids = newSelection;
  updateSelectionVisuals();
}

function onMarqueeUp() {
  window.removeEventListener('mousemove', onMarqueeMove);
  window.removeEventListener('mouseup', onMarqueeUp);
  marqueeState?.box.remove();
  marqueeState = null;
}

/* ------------------------------------------------------------------ */
/*  Sortable (réordonnancement)                                        */
/* ------------------------------------------------------------------ */

let pendingReorder = null;
// eslint-disable-next-line no-undef
new Sortable(el.pagesGrid, {
  animation: 150,
  forceFallback: true,
  fallbackTolerance: 3,
  ghostClass: 'sortable-ghost',
  chosenClass: 'sortable-chosen',
  dragClass: 'sortable-drag',
  onStart() {
    pendingReorder = snapshot();
  },
  onEnd(evt) {
    if (evt.oldIndex === evt.newIndex) {
      pendingReorder = null;
      return;
    }
    if (pendingReorder) {
      commitHistory(pendingReorder);
      pendingReorder = null;
    }
    const [moved] = pages.splice(evt.oldIndex, 1);
    pages.splice(evt.newIndex, 0, moved);
    render();
    scheduleSave();
  },
});

/* ------------------------------------------------------------------ */
/*  Écouteurs                                                          */
/* ------------------------------------------------------------------ */

el.fileInput.addEventListener('change', (e) => {
  if (e.target.files.length) addFiles(e.target.files);
  e.target.value = '';
});
el.dropzone.addEventListener('click', () => el.fileInput.click());
el.clearAllBtn.addEventListener('click', clearAll);
el.undoBtn.addEventListener('click', undo);
el.redoBtn.addEventListener('click', redo);

el.selectAllBtn.addEventListener('click', selectAll);
el.invertBtn.addEventListener('click', invertSelection);
el.insertBlankBtn.addEventListener('click', openBlank);
el.zoomRange.addEventListener('input', (e) => applyZoom(e.target.value));

el.selRotateLeft.addEventListener('click', () => rotateSelected(-90));
el.selRotateRight.addEventListener('click', () => rotateSelected(90));
el.selDuplicate.addEventListener('click', () => duplicateUids([...selectedUids]));
el.selDelete.addEventListener('click', deleteSelected);
el.selClear.addEventListener('click', clearSelection);

el.openExportBtn.addEventListener('click', openExport);
el.doExportBtn.addEventListener('click', runExport);
document.querySelectorAll('[data-close-export]').forEach((b) => b.addEventListener('click', closeExport));
document.querySelectorAll('input[name="export-mode"]').forEach((r) => r.addEventListener('change', refreshExportUI));
el.optImgFormat.addEventListener('change', refreshExportUI);
el.exportModal.addEventListener('click', (e) => {
  if (e.target === el.exportModal) closeExport();
});

el.doBlankBtn.addEventListener('click', insertBlank);
document.querySelectorAll('[data-close-blank]').forEach((b) => b.addEventListener('click', closeBlank));
el.blankModal.addEventListener('click', (e) => {
  if (e.target === el.blankModal) closeBlank();
});

el.previewClose.addEventListener('click', closePreview);
el.previewPrev.addEventListener('click', () => showPreviewAt(previewIndex - 1));
el.previewNext.addEventListener('click', () => showPreviewAt(previewIndex + 1));
el.previewModal.addEventListener('click', (e) => {
  if (e.target === el.previewModal) closePreview();
});

document.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || pages.length === 0) return;
  if (e.target.closest('.page-card, #selection-bar, .toolbar, .app-header, #dropzone, .export-bar, .modal, button, label, input, select, a')) return;
  startMarquee(e);
});

document.addEventListener('keydown', (e) => {
  if (!el.previewModal.hidden) {
    if (e.key === 'ArrowLeft') showPreviewAt(previewIndex - 1);
    else if (e.key === 'ArrowRight') showPreviewAt(previewIndex + 1);
    else if (e.key === 'Escape') closePreview();
    return;
  }
  const active = document.activeElement;
  const isTyping = active && (active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' ||
    (active.tagName === 'INPUT' && active.type !== 'checkbox'));

  if ((e.ctrlKey || e.metaKey) && !isTyping) {
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); return; }
    if (k === 'a' && pages.length) { e.preventDefault(); selectAll(); return; }
  }
  if (e.key === 'Escape') {
    if (!el.exportModal.hidden) closeExport();
    else if (!el.blankModal.hidden) closeBlank();
    else if (selectedUids.size) clearSelection();
    return;
  }
  if (e.key === 'Delete' && selectedUids.size && !isTyping) deleteSelected();
});

let dragCounter = 0;
document.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter++;
  el.dropzone.classList.add('dropzone--active');
});
document.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragCounter = Math.max(0, dragCounter - 1);
  if (dragCounter === 0) el.dropzone.classList.remove('dropzone--active');
});
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  dragCounter = 0;
  el.dropzone.classList.remove('dropzone--active');
  if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
});

/* ------------------------------------------------------------------ */
/*  Démarrage                                                          */
/* ------------------------------------------------------------------ */

try {
  const savedZoom = localStorage.getItem('ptn2pdf.zoom');
  if (savedZoom) el.zoomRange.value = savedZoom;
} catch (_) { /* stockage indisponible */ }
applyZoom(el.zoomRange.value);

render();
restoreSession();
