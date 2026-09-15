// Internationalisation.
// Pour ajouter une langue : ajouter une entrée dans DICT (copier une existante et traduire),
// puis une <option> dans le sélecteur de langue de index.html. Rien d'autre à toucher.

const DICT = {
  fr: {
    'app.subtitle': "Fusionnez, convertissez et nettoyez vos PDF. Tout reste sur votre machine, aucun fichier n'est envoyé nulle part.",
    'action.undo': 'Annuler (Ctrl+Z)',
    'action.redo': 'Rétablir (Ctrl+Y)',
    'action.clearAll': 'Tout effacer',
    'action.addFiles': '+ Ajouter des fichiers',
    'lang.label': 'Langue',

    'dropzone.title': 'Glissez-déposez vos fichiers PDF ou images ici',
    'dropzone.hint': 'ou cliquez pour parcourir - PDF, PNG, JPEG, WebP - plusieurs fichiers possibles',

    'toolbar.selectAll': 'Tout sélectionner',
    'toolbar.invert': 'Inverser',
    'toolbar.insertBlank': '+ Page blanche',
    'toolbar.zoomLabel': 'Taille des vignettes',
    'panel.hint': 'Glissez une vignette pour réordonner - cochez ou cliquez-glissez pour sélectionner',

    'sel.rotateLeft': 'Pivoter à gauche',
    'sel.rotateRight': 'Pivoter à droite',
    'sel.duplicate': 'Dupliquer',
    'sel.delete': 'Supprimer',
    'sel.deselect': 'Désélectionner',

    'empty.message': 'Toutes les pages ont été supprimées.',
    'exportbar.button': 'Exporter…',

    'export.title': 'Exporter',
    'common.close': 'Fermer',
    'common.cancel': 'Annuler',
    'export.legend': 'Que voulez-vous exporter ?',
    'export.mode.merge': 'Fusionner tout le document',
    'export.mode.selection': 'Extraire uniquement la sélection',
    'export.mode.split': 'Découper : un PDF par document source (ZIP)',
    'export.mode.images': 'Exporter les pages en images (ZIP)',
    'export.mode.ocr': 'Rendre le PDF cherchable (OCR)',
    'export.filename': 'Nom du fichier',
    'export.filenameZip': "Nom de l'archive ZIP",
    'export.do': 'Exporter',

    'opt.compress': 'Compresser',
    'opt.resolution': 'Résolution',
    'dpi.light': '96 dpi (léger)',
    'dpi.balanced': '150 dpi (équilibré)',
    'dpi.sharp': '220 dpi (net)',
    'dpi.300': '300 dpi',
    'opt.jpegQuality': 'Qualité JPEG',
    'opt.number': 'Numéroter les pages',
    'opt.position': 'Position',
    'pos.bottomCenter': 'Bas centre',
    'pos.bottomRight': 'Bas droite',
    'pos.bottomLeft': 'Bas gauche',
    'pos.topCenter': 'Haut centre',
    'pos.topRight': 'Haut droite',
    'pos.topLeft': 'Haut gauche',
    'opt.startAt': 'Commencer à',
    'opt.showTotal': 'Afficher « n / total »',
    'opt.watermark': 'Filigrane',
    'opt.text': 'Texte',
    'opt.opacity': 'Opacité',
    'opt.metadata': 'Métadonnées (titre, auteur)',
    'opt.metaTitle': 'Titre',
    'opt.metaAuthor': 'Auteur',
    'opt.format': 'Format',
    'fmt.pngLossless': 'PNG (sans perte)',
    'fmt.jpegLighter': 'JPEG (plus léger)',

    'ocr.langLabel': 'Langue du texte',
    'ocr.lang.auto': "Auto (selon l'app)",
    'ocr.lang.fra': 'Français',
    'ocr.lang.eng': 'English',
    'ocr.lang.both': 'Français + English',
    'ocr.note': "L'OCR ajoute une couche de texte sélectionnable sous chaque page. Traitement local, peut prendre quelques secondes par page.",

    'blank.title': 'Insérer une page blanche',
    'blank.format': 'Format',
    'blank.a4': 'A4',
    'blank.letter': 'Lettre US',
    'blank.orientation': 'Orientation',
    'blank.portrait': 'Portrait',
    'blank.landscape': 'Paysage',
    'blank.position': 'Position',
    'blank.atEnd': 'À la fin',
    'blank.afterSelection': 'Après la sélection',
    'blank.insert': 'Insérer',

    'preview.close': "Fermer l'aperçu",
    'preview.prev': 'Page précédente',
    'preview.next': 'Page suivante',

    'card.preview': 'Prévisualiser en grand',
    'card.rotateLeft': 'Pivoter à gauche',
    'card.rotateRight': 'Pivoter à droite',
    'card.duplicate': 'Dupliquer',
    'card.exportImage': 'Exporter en image',
    'card.delete': 'Supprimer cette page',
    'card.selectAria': 'Sélectionner cette page',
    'badge.image': 'Image',
    'badge.blank': 'Vierge',
    'label.blankPage': 'Page blanche',

    'loading.default': 'Traitement en cours…',
    'loading.importing': 'Import en cours…',
    'loading.rotating': 'Rotation en cours…',
    'loading.preview': "Chargement de l'aperçu…",
    'loading.imageGen': "Génération de l'image…",
    'loading.generating': 'Génération en cours…',
    'loading.restoring': 'Restauration de la session…',
    'loading.ocr': 'OCR page {current} / {total}…',

    'toast.noValidFiles': 'Aucun fichier PDF ou image valide sélectionné.',
    'toast.readError': 'Impossible de lire un fichier : {error}',
    'toast.imageExportError': "Impossible d'exporter cette page en image.",
    'toast.previewError': "Impossible de générer l'aperçu de cette page.",
    'toast.exportDone': 'Export terminé.',
    'toast.exportError': "Erreur lors de l'export.",
    'toast.nothingToExport': 'Rien à exporter.',
    'toast.sessionRestored': 'Session précédente restaurée.',
    'toast.sessionUnreadable': 'Session précédente illisible, elle a été ignorée.',
    'toast.sessionNotSaved': 'Session non sauvegardée (stockage saturé ?).',

    'caption.pageOf': '{label} - page {index} / {total}',
  },

  en: {
    'app.subtitle': 'Merge, convert and clean up your PDFs. Everything stays on your machine, no file is sent anywhere.',
    'action.undo': 'Undo (Ctrl+Z)',
    'action.redo': 'Redo (Ctrl+Y)',
    'action.clearAll': 'Clear all',
    'action.addFiles': '+ Add files',
    'lang.label': 'Language',

    'dropzone.title': 'Drag and drop your PDF or image files here',
    'dropzone.hint': 'or click to browse - PDF, PNG, JPEG, WebP - multiple files allowed',

    'toolbar.selectAll': 'Select all',
    'toolbar.invert': 'Invert',
    'toolbar.insertBlank': '+ Blank page',
    'toolbar.zoomLabel': 'Thumbnail size',
    'panel.hint': 'Drag a thumbnail to reorder - tick or click-drag to select',

    'sel.rotateLeft': 'Rotate left',
    'sel.rotateRight': 'Rotate right',
    'sel.duplicate': 'Duplicate',
    'sel.delete': 'Delete',
    'sel.deselect': 'Deselect',

    'empty.message': 'All pages have been removed.',
    'exportbar.button': 'Export…',

    'export.title': 'Export',
    'common.close': 'Close',
    'common.cancel': 'Cancel',
    'export.legend': 'What do you want to export?',
    'export.mode.merge': 'Merge the whole document',
    'export.mode.selection': 'Extract the selection only',
    'export.mode.split': 'Split: one PDF per source document (ZIP)',
    'export.mode.images': 'Export pages as images (ZIP)',
    'export.mode.ocr': 'Make the PDF searchable (OCR)',
    'export.filename': 'File name',
    'export.filenameZip': 'ZIP archive name',
    'export.do': 'Export',

    'opt.compress': 'Compress',
    'opt.resolution': 'Resolution',
    'dpi.light': '96 dpi (light)',
    'dpi.balanced': '150 dpi (balanced)',
    'dpi.sharp': '220 dpi (sharp)',
    'dpi.300': '300 dpi',
    'opt.jpegQuality': 'JPEG quality',
    'opt.number': 'Number the pages',
    'opt.position': 'Position',
    'pos.bottomCenter': 'Bottom center',
    'pos.bottomRight': 'Bottom right',
    'pos.bottomLeft': 'Bottom left',
    'pos.topCenter': 'Top center',
    'pos.topRight': 'Top right',
    'pos.topLeft': 'Top left',
    'opt.startAt': 'Start at',
    'opt.showTotal': 'Show "n / total"',
    'opt.watermark': 'Watermark',
    'opt.text': 'Text',
    'opt.opacity': 'Opacity',
    'opt.metadata': 'Metadata (title, author)',
    'opt.metaTitle': 'Title',
    'opt.metaAuthor': 'Author',
    'opt.format': 'Format',
    'fmt.pngLossless': 'PNG (lossless)',
    'fmt.jpegLighter': 'JPEG (lighter)',

    'ocr.langLabel': 'Text language',
    'ocr.lang.auto': 'Auto (matches app)',
    'ocr.lang.fra': 'Français',
    'ocr.lang.eng': 'English',
    'ocr.lang.both': 'Français + English',
    'ocr.note': 'OCR adds a selectable text layer under each page. Runs locally, may take a few seconds per page.',

    'blank.title': 'Insert a blank page',
    'blank.format': 'Format',
    'blank.a4': 'A4',
    'blank.letter': 'US Letter',
    'blank.orientation': 'Orientation',
    'blank.portrait': 'Portrait',
    'blank.landscape': 'Landscape',
    'blank.position': 'Position',
    'blank.atEnd': 'At the end',
    'blank.afterSelection': 'After the selection',
    'blank.insert': 'Insert',

    'preview.close': 'Close preview',
    'preview.prev': 'Previous page',
    'preview.next': 'Next page',

    'card.preview': 'Preview large',
    'card.rotateLeft': 'Rotate left',
    'card.rotateRight': 'Rotate right',
    'card.duplicate': 'Duplicate',
    'card.exportImage': 'Export as image',
    'card.delete': 'Delete this page',
    'card.selectAria': 'Select this page',
    'badge.image': 'Image',
    'badge.blank': 'Blank',
    'label.blankPage': 'Blank page',

    'loading.default': 'Working…',
    'loading.importing': 'Importing…',
    'loading.rotating': 'Rotating…',
    'loading.preview': 'Loading preview…',
    'loading.imageGen': 'Generating image…',
    'loading.generating': 'Generating…',
    'loading.restoring': 'Restoring session…',
    'loading.ocr': 'OCR page {current} / {total}…',

    'toast.noValidFiles': 'No valid PDF or image file selected.',
    'toast.readError': 'Could not read a file: {error}',
    'toast.imageExportError': 'Could not export this page as an image.',
    'toast.previewError': 'Could not generate the preview for this page.',
    'toast.exportDone': 'Export complete.',
    'toast.exportError': 'Error during export.',
    'toast.nothingToExport': 'Nothing to export.',
    'toast.sessionRestored': 'Previous session restored.',
    'toast.sessionUnreadable': 'Previous session unreadable, it was ignored.',
    'toast.sessionNotSaved': 'Session not saved (storage full?).',

    'caption.pageOf': '{label} - page {index} / {total}',
  },
};

