import { test, expect } from '@playwright/test';
import { loginAsOperator } from './helpers';

test.describe('Login and Inventory Flow', () => {
  test('should login with valid PIN and navigate through inventory sector selection', async ({ page }) => {
    await loginAsOperator(page);

    // Click on 'Inventário' (bottom nav)
    await page.getByRole('link', { name: /inventário/i }).click();
    await expect(page).toHaveURL(/.*\/inventario$/);
    await expect(page.getByRole('heading', { name: /iniciar inventário/i })).toBeVisible();

    // Aguarda a lista de setores carregar e seleciona o primeiro disponível
    // (não assumimos um turno/setor específico pois o estado é real e pode
    // variar conforme lançamentos já feitos no dia operacional).
    const sectorButtons = page.locator('main').getByRole('button').filter({ hasText: /Contar|Concluído/ });
    const hasSectors = await sectorButtons
      .first()
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (!hasSectors) {
      // Nenhum setor com produtos cadastrados neste ambiente (tabela
      // `produtos` vazia) — não há como prosseguir para a contagem real.
      // Cobrimos esse fluxo separadamente via mock em inventario-flow.spec.ts.
      test.skip(true, 'Nenhum setor com produtos cadastrados neste ambiente.');
    }
    await sectorButtons.first().click();

    // Verify navigation to shift inventory (ids reais são UUID, não assumimos formato)
    await expect(page).toHaveURL(/\/inventario\/[^/]+\/[^/]+$/);
    await expect(page.getByText('Contagem de Estoque')).toBeVisible({ timeout: 15000 });
  });

  test('should show error for invalid PIN', async ({ page }) => {
    await page.goto('/login');

    const pinInput = page.getByPlaceholder('••••');
    await pinInput.fill('9999');

    await page.getByRole('button', { name: /entrar como operador/i }).click();

    await expect(page.getByText('PIN incorreto. Tente novamente.')).toBeVisible();
  });
});
