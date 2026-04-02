const { app, BrowserWindow, shell, Menu, dialog } = require('electron');
const path = require('path');
const semver = require('semver');
const { startServer } = require('./server.js');

let serverClose = null;
let serverReady = null;

/** @type {boolean} */
let pendingManualNsisCheck = false;
let nsisUpdaterListenersRegistered = false;

function rootDirForApp() {
  if (!app.isPackaged) return __dirname;
  return path.join(process.resourcesPath, 'app.asar');
}

function envPathForApp() {
  if (!app.isPackaged) return path.join(__dirname, '.env');
  return path.join(path.dirname(app.getPath('exe')), '.env');
}

function getGithubRepoFromPackage() {
  try {
    const pkg = require('./package.json');
    const p = pkg.build && pkg.build.publish;
    const pub = Array.isArray(p) ? p[0] : p;
    if (pub && pub.provider === 'github' && pub.owner && pub.repo) {
      return { owner: pub.owner, repo: pub.repo };
    }
  } catch (_) {
    /* ignore */
  }
  return null;
}

function ensureServer() {
  if (!serverReady) {
    serverReady = startServer({
      rootDir: rootDirForApp(),
      envPath: envPathForApp(),
      quiet: app.isPackaged,
    }).then((info) => {
      serverClose = info.close;
      return info.port;
    });
  }
  return serverReady;
}

async function createWindow() {
  const port = await ensureServer();
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  await win.loadURL(`http://localhost:${port}/`);
}

function setupHelpMenu() {
  const template = [
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates…',
          click: () => {
            void runUpdateCheck({ manual: true });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/**
 * Portable build: compare to GitHub Releases (electron-updater does not update portable exe).
 * @param {{ manual: boolean }} opts
 */
async function checkPortableGithubRelease(opts) {
  const repo = getGithubRepoFromPackage();
  if (!repo) return;

  const current = app.getVersion();
  const url = `https://api.github.com/repos/${repo.owner}/${repo.repo}/releases/latest`;
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'f1-setup-manager' },
  });
  if (!res.ok) {
    if (opts.manual) {
      await dialog.showMessageBox({
        type: 'warning',
        title: 'Updates',
        message: `Could not check for updates (GitHub ${res.status}). Try again later.`,
      });
    }
    return;
  }

  const data = await res.json();
  const tag = String(data.tag_name || '').replace(/^v/i, '');
  if (!semver.valid(tag)) {
    if (opts.manual) {
      await dialog.showMessageBox({
        type: 'info',
        title: 'Updates',
        message: 'Could not read the latest release version from GitHub.',
      });
    }
    return;
  }

  if (!semver.gt(tag, current)) {
    if (opts.manual) {
      await dialog.showMessageBox({
        type: 'info',
        title: 'Updates',
        message: `You’re on the latest version (${current}).`,
      });
    }
    return;
  }

  const openUrl = data.html_url || `https://github.com/${repo.owner}/${repo.repo}/releases`;
  const { response } = await dialog.showMessageBox({
    type: 'info',
    buttons: ['Open download page', 'Later'],
    defaultId: 0,
    cancelId: 1,
    title: 'Update available',
    message: `Version ${tag} is available (you have ${current}). Download the new portable build from GitHub.`,
  });
  if (response === 0) shell.openExternal(openUrl);
}

function registerNsisAutoUpdaterListeners() {
  if (nsisUpdaterListenersRegistered) return;
  nsisUpdaterListenersRegistered = true;

  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = true;

  autoUpdater.on('error', (err) => {
    console.error('[updater]', err);
    if (pendingManualNsisCheck) {
      pendingManualNsisCheck = false;
      dialog.showErrorBox('Update check failed', err.message || String(err));
    }
  });

  autoUpdater.on('update-not-available', () => {
    if (pendingManualNsisCheck) {
      pendingManualNsisCheck = false;
      void dialog.showMessageBox({
        type: 'info',
        title: 'Updates',
        message: `You’re on the latest version (${app.getVersion()}).`,
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    pendingManualNsisCheck = false;
    void dialog
      .showMessageBox({
        type: 'info',
        buttons: ['Restart now', 'Later'],
        defaultId: 0,
        cancelId: 1,
        title: 'Update ready',
        message: `Version ${info.version} is downloaded. Restart to install?`,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall(false, true);
        }
      });
  });
}

/**
 * @param {{ manual: boolean }} opts
 */
async function runUpdateCheck(opts) {
  if (!app.isPackaged) return;

  if (process.env.PORTABLE_EXECUTABLE_FILE) {
    await checkPortableGithubRelease(opts).catch((e) => {
      console.error('[update]', e);
      if (opts.manual) {
        void dialog.showMessageBox({
          type: 'warning',
          title: 'Updates',
          message: e.message || 'Update check failed.',
        });
      }
    });
    return;
  }

  registerNsisAutoUpdaterListeners();
  const { autoUpdater } = require('electron-updater');
  pendingManualNsisCheck = opts.manual;
  try {
    await autoUpdater.checkForUpdates();
  } catch (e) {
    pendingManualNsisCheck = false;
    console.error('[updater]', e);
    if (opts.manual) {
      await dialog.showMessageBox({
        type: 'warning',
        title: 'Updates',
        message: e.message || 'Update check failed.',
      });
    }
  }
}

function initUpdates() {
  if (!app.isPackaged) return;
  setupHelpMenu();
  void runUpdateCheck({ manual: false });
}

app
  .whenReady()
  .then(async () => {
    await createWindow();
    initUpdates();
  })
  .catch((err) => {
    console.error(err);
    app.quit();
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch(console.error);
  }
});

app.on('before-quit', async (e) => {
  if (!serverClose) return;
  e.preventDefault();
  const close = serverClose;
  serverClose = null;
  serverReady = null;
  try {
    await close();
  } catch (err) {
    console.error(err);
  }
  app.quit();
});
