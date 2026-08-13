import { test, expect } from '@playwright/test';
import { loginAsOperator } from './helpers';

test.describe('Recebimento (avulso) Flow', () => {
  test('should load the avulso receiving screen and search the product catalog', async ({ page }) => {
    await loginAsOperator(page);
    await page.goto('/recebimento');

    await expect(page.getByRole('heading', { name: /conferir recebimento/i })).toBeVisible();
    await expect(page.getByText('Recebimento avulso (sem pedido)')).toBeVisible();

    const searchInput = page.getByPlaceholder('Buscar produto...');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('a');

    const suggestion = page.locator('button', { hasText: /./ }).filter({ has: page.locator('svg') });
    const hasSuggestions = await suggestion
      .first()
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false);

    if (!hasSuggestions) {
      test.skip(true, 'Nenhum produto cadastrado neste ambiente para testar a adição ao recebimento avulso.');
    }

    await suggestion.first().click();

    // Após adicionar um produto, os controles de quantidade e o botão de
    // confirmação devem aparecer.
    await expect(page.getByRole('button', { name: /confirmar conferência/i })).toBeVisible();
  });

  test('should show empty state when there are no items yet', async ({ page }) => {
    await loginAsOperator(page);
    await page.goto('/recebimento');

    await expect(
      page.getByText('Busque produtos acima para iniciar o recebimento avulso.')
    ).toBeVisible();
  });
});
