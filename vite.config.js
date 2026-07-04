import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  logLevel: 'error',
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'forks',
    poolOptions: { forks: { maxForks: 2 } },
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/__tests__/**/*.test.{js,jsx}'],
    env: {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // recharts/jspdf FORA do manualChunks de propósito: são usados só por
        // componentes/rotas lazy (React.lazy) e import() dinâmico. Isolá-los num
        // chunk nomeado fazia o Rollup promovê-los a dependência do entry
        // (modulepreload), pondo ~800KB (recharts 431KB + jspdf 391KB) no caminho
        // crítico do 1º paint. Fora do manualChunks, ficam co-locados nos chunks
        // lazy que os usam e só carregam quando essas telas abrem.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-popover',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-tabs',
            '@radix-ui/react-accordion',
            '@radix-ui/react-tooltip',
          ],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-dates': ['date-fns'],
          'vendor-xlsx': ['xlsx'],
        },
      },
    },
  },
})
