const { contextBridge, ipcRenderer, shell } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => ipcRenderer.invoke('app:version'),
  getPlatform: () => ipcRenderer.invoke('app:platform'),

  // Open URL in external browser
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),

  // SSO deep link — receive token from PCI
  onSSOToken: (callback) => {
    const handler = (_, token) => callback(token);
    ipcRenderer.on('auth:sso-token', handler);
    return handler;
  },
  removeSSOListener: (handler) => {
    ipcRenderer.removeListener('auth:sso-token', handler);
  },

  // Auto-updater progress
  onUpdateProgress: (callback) => {
    ipcRenderer.on('updater:progress', (_, percent) => callback(percent));
  },
});
