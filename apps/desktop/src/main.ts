import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fork, ChildProcess } from 'node:child_process';
import log from 'electron-log';

const isDev = !app.isPackaged;
const DEV_WEB_URL = 'http://localhost:5173';

let mainWindow: BrowserWindow | null = null;
let apiProcess: ChildProcess | null = null;

function startApiServer() {
  // In dev, the api server is already started separately by `npm run dev` at the root
  // (see package.json's `start:dev -w apps/api`). In a packaged build there is no
  // separate process for it, so Electron forks the compiled Nest server itself.
  if (isDev) return;

  const apiEntry = path.join(process.resourcesPath, 'api', 'main.js');
  apiProcess = fork(apiEntry, [], {
    env: { ...process.env, PORT: '4100' },
    silent: true,
  });
  apiProcess.stdout?.on('data', (chunk) => log.info(`[api] ${chunk}`));
  apiProcess.stderr?.on('data', (chunk) => log.error(`[api] ${chunk}`));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: 'ClinicCare',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL(DEV_WEB_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(process.resourcesPath, 'web', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startApiServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  apiProcess?.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  apiProcess?.kill();
});
