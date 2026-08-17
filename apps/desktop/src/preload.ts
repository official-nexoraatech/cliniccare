import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('clinicCare', {
  platform: process.platform,
  version: process.env.npm_package_version ?? '0.0.1',
});
