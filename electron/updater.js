const { autoUpdater } = require('electron-updater');
const { dialog, BrowserWindow } = require('electron');

module.exports = function setupUpdater(mainWindow) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `IAS Hub ${info.version} is available. Download now?`,
      buttons: ['Download', 'Later'],
    }).then(({ response }) => {
      if (response === 0) autoUpdater.downloadUpdate();
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('IAS Hub is up to date.');
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow.setProgressBar(progress.percent / 100);
    mainWindow.webContents.send('updater:progress', Math.round(progress.percent));
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow.setProgressBar(-1);
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'IAS Hub update downloaded. Restart now to apply?',
      buttons: ['Restart Now', 'Later'],
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
  });

  // Check for updates on startup (production only)
  if (process.env.NODE_ENV !== 'development') {
    setTimeout(() => autoUpdater.checkForUpdates(), 5000);
  }
};
