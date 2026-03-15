const { app, BrowserWindow, Menu, shell } = require('electron');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

app.disableHardwareAcceleration();

// Enforce a single instance — second launch focuses the existing window
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

const SERVER_URL = 'http://127.0.0.1:3838';
const HEALTH_URL = `${SERVER_URL}/api/health`;
const STARTUP_TIMEOUT_MS = 30000;
const RETRY_INTERVAL_MS = 250;
const LOG_FILE = path.join(os.homedir(), '.ollamaui-data', 'electron-startup.log');

let mainWindow;
let serverStarted = false;

function appendLog(message) {
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${message}\n`);
  } catch {}
}

function showWindow() {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
    mainWindow.show();
  }
}

function startServer() {
  if (serverStarted) return;
  serverStarted = true;

  // Require the server directly in the main process so that in a packaged app
  // we never accidentally spawn process.execPath (the Electron binary) as a
  // child, which would create an infinite chain of new windows.
  appendLog(`Starting embedded server from ${path.join(__dirname, 'server', 'index.js')}`);
  require(path.join(__dirname, 'server', 'index.js'));
}

function probeServer() {
  return new Promise((resolve) => {
    const req = http.get(HEALTH_URL, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(timeoutMs = STARTUP_TIMEOUT_MS) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await probeServer()) return true;
    await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL_MS));
  }
  return false;
}

function startupErrorHtml(message) {
  const escaped = String(message)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>BTCMACHINE Startup Error</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        font-family: "Segoe UI", Arial, sans-serif;
        background: #0d1117;
        color: #e6edf3;
        display: grid;
        place-items: center;
        min-height: 100vh;
      }
      .card {
        width: min(720px, calc(100vw - 48px));
        border: 1px solid #30363d;
        border-radius: 16px;
        padding: 24px;
        background: #161b22;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
      }
      h1 {
        margin: 0 0 12px;
        font-size: 24px;
      }
      p {
        margin: 0 0 12px;
        line-height: 1.5;
        color: #c9d1d9;
      }
      code {
        display: block;
        margin-top: 16px;
        padding: 12px;
        border-radius: 10px;
        background: #0d1117;
        border: 1px solid #30363d;
        white-space: pre-wrap;
        word-break: break-word;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>BTCMACHINE could not finish starting</h1>
      <p>The desktop window waited for the local app server on <strong>${SERVER_URL}</strong>, but it never became ready.</p>
      <p>Close any old BTCMACHINE windows and try launching the latest build again. If it still fails, this message should help narrow down the startup error.</p>
      <code>${escaped}</code>
    </div>
  </body>
</html>`;
}

async function loadApp() {
  appendLog('Beginning Electron app load sequence');
  const alreadyRunning = await probeServer();
  let startupError = null;

  appendLog(`Probe before start: ${alreadyRunning ? 'server already reachable' : 'server not reachable yet'}`);

  if (!alreadyRunning) {
    try {
      startServer();
    } catch (error) {
      startupError = error;
      appendLog(`startServer() threw: ${error.name}: ${error.message}`);
    }
  }

  const ready = alreadyRunning || await waitForServer();
  if (ready) {
    appendLog(`Loading renderer from ${SERVER_URL}`);
    await mainWindow.loadURL(SERVER_URL);
    appendLog(`Renderer loaded ${mainWindow.webContents.getURL()}`);
    showWindow();
    return;
  }

  const detail = startupError
    ? `${startupError.name}: ${startupError.message}`
    : `Timed out after ${STARTUP_TIMEOUT_MS / 1000}s waiting for ${HEALTH_URL}`;

  appendLog(`Falling back to startup error page: ${detail}`);
  await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(startupErrorHtml(detail))}`);
  showWindow();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Ollama UI',
    backgroundColor: '#0d1117',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [{ label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Open in Browser', click: () => shell.openExternal(SERVER_URL) },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow.reload() },
        { label: 'Toggle DevTools', accelerator: 'F12', click: () => mainWindow.webContents.toggleDevTools() }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);

  mainWindow.webContents.on('did-start-loading', () => {
    appendLog(`did-start-loading: ${mainWindow.webContents.getURL() || 'about:blank'}`);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    appendLog(`did-finish-load: ${mainWindow.webContents.getURL() || 'about:blank'}`);
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    appendLog(`did-fail-load: code=${errorCode} description=${errorDescription} url=${validatedURL}`);
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    appendLog(`console-message: level=${level} source=${sourceId}:${line} message=${message}`);
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    appendLog(`render-process-gone: reason=${details.reason} exitCode=${details.exitCode}`);
  });

  mainWindow.on('unresponsive', () => {
    appendLog('window became unresponsive');
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  createWindow();
  await loadApp();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('second-instance', () => {
  if (!mainWindow) {
    createWindow();
    loadApp();
    return;
  }

  if (mainWindow.isMinimized()) mainWindow.restore();
  const currentUrl = mainWindow.webContents.getURL();
  if (!currentUrl || currentUrl === 'about:blank') {
    loadApp();
  } else {
    showWindow();
  }
  mainWindow.focus();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
    loadApp();
  }
});
