import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@clinic-care/shared-types': path.resolve(
        import.meta.dirname,
        '../../packages/shared-types/src/index.ts',
      ),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
