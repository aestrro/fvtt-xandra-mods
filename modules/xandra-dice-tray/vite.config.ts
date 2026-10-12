import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  build: {
    cssCodeSplit: false,
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'oxc',
    sourcemap: false,
    target: 'es2022',
    rolldownOptions: {
      input: fileURLToPath(new URL('./src/main.tsx', import.meta.url)),
      output: {
        codeSplitting: false,
        entryFileNames: 'scripts/main.js',
        assetFileNames: (assetInfo) =>
          assetInfo.name?.endsWith('.css')
            ? 'styles/xandra-dice-tray.css'
            : 'assets/[name]-[hash][extname]'
      }
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts']
  }
});
