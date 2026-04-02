const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('f1DesktopApiKey', {
  /** @returns {string} */
  getSync() {
    try {
      return ipcRenderer.sendSync('f1-api-key-get-sync');
    } catch {
      return '';
    }
  },
  /** @param {string} key */
  set(key) {
    return ipcRenderer.invoke('f1-api-key-set', key);
  },
  clear() {
    return ipcRenderer.invoke('f1-api-key-clear');
  },
});
