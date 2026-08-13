import { test, expect } from '@playwright/test';
import { loginAsGestor } from './helpers';

test.describe('CRUD de Setores (gestão)', () => {
  test('should create a setor, see it listed, and soft-delete it (RF-13)', async ({ page }) => {
    await loginAsGestor(page);
    await page.goto('/gestao/cadastros/setores');

    await expect(page.getByRole('heading', { name: /cadastro de setores/i })).toBeVisible();

    const nome = `E2E Setor ${Date.now()}`;
    await page.getByPlaceholder(/ex: frios, padaria, depósito/i).fill(nome);
    await page.getByRole('button', { name: /adicionar/i }).click();

    const row = page.locator('div').filter({ hasText: nome }).last();
    await expect(row).toBeVisible({ timeout: 10000 });

    // Soft delete (RF-13: exclusão lógica, ativo = 'NÃO') via o botão de lixeira da linha.
    const card = page.locator('.bg-stone-850', { hasText: nome });
    await card.getByRole('button').click();

    // Após desativar, o card fica com opacidade reduzida (classe opacity-50) mas continua listado.
    await expect(card).toHaveClass(/opacity-50/);
  });

  test('should not allow accessing gestão CRUDs as an unauthenticated user (regression guard)', async ({ page }) => {
    await page.goto('/gestao/cadastros/setores');
    await expect(page).not.toHaveURL(/.*\/gestao\/cadastros\/setores/);
  });
});
