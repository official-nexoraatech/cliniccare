import axios from 'axios';
import { useAuthStore } from '@/store/auth-store';

// VITE_API_URL is set at build time when the web app is deployed separately from the
// API (e.g. Vercel + Render, different origins) — point it at the Render API's public
// URL. If unset: production same-origin deployments (API serves web/dist itself, see
// apps/api/src/main.ts) use a relative path; dev talks to the local API on 4100.
// .replace() strips any trailing slash — a trailing slash in the VITE_API_URL env var
// (easy to accidentally include when copy-pasting a host URL) would otherwise produce
// double-slash paths like "https://api.example.com//api/auth/login".
export const SERVER_ORIGIN = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/+$/, '')
  : import.meta.env.PROD
    ? ''
    : 'http://localhost:4100';
export const API_BASE_URL = `${SERVER_ORIGIN}/api`;

/** Resolves a server-relative path (e.g. a document's `/files/...` path) to a full URL.
 * Clinic branding (logo/letterhead) is stored as a data: URL in Mongo instead of a disk path
 * — Render's filesystem isn't persistent across redeploys — so those pass through unchanged. */
export function resolveServerUrl(path: string): string {
  if (/^(data:|https?:\/\/)/.test(path)) return path;
  return `${SERVER_ORIGIN}${path}`;
}

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);
