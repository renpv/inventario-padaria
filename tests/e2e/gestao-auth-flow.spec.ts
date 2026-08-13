import { test, expect } from '@playwright/test';
import { loginAsGestor, logoutButton } from './helpers';

test.describe('Gestão Auth Flow (conta de teste)', () => {
  test('should authenticate as gestao and see the management dashboard', async ({ page }) => {
    await loginAsGestor(page);

    await expect(page.getByText(/gestão \(wms\)/i)).toBeVisible();
    // Item de navegação exclusivo da gestão
    await expect(page.getByRole('link', { name: /ajustes/i })).toBeVisible();
  });

  test('should access /config without being redirected', async ({ page }) => {
    await loginAsGestor(page);
    await page.goto('/config');
    await expect(page).toHaveURL(/.*\/config/);
    await expect(page.getByText(/painel principal/i)).toHaveCount(0);
  });

  test('should access /wms without being redirected', async ({ page }) => {
    await loginAsGestor(page);
    await page.goto('/wms');
    await expect(page).toHaveURL(/.*\/wms/);
  });

  test('should survive a reload, keeping the gestão session (RLS-authenticated)', async ({ page }) => {
    await loginAsGestor(page);

    // Dá tempo da restauração inicial (após o hash de login) terminar de
    // salvar a sessão cacheada antes de recarregar — dois reloads muito
    // próximos podem interromper a restauração do primeiro no meio (o
    // Supabase pode já ter rotacionado o refresh token no servidor antes do
    // browser processar a resposta).
    await page.waitForTimeout(300);

    await page.reload();

    await expect(page).toHaveURL('http://localhost:5173/');
    await expect(page.getByText(/gestão \(wms\)/i)).toBeVisible();
    const role = await page.evaluate(() => localStorage.getItem('user_role'));
    expect(role).toBe('gestao');
  });

  test('should clear the session on logout', async ({ page }) => {
    await loginAsGestor(page);

    await logoutButton(page).click();

    await expect(page).toHaveURL(/.*\/login/);
    const role = await page.evaluate(() => localStorage.getItem('user_role'));
    expect(role).toBeNull();
  });
});
