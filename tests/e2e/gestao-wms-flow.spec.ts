import { test, expect } from '@playwright/test';
import { loginAsGestor } from './helpers';

test.describe('WMS Dashboard (gestão)', () => {
  test('should render the stock health summary and purchase suggestions', async ({ page }) => {
    await loginAsGestor(page);
    await page.goto('/wms');

    await expect(page.getByText('Total de Itens')).toBeVisible();
    await expect(page.getByText('Abaixo do Mínimo')).toBeVisible();
    await expect(page.getByRole('link', { name: /pedidos de compra/i })).toBeVisible();

    // A lista principal mostra grupos por FORNECEDOR (nome, contagem, total),
    // não os produtos individualmente — o nome do produto só aparece dentro
    // do modal de pedido (após clicar "Pedir"). Ambiente sem produtos
    // cadastrados (`produtos` vazia) cai no fallback ilustrativo do
    // WmsDashboard (ver mockMode em WmsDashboard.tsx), que sempre tem
    // sugestões pendentes — então o estado "sem sugestões" só apareceria com
    // dados reais e estoque totalmente abastecido.
    const noSuggestions = page.getByText('Nenhuma sugestão de compra pendente. Estoques abastecidos.');
    const pedirBtn = page.getByRole('button', { name: /pedir/i }).first();

    // Ambos os locators fazem polling (web-first assertion) em vez de uma
    // checagem instantânea, já que a lista de sugestões só é conhecida após
    // o fetch assíncrono do dashboard resolver.
    await expect(pedirBtn.or(noSuggestions)).toBeVisible({ timeout: 10000 });
  });

  test('should open the WhatsApp order preview for a supplier suggestion', async ({ page }) => {
    await loginAsGestor(page);
    await page.goto('/wms');

    const pedirBtn = page.getByRole('button', { name: /pedir/i }).first();
    const noSuggestions = page.getByText('Nenhuma sugestão de compra pendente. Estoques abastecidos.');
    await expect(pedirBtn.or(noSuggestions)).toBeVisible({ timeout: 10000 });

    if (!(await pedirBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Nenhuma sugestão de compra disponível neste ambiente.');
    }

    await pedirBtn.click();

    await expect(page.getByText(/whatsapp|realizar pedido|resumo/i).first()).toBeVisible({ timeout: 5000 });
  });
});
