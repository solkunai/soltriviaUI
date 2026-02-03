import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProduction = mode === 'production';
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'global': 'globalThis',
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          // Polyfill Node.js crypto module for browser compatibility
          // Trezor and other wallet adapters need this
          'crypto': path.resolve(__dirname, 'src/utils/crypto-polyfill.ts'),
        },
        // Fix for valtio/vanilla subpath export resolution
        dedupe: ['valtio'],
        // Ensure proper resolution of package exports
        conditions: ['import', 'module', 'browser', 'default'],
      },
      optimizeDeps: {
        esbuildOptions: {
          define: {
            global: 'globalThis',
          },
        },
        include: [
          'buffer',
          'valtio',
        ],
        // Exclude problematic packages from optimization
        exclude: ['derive-valtio'],
      },
      publicDir: 'public',
      build: {
        minify: 'terser',
        terserOptions: {
          compress: {
            // Remove ALL console methods (log, error, warn, info, debug, trace, etc.)
            drop_console: true,
            // Remove debugger statements
            drop_debugger: true,
            // Additional pure functions to remove (redundant with drop_console, but explicit)
            pure_funcs: [
              'console.log',
              'console.info',
              'console.debug',
              'console.trace',
              'console.warn',
              'console.error',
              'console.table',
              'console.group',
              'console.groupEnd',
            ],
          },
          format: {
            // Remove all comments in production
            comments: false,
          },
        },
        // Suppress build warnings and fix module resolution
        rollupOptions: {
          onwarn(warning, warn) {
            // Suppress specific warnings if needed
            if (warning.code === 'UNUSED_EXTERNAL_IMPORT') return;
            // Suppress valtio resolution warnings (handled by optimizeDeps)
            if (warning.message?.includes('valtio')) return;
            // Suppress resolution errors for valtio/vanilla (handled via resolve conditions)
            if (warning.code === 'UNRESOLVED_IMPORT' && warning.source?.includes('valtio')) {
              return;
            }
            warn(warning);
          },
          // Ensure valtio is properly resolved
          output: {
            manualChunks: undefined,
          },
        },
        // CommonJS options for better compatibility
        commonjsOptions: {
          include: [/node_modules/],
          transformMixedEsModules: true,
        },
      },
      esbuild: {
        // Also drop console and debugger during esbuild transform phase (for dependencies)
        drop: isProduction ? ['console', 'debugger'] : [],
      },
    };
});
