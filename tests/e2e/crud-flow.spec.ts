import { test, expect } from '@playwright/test';

test.describe('CRUD Dashboard Flow', () => {
  test('should block unauthorized users from accessing Config Hub and redirect', async ({ page }) => {
    // Navigate to /config without login
    await page.goto('/config');
    
    // Wait for redirect to login or root since not gestao
    await expect(page).not.toHaveURL(/.*\/config/);
  });

  test('should block unauthorized users from accessing specific CRUDs', async ({ page }) => {
    const protectedRoutes = [
      '/gestao/cadastros/produtos',
      '/gestao/cadastros/setores',
      '/gestao/cadastros/fornecedores',
      '/gestao/cadastros/funcionarios',
      '/gestao/cadastros/precos',
      '/gestao/cadastros/turnos',
      '/gestao/cadastros/configuracoes'
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect(page).not.toHaveURL(new RegExp(`.*${route}`));
    }
  });

  // A complete test for gestor would require mocking Google OAuth or Supabase Auth Token
  // in localStorage. We will assert that the route is properly protected as per requirements.
});
