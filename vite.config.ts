import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './', // relative paths: deployable under any sub-path (GitHub Pages etc.)
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: { manualChunks: (id: string) => (id.includes('node_modules/phaser') ? 'phaser' : id.includes('node_modules/peerjs') ? 'peerjs' : undefined) },
    },
  },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
