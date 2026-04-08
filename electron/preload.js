const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => ipcRenderer.invoke('app:version'),
  getPlatform: () => ipcRenderer.invoke('app:platform'),

  // SSO auth — listen for token from deep link
  onSSOToken: (callback) => {
    ipcRenderer.on('auth:sso-token', (event, token) => callback(token));
  },

  // Remove listener on cleanup
  removeSSOListener: () => {
    ipcRenderer.removeAllListeners('auth:sso-token');
  },
});
