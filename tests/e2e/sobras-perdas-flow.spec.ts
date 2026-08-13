import { test, expect } from '@playwright/test';
import { loginAsOperator } from './helpers';

test.describe('Sobras / Perdas Flow', () => {
  test('should toggle between Perda and Sobra and switch setor product list', async ({ page }) => {
    await loginAsOperator(page);
    await page.goto('/sobras-perdas');

    await expect(page.getByRole('heading', { name: /sobras e perdas/i })).toBeVisible();

    const perdaBtn = page.getByRole('button', { name: /^perda$/i });
    const sobraBtn = page.getByRole('button', { name: /^sobra$/i });

    // Perda é o tipo padrão
    await expect(perdaBtn).toHaveClass(/border-rose-600/);

    await sobraBtn.click();
    await expect(sobraBtn).toHaveClass(/border-emerald-600/);

    await perdaBtn.click();
    await expect(perdaBtn).toHaveClass(/border-rose-600/);

    // Selector de setor deve conter opções carregadas do backend. Usamos uma
    // asserção com polling (em vez de um único .count()) porque a query só
    // é disparada após a sessão anônima do Supabase ser estabelecida, o que
    // pode levar um instante além do primeiro render da página.
    const setorSelect = page.locator('select');
    await expect(setorSelect).toBeVisible();
    await expect(setorSelect.locator('option')).not.toHaveCount(0, { timeout: 10000 });
  });

  test('should adjust product quantity with +/- and submit a registro de perda', async ({ page }) => {
    await loginAsOperator(page);
    await page.goto('/sobras-perdas');

    await expect(page.getByRole('heading', { name: /sobras e perdas/i })).toBeVisible();

    const submitBtn = page.getByRole('button', { name: /registrar perda/i });
    // Se não houver produtos cadastrados para o setor selecionado, o botão de
    // envio nem aparece — nesse caso não há o que testar aqui.
    if (!(await submitBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Nenhum produto disponível para o setor padrão neste ambiente.');
    }

    const firstCard = page.locator('form > div').first();
    const plusButton = firstCard.getByRole('button').nth(1); // [-] [input] [+]
    await plusButton.click();
    await plusButton.click();

    const qtyInput = firstCard.locator('input[type="number"]');
    await expect(qtyInput).toHaveValue('2');

    page.once('dialog', (dialog) => dialog.accept());
    await submitBtn.click();

    // Após o envio, as quantidades são resetadas
    await expect(qtyInput).toHaveValue('0', { timeout: 10000 });
  });
});
