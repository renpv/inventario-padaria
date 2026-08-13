import { defineConfig } from 'vitest/config';

// Config separada dos unit tests (vite.config.ts exclui tests/integration/**
// do `npm test` padrão, já que estes dependem de rede e do estado real do
// projeto Supabase). Usada via `npm run test:integration`.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    setupFiles: ['tests/integration/setupEnv.ts'],
  },
});
