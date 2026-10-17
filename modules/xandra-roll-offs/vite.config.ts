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
    target: 'es2022',
    rolldownOptions: {
      input: fileURLToPath(new URL('./src/main.tsx', import.meta.url)),
      output: {
        codeSplitting: false,
        entryFileNames: 'scripts/main.js',
        assetFileNames: (asset) =>
          asset.name?.endsWith('.css')
            ? 'styles/xandra-roll-offs.css'
            : 'assets/[name]-[hash][extname]'
      }
    }
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.tsx', 'tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts']
  }
});
