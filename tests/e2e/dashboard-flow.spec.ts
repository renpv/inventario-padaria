import { test, expect } from '@playwright/test';
import { loginAsOperator } from './helpers';

test.describe('Operational Dashboard', () => {
  test('should show the operational panel and turnos-do-dia status', async ({ page }) => {
    await loginAsOperator(page);

    await expect(page.getByText('Painel Principal')).toBeVisible();
    await expect(page.getByText(/perfil ativo/i)).toBeVisible();
    await expect(page.getByText(/^opera/i)).toBeVisible();

    // TurnosStatusPanel (RF-19): eventualmente mostra os turnos do dia ou "Nenhum turno configurado."
    await expect(
      page.getByText(/turnos de hoje|nenhum turno configurado/i)
    ).toBeVisible({ timeout: 10000 });

    // Área operacional (não deve mostrar o painel de gestão/WMS)
    await expect(page.getByText('Área Operacional')).toBeVisible();
  });

  test('should navigate to Sobras/Perdas, Consultar Estoque and Recebimento via quick access', async ({ page }) => {
    await loginAsOperator(page);

    await page.getByRole('link', { name: /sobras\s*\/\s*perdas/i }).click();
    await expect(page).toHaveURL(/.*\/sobras-perdas/);
    await expect(page.getByRole('heading', { name: /sobras e perdas/i })).toBeVisible();

    await page.getByRole('link', { name: /painel/i }).click();
    await expect(page).toHaveURL('http://localhost:5173/');

    await page.getByRole('link', { name: /consultar estoque/i }).click();
    await expect(page).toHaveURL(/.*\/consulta-estoque/);
    await expect(page.getByRole('heading', { name: /consulta de estoque/i })).toBeVisible();

    await page.getByRole('link', { name: /painel/i }).click();
    await expect(page).toHaveURL('http://localhost:5173/');

    await page.getByRole('link', { name: /recebimento/i }).click();
    await expect(page).toHaveURL(/.*\/recebimento/);
    await expect(page.getByRole('heading', { name: /conferir recebimento/i })).toBeVisible();
  });

  test('operator should not see gestão-only bottom nav items', async ({ page }) => {
    await loginAsOperator(page);

    await expect(page.getByRole('link', { name: /ajustes/i })).toHaveCount(0);
  });
});