const FALLBACK = 'en';
let current = FALLBACK;

function safeGet(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}
function safeSet(key, val) {
  try { localStorage.setItem(key, val); } catch (_) { /* stockage indisponible */ }
}

/** Détecte la langue : préférence enregistrée, sinon langue du système (fr -> fr, sinon en). */
export function detectLang() {
  const stored = safeGet('ptn2pdf.lang');
  if (stored && DICT[stored]) return stored;
  const nav = (navigator.language || navigator.userLanguage || FALLBACK).toLowerCase();
  return nav.startsWith('fr') ? 'fr' : 'en';
}

export function getLang() {
  return current;
}

export function setLang(lang) {
  current = DICT[lang] ? lang : FALLBACK;
  safeSet('ptn2pdf.lang', current);
  document.documentElement.lang = current;
  applyStatic();
}

/** Traduit une clé, avec substitution optionnelle de {variables}. */
export function t(key, vars) {
  let s = (DICT[current] && DICT[current][key]) ?? DICT[FALLBACK][key] ?? key;
  if (vars) for (const k in vars) s = s.split(`{${k}}`).join(vars[k]);
  return s;
}

/** Compteurs avec pluriel correct par langue. */
export function tCount(kind, n) {
  const frMany = n > 1;
  const enMany = n !== 1;
  if (current === 'fr') {
    if (kind === 'pages') return `${n} page${frMany ? 's' : ''}`;
    if (kind === 'selected') return `${n} page${frMany ? 's' : ''} sélectionnée${frMany ? 's' : ''}`;
    if (kind === 'ready') return `${n} page${frMany ? 's' : ''} prête${frMany ? 's' : ''} à l'export`;
  } else {
    if (kind === 'pages') return `${n} page${enMany ? 's' : ''}`;
    if (kind === 'selected') return `${n} page${enMany ? 's' : ''} selected`;
    if (kind === 'ready') return `${n} page${enMany ? 's' : ''} ready to export`;
  }
  return String(n);
}

/** Applique les traductions aux éléments statiques marqués data-i18n*. */
export function applyStatic(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((elm) => { elm.textContent = t(elm.dataset.i18n); });
  root.querySelectorAll('[data-i18n-title]').forEach((elm) => { elm.title = t(elm.dataset.i18nTitle); });
  root.querySelectorAll('[data-i18n-aria]').forEach((elm) => { elm.setAttribute('aria-label', t(elm.dataset.i18nAria)); });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((elm) => { elm.placeholder = t(elm.dataset.i18nPlaceholder); });
}

/** Initialise la langue courante (à appeler au démarrage). */
export function initLang() {
  current = detectLang();
  document.documentElement.lang = current;
  applyStatic();
  return current;
}
