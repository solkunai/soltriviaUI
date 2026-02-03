/// <reference path="./src/vite-env.d.ts" />
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode, command }) => {
    const env = loadEnv(mode, '.', '');
    // Check if building for production (either mode='production' or command='build')
    const isProduction = mode === 'production' || command === 'build';
    
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
          'crypto': path.resolve(__dirname, 'src/utils/crypto-polyfill.ts'),
          // ESM shim so "import { Buffer } from 'buffer'" works (CJS buffer has no named export)
          'buffer': path.resolve(__dirname, 'src/utils/buffer-polyfill.ts'),
          // Raw buffer package for the polyfill to import (avoids circular alias)
          'buffer-cjs': path.resolve(__dirname, 'node_modules/buffer/index.js'),
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
          target: 'esnext',
          supported: { 
            bigint: true 
          },
        },
        include: [
          'valtio',
          '@solana/web3.js',
          '@solana/wallet-adapter-react',
          '@solana/wallet-adapter-react-ui',
          '@solana/wallet-adapter-wallets',
          'buffer',
        ],
        exclude: ['derive-valtio'],
      },
      publicDir: 'public',
      build: {
        target: 'esnext',
        minify: isProduction ? 'terser' : 'esbuild',
        terserOptions: isProduction ? {
          compress: {
            // Strip all console.* in production (Render deploy: npm run build uses this).
            // Safe: removes call expressions from final bundle only; no source transform.
            drop_console: true,
            drop_debugger: true,
            dead_code: true,
            unused: true,
          },
          format: {
            // Remove all comments in production
            comments: false,
          },
          mangle: {
            // Mangle all properties for smaller bundle
            properties: false, // Keep false to avoid breaking code
          },
        } : {},
        // Suppress build warnings and fix module resolution
        rollupOptions: {
          onwarn(warning, warn) {
            // Suppress specific warnings if needed
            if (warning.code === 'UNUSED_EXTERNAL_IMPORT') return;
            // Suppress valtio resolution warnings (handled by optimizeDeps)
            if (warning.message?.includes('valtio')) return;
            // Suppress resolution errors for valtio/vanilla (handled via resolve conditions)
            if (warning.code === 'UNRESOLVED_IMPORT' && (warning as { source?: string }).source?.includes('valtio')) {
              return;
            }
            // Suppress buffer parsing errors
            if (warning.message?.includes('buffer')) return;
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
        // Only drop debugger in deps; do not drop console so third-party code (e.g. wallet scripts) still works
        drop: isProduction ? ['debugger'] : [],
      },
    };
});
