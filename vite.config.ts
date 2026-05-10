import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Ensures relative paths for assets in the Even App WebView
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'esbuild', // Faster and built-in
    sourcemap: false,
  },
});
