import { test, expect } from '@playwright/test';
import { loginAsOperator } from './helpers';

test.describe('Operational Inventory Flow (Mocked)', () => {
  test('should load fallback mock data and allow manual submission', async ({ page }) => {
    await loginAsOperator(page);

    // Navigate to the inventory page with a non-UUID id, which triggers the
    // built-in demo/mock fallback in ShiftInventory (no real backend writes).
    await page.goto('/inventario/1/1');

    await expect(page.locator('h2')).toContainText('Contagem de Estoque');

    await expect(page.locator('text=Pão Francês')).toBeVisible();
    await expect(page.locator('text=Pão de Queijo')).toBeVisible();

    const inputs = page.locator('input[type="number"]');

    // Fill the first input (qtd_loja of Pão Francês)
    await inputs.nth(0).fill('50');

    // Fill the second input (qtd_estoque of Pão Francês)
    await inputs.nth(1).fill('100');

    // Check if the "Forçar Fechamento" button is active (since we haven't counted all)
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toContainText('Forçar Fechamento');

    await submitBtn.click();

    await expect(page.locator('text=Itens não contados!')).toBeVisible();

    await page.locator('textarea').fill('Falta de tempo para contar pão de queijo.');

    await page.locator('button', { hasText: 'Confirmar Fechamento' }).click();

    // Should navigate back to dashboard/root
    await expect(page).toHaveURL('http://localhost:5173/');
  });

  test('should allow zeroing a product count via the "Zerar Contagem" button', async ({ page }) => {
    await loginAsOperator(page);
    await page.goto('/inventario/1/1');

    await expect(page.locator('h2')).toContainText('Contagem de Estoque');

    const inputs = page.locator('input[type="number"]');
    await inputs.nth(0).fill('30');
    await inputs.nth(1).fill('10');

    await page.getByRole('button', { name: /zerar contagem/i }).first().click();

    await expect(inputs.nth(0)).toHaveValue('0');
    await expect(inputs.nth(1)).toHaveValue('0');
  });
});
