import type { BrowserWindow } from 'electron';

interface SilentPrintOptions {
  deviceName?: string;
  silent?: boolean;
  copies?: number;
}

export function printWindow(window: BrowserWindow, options: SilentPrintOptions = {}) {
  return new Promise<void>((resolve, reject) => {
    window.webContents.print(
      {
        silent: options.silent ?? true,
        deviceName: options.deviceName,
        copies: options.copies ?? 1,
      },
      (success, errorType) => {
        if (success) resolve();
        else reject(new Error(errorType));
      },
    );
  });
}
