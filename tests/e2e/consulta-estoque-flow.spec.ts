import { test, expect } from '@playwright/test';
import { loginAsOperator } from './helpers';

test.describe('Consulta de Estoque Flow', () => {
  test('should load stock balance and filter by search term', async ({ page }) => {
    await loginAsOperator(page);
    await page.goto('/consulta-estoque');

    await expect(page.getByRole('heading', { name: /consulta de estoque/i })).toBeVisible();

    const searchInput = page.getByPlaceholder('Buscar produto...');
    await expect(searchInput).toBeVisible();

    // Aguarda o carregamento (loading spinner some) antes de avaliar o resultado.
    await expect(page.getByText(/carregando estoque/i)).toHaveCount(0, { timeout: 10000 });

    const emptyState = page.getByText('Nenhum produto encontrado.');
    const hasProducts = !(await emptyState.isVisible().catch(() => false));

    if (!hasProducts) {
      // Nenhum produto cadastrado neste ambiente — a busca deve permanecer
      // funcional (sem erros) mesmo sem resultados.
      await searchInput.fill('xyz');
      await expect(emptyState).toBeVisible();
      return;
    }

    // Com produtos cadastrados: busca por um termo que não existe deve zerar a lista.
    await searchInput.fill('produto-inexistente-xyz-123');
    await expect(emptyState).toBeVisible();

    await searchInput.fill('');
    await expect(emptyState).toHaveCount(0);
  });
});
