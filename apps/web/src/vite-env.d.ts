/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set at build time when the web app is deployed separately from the API (e.g. Vercel + Render). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
