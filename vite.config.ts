import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'Padaria Inventário & WMS',
        short_name: 'Padaria',
        description: 'Sistema PWA para Gestão Operacional',
        theme_color: '#d97706',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        // Forma de função em vez do atalho por objeto: o atalho por objeto
        // não bate com o tipo `ManualChunksFunction` resolvido quando
        // `defineConfig` vem de `vitest/config` (mistura os tipos de
        // configuração do Vite com os do Vitest), o que quebrava `tsc -b`
        // mesmo o atalho sendo válido em tempo de execução pelo Rollup.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-router-dom') || id.includes('/react/') || id.includes('/react-dom/')) {
            return 'vendor';
          }
          if (id.includes('@supabase/supabase-js')) {
            return 'supabase';
          }
          return undefined;
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'node',
    // tests/integration roda à parte (npm run test:integration): depende de
    // rede e do estado real do projeto Supabase, então não deve entrar no
    // `npm test` padrão (unit tests, rápidos e sem dependência externa).
    exclude: ['node_modules', 'dist', 'tests/e2e/**', 'tests/integration/**'],
  },
})
