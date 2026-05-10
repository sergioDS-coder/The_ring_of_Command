import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Ensures relative paths for assets in the Even App WebView
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'terser', // Recommended for smaller plugin size
    sourcemap: false,
  },
});
