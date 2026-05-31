import { fileURLToPath } from 'node:url';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@app', replacement: path.resolve(__dirname, 'src') },
      {
        find: /^@gbedity\/ui$/,
        replacement: path.resolve(__dirname, '../../packages/ui/src/index.ts'),
      },
      {
        find: '@gbedity/ui/styles.css',
        replacement: path.resolve(__dirname, '../../packages/ui/src/styles.css'),
      },
      {
        find: /^@icons$/,
        replacement: path.resolve(__dirname, '../../packages/icons/src/index.ts'),
      },
      {
        find: /^@gbedity\/icons$/,
        replacement: path.resolve(__dirname, '../../packages/icons/src/index.ts'),
      },
    ],
  },
  server: {
    port: 5173,
    strictPort: false,
    // Allow tunneling the dev server (e.g. ngrok) onto a phone. Free ngrok hosts rotate on every
    // restart, so allow the whole subdomain rather than pinning one ephemeral host.
    allowedHosts: ['.ngrok-free.app', '.ngrok.io', '.ngrok.app'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
});
