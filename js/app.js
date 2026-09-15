import * as pdfjsLib from '../vendor/pdf.min.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.js', import.meta.url).href;

const THUMB_WIDTH = 260;

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

/** @type {Map<string, { id: string, name: string, file: File, pdfDoc: any, numPages: number, color: {light: string, dark: string} }>} */
const sourceDocs = new Map();

/** @type {{ uid: string, sourceId: string, pageIndex: number, extraRotation: number, thumbUrl: string }[]} */
let pages = [];

/** @type {Set<string>} */
let selectedUids = new Set();
let lastSelectedIndex = null;

const el = {
  fileInput: document.getElementById('file-input'),
  dropzone: document.getElementById('dropzone'),
  pagesPanel: document.getElementById('pages-panel'),
  pagesGrid: document.getElementById('pages-grid'),
  pageCount: document.getElementById('page-count'),
  emptyState: document.getElementById('empty-state'),
  exportBar: document.getElementById('export-bar'),
  exportBtn: document.getElementById('export-btn'),
  outputFilename: document.getElementById('output-filename'),
  clearAllBtn: document.getElementById('clear-all-btn'),
  toast: document.getElementById('toast'),
  loadingOverlay: document.getElementById('loading-overlay'),
  loadingText: document.getElementById('loading-text'),
  previewModal: document.getElementById('preview-modal'),
  previewImage: document.getElementById('preview-image'),
  previewCaption: document.getElementById('preview-caption'),
  previewClose: document.getElementById('preview-close'),
  selectionBar: document.getElementById('selection-bar'),
  selectionCount: document.getElementById('selection-count'),
  selRotateLeft: document.getElementById('sel-rotate-left'),
  selRotateRight: document.getElementById('sel-rotate-right'),
  selDelete: document.getElementById('sel-delete'),
  selClear: document.getElementById('sel-clear'),
};

const sortable = new Sortable(el.pagesGrid, {
  animation: 150,
  forceFallback: true,
  fallbackTolerance: 3,
  ghostClass: 'sortable-ghost',
  chosenClass: 'sortable-chosen',
  dragClass: 'sortable-drag',
  onEnd(evt) {
    if (evt.oldIndex === evt.newIndex) return;
    const [moved] = pages.splice(evt.oldIndex, 1);
    pages.splice(evt.newIndex, 0, moved);
    render();
  },
});

async function renderPageImage(page, rotation, targetWidth) {
  const baseViewport = page.getViewport({ scale: 1, rotation });
  const scale = targetWidth / baseViewport.width;
  const viewport = page.getViewport({ scale, rotation });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL('image/png');
}

async function addFiles(fileList) {
  const pdfFiles = Array.from(fileList).filter(
    (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
  );
  if (!pdfFiles.length) {
    showToast('Aucun fichier PDF valide sélectionné.', true);
    return;
  }

  showLoading('Import en cours…');
  try {
    for (const file of pdfFiles) {
      const buf = await file.arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
      const sourceId = crypto.randomUUID();
      const color = SOURCE_COLORS[sourceDocs.size % SOURCE_COLORS.length];
      sourceDocs.set(sourceId, { id: sourceId, name: file.name, file, pdfDoc, numPages: pdfDoc.numPages, color });

      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const rotation = page.rotate % 360;
        const thumbUrl = await renderPageImage(page, rotation, THUMB_WIDTH);
        pages.push({
          uid: crypto.randomUUID(),
          sourceId,
          pageIndex: i - 1,
          extraRotation: 0,
          thumbUrl,
        });
      }
    }
    render();
  } catch (err) {
    console.error(err);
    showToast(`Impossible de lire un des fichiers : ${err?.name ?? ''} ${err?.message ?? err}`, true);
  } finally {
    hideLoading();
  }
}

