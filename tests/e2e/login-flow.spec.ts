import { test, expect } from '@playwright/test';

test.describe('Login and Inventory Flow', () => {
  test('should login with valid PIN and navigate to inventory', async ({ page }) => {
    // Navigate to the login page (or root which redirects to login)
    await page.goto('/');

    // Wait for redirect to login
    await expect(page).toHaveURL(/.*\/login/);

    // Assert login page elements
    await expect(page.getByText('Acesso ao Sistema')).toBeVisible();

    // Enter PIN '1234'
    const pinInput = page.getByPlaceholder('••••');
    await pinInput.fill('1234');
    
    // Click login button
    await page.getByRole('button', { name: /entrar como operador/i }).click();

    // Verify successful login and redirect to dashboard
    await expect(page).toHaveURL('http://localhost:5173/');
    
    // Assert dashboard elements
    await expect(page.getByText('Painel Principal')).toBeVisible();

    // Click on 'Inventário'
    await page.getByRole('link', { name: /inventário/i }).click();

    // Verify navigation to sector selector
    await expect(page).toHaveURL(/.*\/inventario/);

    // Select 'Padaria'
    await page.getByRole('button', { name: /padaria/i }).click();

    // Verify navigation to shift inventory
    await expect(page).toHaveURL(/.*\/inventario\/.*\/1/);

    // Verify inventory elements
    await expect(page.getByText('Contagem de Estoque')).toBeVisible({ timeout: 15000 });
  });

  test('should show error for invalid PIN', async ({ page }) => {
    await page.goto('/login');

    const pinInput = page.getByPlaceholder('••••');
    await pinInput.fill('9999');
    
    await page.getByRole('button', { name: /entrar como operador/i }).click();

    // Verify error message
    await expect(page.getByText('PIN incorreto. Tente novamente.')).toBeVisible();
  });
});
