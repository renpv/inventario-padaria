import { test, expect } from '@playwright/test';

test.describe('Operational Inventory Flow (Mocked)', () => {
  test('should load fallback mock data and allow manual submission', async ({ page }) => {
    // 1. Navigate to the inventory page with the mock ID
    await page.goto('/inventario/1/1');

    // 2. Wait for the page to load
    await expect(page.locator('h2')).toContainText('Contagem de Estoque');

    // 3. Ensure mock products are loaded
    await expect(page.locator('text=Pão Francês')).toBeVisible();
    await expect(page.locator('text=Pão de Queijo')).toBeVisible();

    // 4. Input counts manually for the first product
    // "Pão Francês" has two inputs (loja and estoque)
    const inputs = page.locator('input[type="number"]');
    
    // Fill the first input (qtd_loja of Pão Francês)
    await inputs.nth(0).fill('50');

    // Fill the second input (qtd_estoque of Pão Francês)
    await inputs.nth(1).fill('100');

    // 5. Check if the "Forçar Fechamento" button is active (since we haven't counted all)
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toContainText('Forçar Fechamento');

    // 6. Click submit to open the justification modal
    await submitBtn.click();

    // 7. Verify modal appears
    await expect(page.locator('text=Itens não contados!')).toBeVisible();

    // 8. Fill justification
    await page.locator('textarea').fill('Falta de tempo para contar pão de queijo.');

    // 9. Confirm submission
    await page.locator('button', { hasText: 'Confirmar Fechamento' }).click();

    // 10. Should navigate back to dashboard/root
    await expect(page).toHaveURL(/.*\//);
  });
});
