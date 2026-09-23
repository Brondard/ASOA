import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build`       -> app installable (PWA) dans dist/
// `npm run build:demo`  -> un seul fichier HTML de démo dans dist-demo/
export default defineConfig(({ mode }) => {
  const demo = mode === 'demo'
  return {
    base: './',
    build: {
      target: 'es2022',
      outDir: demo ? 'dist-demo' : 'dist',
      // la démo tient dans un seul fichier : on y intègre aussi les images
      assetsInlineLimit: demo ? 20_000_000 : 4096,
    },
    plugins: [
      react(),
      demo
        ? viteSingleFile()
        : VitePWA({
            registerType: 'autoUpdate',
            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'sw.js',
            includeAssets: ['apple-touch-icon.png'],
            manifest: {
              name: 'ASOA Antibes',
              short_name: 'ASOA',
              description: 'Séances, résultats et challenge du club ASOA Antibes',
              lang: 'fr',
              start_url: './',
              display: 'standalone',
              background_color: '#070606',
              theme_color: '#070606',
              icons: [
                { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
          }),
    ],
  }
})