async function rotatePage(uid, delta) {
  const p = pages.find((pg) => pg.uid === uid);
  if (!p) return;
  p.extraRotation = ((p.extraRotation + delta) % 360 + 360) % 360;

  const src = sourceDocs.get(p.sourceId);
  const page = await src.pdfDoc.getPage(p.pageIndex + 1);
  const rotation = (page.rotate + p.extraRotation) % 360;
  p.thumbUrl = await renderPageImage(page, rotation, THUMB_WIDTH);
  render();
}

function deletePage(uid) {
  pages = pages.filter((p) => p.uid !== uid);
  selectedUids.delete(uid);
  render();
}

function clearAll() {
  for (const src of sourceDocs.values()) {
    src.pdfDoc?.loadingTask?.destroy();
  }
  sourceDocs.clear();
  pages = [];
  selectedUids = new Set();
  lastSelectedIndex = null;
  el.outputFilename.value = 'document-fusionne.pdf';
  render();
}

function deleteSelected() {
  if (!selectedUids.size) return;
  pages = pages.filter((p) => !selectedUids.has(p.uid));
  selectedUids = new Set();
  lastSelectedIndex = null;
  render();
}

async function rotateSelected(delta) {
  if (!selectedUids.size) return;
  const targets = pages.filter((p) => selectedUids.has(p.uid));
  showLoading('Rotation en cours…');
  try {
    for (const p of targets) {
      p.extraRotation = ((p.extraRotation + delta) % 360 + 360) % 360;
      const src = sourceDocs.get(p.sourceId);
      const page = await src.pdfDoc.getPage(p.pageIndex + 1);
      const rotation = (page.rotate + p.extraRotation) % 360;
      p.thumbUrl = await renderPageImage(page, rotation, THUMB_WIDTH);
    }
    render();
  } finally {
    hideLoading();
  }
}

function clearSelection() {
  selectedUids = new Set();
  lastSelectedIndex = null;
  updateSelectionVisuals();
}

async function openPreview(uid) {
  const p = pages.find((pg) => pg.uid === uid);
  if (!p) return;
  const src = sourceDocs.get(p.sourceId);

  showLoading('Chargement de l’aperçu…');
  try {
    const page = await src.pdfDoc.getPage(p.pageIndex + 1);
    const rotation = (page.rotate + p.extraRotation) % 360;
    const targetWidth = Math.min(window.innerWidth * 0.85, 1200);
    const imgUrl = await renderPageImage(page, rotation, targetWidth);

    const index = pages.indexOf(p);
    el.previewImage.src = imgUrl;
    el.previewCaption.textContent = `${truncate(src.name, 40)} — page ${index + 1}`;
    el.previewModal.hidden = false;
  } catch (err) {
    console.error(err);
    showToast("Impossible de générer l'aperçu de cette page.", true);
  } finally {
    hideLoading();
  }
}

function closePreview() {
  el.previewModal.hidden = true;
  el.previewImage.src = '';
}

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

