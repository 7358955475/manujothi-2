import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import compression from 'vite-plugin-compression';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    compression({
      algorithm: 'gzip',
      threshold: 1024,
    }),
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024,
    })
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    allowedHosts: ['.ngrok-free.app'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'pdf-viewer': ['@react-pdf-viewer/core', '@react-pdf-viewer/default-layout'],
          'motion': ['framer-motion'],
          'icons': ['lucide-react'],
          'utils': ['axios']
        }
      }
    },
    chunkSizeWarningLimit: 500,
    sourcemap: false,
    minify: 'esbuild',
    reportCompressedSize: false,
    assetsInlineLimit: 4096
  }
});
