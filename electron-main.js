const { app, BrowserWindow, Menu, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let mainWindow;
let serverProcess;

function startServer() {
  const serverPath = path.join(__dirname, 'server', 'index.js');
  serverProcess = spawn(process.execPath, [serverPath], {
    env: { ...process.env },
    stdio: 'inherit'
  });
  serverProcess.on('error', (err) => {
    console.error('Server process error:', err);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Ollama UI',
    backgroundColor: '#0d1117',
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
        { label: 'Open in Browser', click: () => shell.openExternal('http://localhost:3838') },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow.reload() },
        { label: 'Toggle DevTools', accelerator: 'F12', click: () => mainWindow.webContents.toggleDevTools() }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);

  // Give the server a moment to start before loading
  setTimeout(() => mainWindow.loadURL('http://localhost:3838'), 1500);

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  startServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
