import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Custom plugin to remove console logs in production (src only)
const removeConsolePlugin = (isProduction: boolean) => {
  return {
    name: 'remove-console',
    transform(code: string, id: string) {
      // Only run on project src; never transform node_modules or other paths (cross-platform)
      const isInSrc = id.includes(`${path.sep}src${path.sep}`) || id.includes('/src/');
      if (!isInSrc || id.includes('node_modules')) return null;
      // Remove console logs in production builds
      if (isProduction) {
        // Remove all console statements
        return {
          code: code
            .replace(/console\.log\([^)]*\);?/g, '')
            .replace(/console\.error\([^)]*\);?/g, '')
            .replace(/console\.warn\([^)]*\);?/g, '')
            .replace(/console\.info\([^)]*\);?/g, '')
            .replace(/console\.debug\([^)]*\);?/g, '')
            .replace(/console\.trace\([^)]*\);?/g, '')
            .replace(/console\.table\([^)]*\);?/g, '')
            .replace(/console\.group\([^)]*\);?/g, '')
            .replace(/console\.groupEnd\([^)]*\);?/g, '')
            .replace(/console\.dir\([^)]*\);?/g, '')
            .replace(/console\.time\([^)]*\);?/g, '')
            .replace(/console\.timeEnd\([^)]*\);?/g, ''),
          map: null,
        };
      }
      return null;
    },
  };
};

export default defineConfig(({ mode, command }) => {
    const env = loadEnv(mode, '.', '');
    // Check if building for production (either mode='production' or command='build')
    const isProduction = mode === 'production' || command === 'build';
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        ...(isProduction ? [removeConsolePlugin(isProduction)] : []),
      ],
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
            // Remove console.* call expressions from our bundle only (safe).
            // Do NOT use global_defs/pure_funcs to replace console with void 0 —
            // that turns console.warn(...) into (void 0)(...) and breaks extensions (e.g. MetaMask).
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
