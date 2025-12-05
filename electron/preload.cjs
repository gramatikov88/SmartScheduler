const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    readFile: (filename) => ipcRenderer.invoke('read-file', filename),
    writeFile: (filename, data) => ipcRenderer.invoke('write-file', filename, data),
    saveProject: (data) => ipcRenderer.invoke('save-project', data),
    loadProject: () => ipcRenderer.invoke('load-project'),
});
