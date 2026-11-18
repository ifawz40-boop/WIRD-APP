import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import type {Plugin} from 'vite';
import { listOfflinePublicAssets } from './scripts/offlinePublicAssets';

function offlineShellManifestPlugin(): Plugin {
  return {
    name: 'wird-offline-shell-manifest',
    apply: 'build',
    generateBundle(_options, bundle) {
      const entry = Object.values(bundle).find(
        item => item.type === 'chunk' && item.isEntry && item.name === 'index'
      );
      if (!entry) {
        this.error('WIRD offline shell: Vite entry chunk "index" was not found.');
      }

      const assets = new Set<string>();
      const visited = new Set<string>();
      const visitStaticChunk = (fileName: string) => {
        if (visited.has(fileName)) return;
        visited.add(fileName);
        const item = bundle[fileName];
        if (!item || item.type !== 'chunk') return;

        assets.add('/' + item.fileName);
        const metadata = (item as typeof item & {
          viteMetadata?: { importedCss?: Set<string> };
        }).viteMetadata;
        for (const cssFile of metadata?.importedCss || []) {
          assets.add('/' + cssFile);
        }
        for (const importedFile of item.imports) {
          visitStaticChunk(importedFile);
        }
      };

      visitStaticChunk(entry.fileName);
      const bundleAssets = Object.values(bundle)
        .filter(item => item.type === 'chunk' || (
          item.type === 'asset' &&
          /\.(?:mjs|wasm|css|svg|png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf|json|webmanifest)$/i.test(item.fileName)
        ))
        .map(item => '/' + item.fileName);
      const allAssets = [...new Set([...bundleAssets, ...listOfflinePublicAssets()])].sort();
      if (allAssets.length > 2000) {
        this.error(`WIRD offline package manifest has ${allAssets.length} assets; the service-worker safety limit is 2000.`);
      }

      this.emitFile({
        type: 'asset',
        fileName: 'wird-precache-manifest.json',
        source: JSON.stringify({
          schemaVersion: 1,
          assets: [...assets].sort(),
          allAssets
        })
      });
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), offlineShellManifestPlugin()],
    resolve: {
      alias: {
        '@': import.meta.dirname ?? path.resolve('.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 650,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/node_modules/firebase/firestore') || id.includes('/node_modules/@firebase/firestore')) {
              return 'vendor-firestore';
            }
            if (id.includes('/node_modules/firebase/') || id.includes('/node_modules/@firebase/')) {
              return 'vendor-firebase';
            }
            if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/scheduler/')) {
              return 'vendor-react';
            }
            if (id.includes('/node_modules/lucide-react/')) {
              return 'vendor-icons';
            }
            if (id.includes('/node_modules/motion/') || id.includes('/node_modules/framer-motion/')) {
              return 'vendor-motion';
            }
            return undefined;
          }
        }
      }
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
