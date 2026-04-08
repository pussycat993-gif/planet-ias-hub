const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

// Register iashub:// deep link protocol
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('iashub', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('iashub');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 1024,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1565c0',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../client/public/icon.png'),
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../client/dist/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// Handle SSO deep link on macOS
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

// Handle SSO deep link on Windows/Linux (second instance)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    // Extract URL from command line args (Windows/Linux)
    const url = commandLine.find(arg => arg.startsWith('iashub://'));
    if (url) handleDeepLink(url);
  });
}

function handleDeepLink(url) {
  try {
    const parsed = new URL(url);
    if (parsed.pathname === '//auth' || parsed.hostname === 'auth') {
      const token = parsed.searchParams.get('token');
      if (token && mainWindow) {
        mainWindow.webContents.send('auth:sso-token', token);
      }
    }
  } catch (err) {
    console.error('Deep link parse error:', err);
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// IPC handlers
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:platform', () => process.platform);
