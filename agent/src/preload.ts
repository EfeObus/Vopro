import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('vopro', {
  status: () => ipcRenderer.invoke('vopro:status'),
  record: (input: unknown) => ipcRenderer.invoke('vopro:record', input),
  flush: () => ipcRenderer.invoke('vopro:flush'),
  setCapture: (enabled: boolean) => ipcRenderer.invoke('vopro:setCapture', enabled),
});
