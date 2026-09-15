<div align="center">
  <img src="assets/icon.svg" width="72" height="72" alt="Logo PTN2PDF" />
  <h1>PTN2PDF</h1>
  <p><strong>Fusionnez, réordonnez et nettoyez vos PDF. Tout reste sur votre machine, aucun fichier n'est envoyé nulle part.</strong></p>
</div>

---

PTN2PDF est un petit outil de manipulation de PDF **100 % local**. Aucun serveur distant, aucun envoi de fichier : tout le traitement se fait dans votre navigateur (ou dans l'application de bureau). Idéal pour assembler rapidement plusieurs documents sans les confier à un service en ligne.

## Fonctionnalités

- **Import multiple** : glissez-déposez plusieurs PDF ou parcourez vos fichiers.
- **Vignettes de toutes les pages** : chaque page est rendue en aperçu (via pdf.js).
- **Réorganisation par glisser-déposer** : changez l'ordre des pages à la souris.
- **Rotation** : pivotez une page ou une sélection à gauche / à droite.
- **Suppression** : retirez les pages inutiles, une par une ou par lot.
- **Sélection multiple** : cases à cocher, clic + Shift (plage), clic + Ctrl (ajout), et sélection au lasso (marquee).
- **Aperçu grand format** : ouvrez une page en grand dans une fenêtre modale.
- **Code couleur par document source** : repérez d'un coup d'œil de quel fichier provient chaque page.
- **Export fusionné** : générez un PDF unique regroupant toutes les pages, dans l'ordre choisi (via pdf-lib).
- **Raccourcis clavier** : `Suppr` pour supprimer la sélection, `Échap` pour désélectionner ou fermer l'aperçu.

## Utilisation

### Option 1 : version portable (Windows)

Téléchargez le `.exe` depuis la page [Releases](https://github.com/MrGautier256/PTN2PDF/releases), puis lancez-le. Aucune installation requise.

### Option 2 : dans le navigateur

Un petit serveur statique PowerShell est fourni (nécessaire car l'app utilise des modules ES).

```bat
start.bat
```

Le script démarre le serveur puis ouvre `http://localhost:5500` dans votre navigateur.

### Option 3 : application de bureau (développement)

```bash
npm install
npm run electron:start
```

## Compiler l'exécutable

```bash
npm run dist
```

Ou double-cliquez sur `build.bat`. L'exécutable portable est généré dans le dossier `release/`.

## Pile technique

| Rôle | Outil |
| --- | --- |
| Rendu des pages PDF | [pdf.js](https://mozilla.github.io/pdf.js/) |
| Manipulation / export PDF | [pdf-lib](https://pdf-lib.js.org/) |
| Glisser-déposer | [SortableJS](https://sortablejs.github.io/Sortable/) |
| Application de bureau | [Electron](https://www.electronjs.org/) + [electron-builder](https://www.electron.build/) |
| Interface | HTML, CSS et JavaScript natif (modules ES), sans framework |

Les bibliothèques front-end sont vendorisées dans `vendor/` pour un fonctionnement 100 % hors ligne.

## Structure du projet

```
PTN2PDF/
├── index.html          # Interface
├── css/style.css       # Styles (thème clair / sombre automatique)
├── js/app.js           # Logique de l'application
├── vendor/             # Bibliothèques (pdf.js, pdf-lib, SortableJS)
├── assets/             # Icônes
├── electron/main.js    # Application de bureau Electron
├── serve.ps1           # Serveur statique local (PowerShell)
├── start.bat           # Lance le serveur + le navigateur
└── build.bat           # Génère l'exécutable portable
```

## Confidentialité

Aucune donnée ne quitte votre appareil. Les PDF sont lus, traités et réexportés localement, que ce soit dans le navigateur ou dans l'application Electron (qui sert les fichiers depuis un serveur local `127.0.0.1`).

## Licence

ISC
