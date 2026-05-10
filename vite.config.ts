import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: './src/index.ts', // Il tuo file sorgente principale
      name: 'G2Chronicles',
      fileName: 'index',
      formats: ['es'] // Formato EcmaScript, richiesto dai G2
    },
    outDir: 'dist',
    emptyOutDir: true
  }
});