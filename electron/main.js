const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const PORT = 5501;

const LOG_PATH = path.join(app.getPath('temp'), 'ptn2pdf-debug.log');
function log(msg) {
  try {
    fs.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (_) {
    // ignore
  }
}

process.on('uncaughtException', (err) => {
  log('UNCAUGHT EXCEPTION: ' + (err && err.stack ? err.stack : err));
});
process.on('unhandledRejection', (reason) => {
  log('UNHANDLED REJECTION: ' + (reason && reason.stack ? reason.stack : reason));
});

log('main.js starting, ROOT=' + ROOT);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip',
  '.traineddata': 'application/octet-stream',
};

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent(req.url.split('?')[0]);
      if (urlPath === '/') urlPath = '/index.html';
      const filePath = path.join(ROOT, urlPath);

      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.on('error', reject);
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

let mainWindow;

async function createWindow() {
  log('createWindow: starting server...');
  try {
    await startServer();
    log('createWindow: server started on port ' + PORT);
  } catch (err) {
    log('createWindow: server FAILED to start: ' + (err && err.stack ? err.stack : err));
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    icon: path.join(ROOT, 'assets', 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    log(`RENDERER CONSOLE[${level}] ${message} (${sourceId}:${line})`);
  });
  mainWindow.webContents.on('did-fail-load', (event, code, desc, url) => {
    log(`did-fail-load code=${code} desc=${desc} url=${url}`);
  });
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    log('render-process-gone: ' + JSON.stringify(details));
  });

  log('createWindow: loading URL...');
  mainWindow.loadURL(`http://127.0.0.1:${PORT}/index.html`);
}

app.whenReady().then(() => {
  log('app ready');
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
