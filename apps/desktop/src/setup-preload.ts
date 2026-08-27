import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('clinicCareSetup', {
  chooseHost: (): Promise<void> => ipcRenderer.invoke('setup:choose-host'),
  chooseClient: (hostIp: string): Promise<void> => ipcRenderer.invoke('setup:choose-client', hostIp),
  testConnection: (hostIp: string): Promise<boolean> => ipcRenderer.invoke('setup:test-connection', hostIp),
});
