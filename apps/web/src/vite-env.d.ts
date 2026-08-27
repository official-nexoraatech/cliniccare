/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set at build time when the web app is deployed separately from the API (e.g. Vercel + Render). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Exposed by apps/desktop/src/preload.ts when running inside the Electron shell — absent
// entirely when the web app is opened in a plain browser (e.g. local dev at :5173).
interface Window {
  clinicCare?: {
    platform: string;
    version: string;
    getRole: () => Promise<'HOST' | 'CLIENT' | null>;
  };
}