function buildPageCard(p, index) {
  const src = sourceDocs.get(p.sourceId);
  const selected = selectedUids.has(p.uid);

  const card = document.createElement('div');
  card.className = 'page-card' + (selected ? ' page-card--selected' : '');
  card.dataset.uid = p.uid;
  card.setAttribute('role', 'listitem');
  if (src?.color) {
    card.style.setProperty('--source-color-light', src.color.light);
    card.style.setProperty('--source-color-dark', src.color.dark);
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
  toolbar.appendChild(makeIconBtn('✕', 'Supprimer cette page', () => deletePage(p.uid), true));

  const thumbWrap = document.createElement('div');
  thumbWrap.className = 'page-card__thumb-wrap';
  const img = document.createElement('img');
  img.src = p.thumbUrl;
  img.alt = `Aperçu page ${index + 1}`;
  img.draggable = false;
  thumbWrap.appendChild(img);

  const footer = document.createElement('div');
  footer.className = 'page-card__footer';
  const numberSpan = document.createElement('span');
  numberSpan.className = 'page-card__number';
  numberSpan.textContent = `#${index + 1}`;
  const sourceSpan = document.createElement('span');
  sourceSpan.textContent = truncate(src?.name ?? '', 16);
  sourceSpan.title = src?.name ?? '';
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
    if (e.ctrlKey || e.metaKey) {
      rangeUids.forEach((u) => selectedUids.add(u));
    } else {
      selectedUids = new Set(rangeUids);
    }
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
  el.selectionCount.textContent = `${selectedUids.size} page${selectedUids.size > 1 ? 's' : ''} sélectionnée${selectedUids.size > 1 ? 's' : ''}`;
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
  el.pagesGrid.classList.toggle('pages-grid--selecting', selectedUids.size > 0);
  el.selectionBar.hidden = selectedUids.size === 0;
  el.selectionCount.textContent = `${selectedUids.size} page${selectedUids.size > 1 ? 's' : ''} sélectionnée${selectedUids.size > 1 ? 's' : ''}`;

  const hasSources = sourceDocs.size > 0;
  el.pagesPanel.hidden = pages.length === 0;
  el.emptyState.hidden = !(hasSources && pages.length === 0);
  el.exportBar.hidden = pages.length === 0;
  el.clearAllBtn.hidden = !hasSources;
  el.dropzone.classList.toggle('dropzone--compact', hasSources);
  el.pageCount.textContent = `${pages.length} page${pages.length > 1 ? 's' : ''}`;
}

function getOutputFilename() {
  let name = (el.outputFilename.value || '').trim() || 'document-fusionne.pdf';
  if (!name.toLowerCase().endsWith('.pdf')) name += '.pdf';
  return name;
}

function downloadBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function exportMergedPdf() {
  if (!pages.length) return;
  showLoading('Génération du PDF…');
  try {
    const outDoc = await PDFLib.PDFDocument.create();
    const libDocCache = new Map();

    for (const p of pages) {
      let libDoc = libDocCache.get(p.sourceId);
      if (!libDoc) {
        const src = sourceDocs.get(p.sourceId);
        const buf = await src.file.arrayBuffer();
        libDoc = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: true });
        libDocCache.set(p.sourceId, libDoc);
      }
      const [copiedPage] = await outDoc.copyPages(libDoc, [p.pageIndex]);
      if (p.extraRotation) {
        const current = copiedPage.getRotation().angle || 0;
        copiedPage.setRotation(PDFLib.degrees((current + p.extraRotation) % 360));
      }
      outDoc.addPage(copiedPage);
    }

    const bytes = await outDoc.save();
    downloadBytes(bytes, getOutputFilename());
    showToast('PDF généré avec succès.');
  } catch (err) {
    console.error(err);
    showToast("Erreur lors de la génération du PDF.", true);
  } finally {
    hideLoading();
  }
}

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

el.fileInput.addEventListener('change', (e) => {
  if (e.target.files.length) addFiles(e.target.files);
  e.target.value = '';
});

el.dropzone.addEventListener('click', () => el.fileInput.click());
el.clearAllBtn.addEventListener('click', clearAll);
el.exportBtn.addEventListener('click', exportMergedPdf);

el.previewClose.addEventListener('click', closePreview);
el.previewModal.addEventListener('click', (e) => {
  if (e.target === el.previewModal) closePreview();
});

el.selRotateLeft.addEventListener('click', () => rotateSelected(-90));
el.selRotateRight.addEventListener('click', () => rotateSelected(90));
el.selDelete.addEventListener('click', deleteSelected);
el.selClear.addEventListener('click', clearSelection);

document.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || pages.length === 0) return;
  if (e.target.closest('.page-card, #selection-bar, .app-header, #dropzone, .export-bar, button, label, input, a')) return;
  startMarquee(e);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!el.previewModal.hidden) closePreview();
    else if (selectedUids.size) clearSelection();
    return;
  }
  const active = document.activeElement;
  const isTyping = active && (active.tagName === 'TEXTAREA' || (active.tagName === 'INPUT' && active.type !== 'checkbox'));
  if (e.key === 'Delete' && selectedUids.size && !isTyping) {
    deleteSelected();
  }
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

render();
