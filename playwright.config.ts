import { defineConfig, devices } from '@playwright/test';
import './tests/e2e/loadEnv';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Cada teste roda em um browser context isolado (localStorage próprio), então
  // a sessão anônima cacheada (ver AuthContext.ensureAnonymousSession) não é
  // compartilhada entre eles: com muitos workers em paralelo, vários testes
  // chamam signInAnonymously() ao mesmo tempo e esbarram no rate limit de
  // criação de usuários anônimos do Supabase. Limitamos a concorrência aqui
  // em vez de depender só do limite do projeto.
  workers: 2,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
