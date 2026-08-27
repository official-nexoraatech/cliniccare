import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import path from 'node:path';
import { fork, ChildProcess } from 'node:child_process';
import log from 'electron-log';
import { type AppConfig, clearConfig, generateJwtSecret, readConfig, writeConfig } from './config';
import { SETUP_HTML } from './setup-page';

const isDev = !app.isPackaged;
const DEV_WEB_URL = 'http://localhost:5173';
const API_PORT = 4100;
const DEFAULT_LOCAL_DATABASE_URL = 'mongodb://127.0.0.1:27017/clinic_care?replicaSet=rs0';

let mainWindow: BrowserWindow | null = null;
let setupWindow: BrowserWindow | null = null;
let apiProcess: ChildProcess | null = null;

async function waitForApiReady(timeoutMs = 30000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${API_PORT}/api/clinic`, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) return true;
    } catch {
      // API not up yet (still starting, or Mongo isn't reachable) — keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

// Runs a script to completion using Electron's own bundled Node runtime (fork() from the
// main process spawns Electron.exe itself acting as plain Node — no system Node.js install
// required, which a clinic's Windows machine won't have). Used for the one-shot bootstrap
// steps below; the long-running API server is forked separately in startApiServer.
function runToCompletion(entry: string, args: string[], env: NodeJS.ProcessEnv): Promise<boolean> {
  return new Promise((resolve) => {
    const child = fork(entry, args, { env, silent: true, cwd: path.dirname(entry) });
    child.stdout?.on('data', (chunk) => log.info(`[bootstrap] ${chunk}`));
    child.stderr?.on('data', (chunk) => log.error(`[bootstrap] ${chunk}`));
    child.on('exit', (code) => resolve(code === 0));
  });
}

// In dev, the api server is already started separately by `npm run dev` at the root (see
// package.json's `start:dev -w apps/api`) and talks to a dev-configured DATABASE_URL/.env —
// this whole function is a no-op there. In a packaged build there is no separate process or
// .env for it, so this: (1) bootstraps a possibly-fresh local Mongo — db push (create
// collections/indexes if missing), the one index Prisma's schema can't express, then seed
// (default roles + admin user) — all idempotent, safe to run on every launch, not just the
// first; (2) forks the compiled Nest server itself with this Host's generated JWT secret
// (see config.ts) and a DATABASE_URL pointed at the local Mongo replica set.
async function startApiServer(config: Extract<AppConfig, { role: 'HOST' }>): Promise<boolean> {
  if (isDev) return true;

  const stagedApiDir = path.join(process.resourcesPath, 'api');
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(API_PORT),
    NODE_ENV: 'production',
    DATABASE_URL: process.env.DATABASE_URL ?? DEFAULT_LOCAL_DATABASE_URL,
    JWT_SECRET: config.jwtSecret,
    JWT_EXPIRES_IN: '12h',
  };

  const prismaCli = path.join(stagedApiDir, 'node_modules', 'prisma', 'build', 'index.js');
  const schemaPath = path.join(stagedApiDir, 'prisma', 'schema.prisma');
  const pushed = await runToCompletion(prismaCli, ['db', 'push', `--schema=${schemaPath}`, '--skip-generate'], env);
  if (!pushed) {
    log.error('prisma db push failed — is MongoDB running as a replica set? See HOST_MONGO_SETUP.md');
    return false;
  }
  await runToCompletion(path.join(stagedApiDir, 'dist', 'database', 'ensure-mongo-indexes.js'), [], env);
  await runToCompletion(path.join(stagedApiDir, 'dist', 'database', 'seed.js'), [], env);

  const apiEntry = path.join(stagedApiDir, 'dist', 'main.js');
  apiProcess = fork(apiEntry, [], { env, silent: true });
  apiProcess.stdout?.on('data', (chunk) => log.info(`[api] ${chunk}`));
  apiProcess.stderr?.on('data', (chunk) => log.error(`[api] ${chunk}`));

  return waitForApiReady();
}

async function createMainWindow(config: AppConfig) {
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

  if (config.role === 'HOST') {
    if (isDev) {
      mainWindow.loadURL(DEV_WEB_URL);
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
      // The Host's own forked API process serves the built web app itself (see
      // apps/api/src/main.ts — it serves apps/web/dist from the same port as /api), so
      // this is exactly the same kind of load a Client does, just against localhost.
      mainWindow.loadURL(`http://localhost:${API_PORT}`);
    }
  } else {
    // Client machines run no local API/DB at all — this window is just a browser
    // pointed at the Host's same-origin build (API + web served from one port there),
    // so no separate web bundle or CORS setup is needed on the client.
    mainWindow.loadURL(config.hostUrl);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  buildAppMenu();
}

function buildAppMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'ClinicCare',
      submenu: [
        {
          label: 'Change Host/Client Setup...',
          click: () => {
            clearConfig();
            mainWindow?.close();
            apiProcess?.kill();
            apiProcess = null;
            showSetupWindow();
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function showSetupWindow() {
  setupWindow = new BrowserWindow({
    width: 460,
    height: 420,
    resizable: false,
    title: 'ClinicCare Setup',
    webPreferences: {
      preload: path.join(__dirname, 'setup-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  setupWindow.setMenuBarVisibility(false);
  setupWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(SETUP_HTML)}`);
  setupWindow.on('closed', () => {
    setupWindow = null;
  });
}

async function proceedWithConfig(config: AppConfig) {
  setupWindow?.close();
  if (config.role === 'HOST') {
    const ready = await startApiServer(config);
    if (!ready) log.error('API server did not become ready in time — is MongoDB running? See HOST_MONGO_SETUP.md');
  }
  createMainWindow(config);
}

// 5xx or a thrown network error mean nothing valid answered; a 401 (needs login) or
// 404 still proves a ClinicCare server is actually listening at that address.
ipcMain.handle('setup:test-connection', async (_event, hostIp: string): Promise<boolean> => {
  try {
    const res = await fetch(`http://${hostIp}:${API_PORT}/api/clinic`, { signal: AbortSignal.timeout(4000) });
    return res.status < 500;
  } catch {
    return false;
  }
});

ipcMain.handle('setup:choose-host', () => {
  const config: AppConfig = { role: 'HOST', jwtSecret: generateJwtSecret() };
  writeConfig(config);
  proceedWithConfig(config);
});

ipcMain.handle('setup:choose-client', (_event, hostIp: string) => {
  const config: AppConfig = { role: 'CLIENT', hostUrl: `http://${hostIp}:${API_PORT}` };
  writeConfig(config);
  proceedWithConfig(config);
});

// Lets the web app (via preload.ts's window.clinicCare bridge) know whether it's running on
// the Host or a Client — used to hide the Backup & Sync settings tab on Client machines,
// which have no local Mongo of their own to back up.
ipcMain.handle('config:get-role', () => readConfig()?.role ?? null);

async function launchFromSavedConfigOrSetup() {
  const config = readConfig();
  if (config) {
    if (config.role === 'HOST') {
      const ready = await startApiServer(config);
      if (!ready) log.error('API server did not become ready in time — is MongoDB running? See HOST_MONGO_SETUP.md');
    }
    createMainWindow(config);
  } else {
    showSetupWindow();
  }
}

app.whenReady().then(() => {
  launchFromSavedConfigOrSetup();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) launchFromSavedConfigOrSetup();
  });
});

app.on('window-all-closed', () => {
  apiProcess?.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  apiProcess?.kill();
});
