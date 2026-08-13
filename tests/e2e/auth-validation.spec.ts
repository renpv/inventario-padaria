import { test, expect } from '@playwright/test';
import { logoutButton } from './helpers';

/**
 * Authentication Validation Tests
 *
 * Testa a integração completa de autenticação PIN com:
 * - Validação de entrada no navegador
 * - Verificação de localStorage
 * - Tratamento de erros
 *
 * Executar: npm run test:e2e -- auth-validation.spec.ts
 */

test.describe('PIN Authentication Validation', () => {
  test('Should login successfully with valid PIN 1234', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/.*\/login/);

    await expect(page.getByText('Acesso ao Sistema')).toBeVisible();
    await expect(page.getByPlaceholder('••••')).toBeVisible();

    const pinInput = page.getByPlaceholder('••••');
    await pinInput.fill('1234');
    await expect(pinInput).toHaveValue('1234');

    await page.getByRole('button', { name: /entrar como operador/i }).click();

    await expect(page).toHaveURL('http://localhost:5173/');

    const userRole = await page.evaluate(() => localStorage.getItem('user_role'));
    expect(userRole).toBe('operacional');

    await expect(page.getByText(/painel principal/i)).toBeVisible({ timeout: 5000 });
  });

  test('Should reject invalid PIN and show error', async ({ page }) => {
    await page.goto('/login');

    const initialRole = await page.evaluate(() => localStorage.getItem('user_role'));
    expect(initialRole).toBeNull();

    const pinInput = page.getByPlaceholder('••••');
    await pinInput.fill('9999');
    await page.getByRole('button', { name: /entrar como operador/i }).click();

    await expect(page.getByText('PIN incorreto. Tente novamente.')).toBeVisible();

    const roleAfterError = await page.evaluate(() => localStorage.getItem('user_role'));
    expect(roleAfterError).toBeNull();
    expect(page.url()).toContain('/login');
  });

  test('Should persist login across page reloads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/.*\/login/);

    await page.getByPlaceholder('••••').fill('1234');
    await page.getByRole('button', { name: /entrar como operador/i }).click();
    await expect(page).toHaveURL('http://localhost:5173/');

    let userRole = await page.evaluate(() => localStorage.getItem('user_role'));
    expect(userRole).toBe('operacional');

    await page.reload();

    userRole = await page.evaluate(() => localStorage.getItem('user_role'));
    expect(userRole).toBe('operacional');
    await expect(page.getByText(/painel principal/i)).toBeVisible({ timeout: 5000 });
  });

  test('Should clear localStorage and redirect to login on logout', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('••••').fill('1234');
    await page.getByRole('button', { name: /entrar como operador/i }).click();
    await expect(page).toHaveURL('http://localhost:5173/');

    let userRole = await page.evaluate(() => localStorage.getItem('user_role'));
    expect(userRole).toBe('operacional');

    await logoutButton(page).click();

    await expect(page).toHaveURL(/.*\/login/);
    userRole = await page.evaluate(() => localStorage.getItem('user_role'));
    expect(userRole).toBeNull();
  });

  test('Should recover and login successfully after a prior invalid attempt', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/.*\/login/);

    let pinInput = page.getByPlaceholder('••••');
    await pinInput.fill('1111');
    await page.getByRole('button', { name: /entrar como operador/i }).click();
    await expect(page.getByText('PIN incorreto')).toBeVisible();

    pinInput = page.getByPlaceholder('••••');
    await pinInput.fill('1234');
    await page.getByRole('button', { name: /entrar como operador/i }).click();

    await expect(page).toHaveURL('http://localhost:5173/');
    const userRole = await page.evaluate(() => localStorage.getItem('user_role'));
    expect(userRole).toBe('operacional');
  });
});
