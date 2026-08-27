import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('clinicCare', {
  platform: process.platform,
  version: process.env.npm_package_version ?? '0.0.1',
  getRole: (): Promise<'HOST' | 'CLIENT' | null> => ipcRenderer.invoke('config:get-role'),
});
