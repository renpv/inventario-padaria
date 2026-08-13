import { Page, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import './loadEnv';

/**
 * Faz login como operador (PIN 1234) e aguarda o dashboard carregar.
 * Assume que a página ainda não foi navegada (chama page.goto internamente).
 */
export async function loginAsOperator(page: Page) {
  await page.goto('/');
  await expect(page).toHaveURL(/.*\/login/);

  await page.getByPlaceholder('••••').fill('1234');
  await page.getByRole('button', { name: /entrar como operador/i }).click();

  await expect(page).toHaveURL('http://localhost:5173/');
  await expect(page.getByText('Painel Principal')).toBeVisible();
}

/**
 * Faz login como gestão numa conta de teste dedicada (e-mail/senha, criada via
 * service_role key — ver scripts/setup-test-gestor.mjs), contornando o fluxo
 * de Google OAuth real, que não dá pra automatizar. Funciona porque o
 * supabase-js detecta uma sessão vinda do hash da URL (`#access_token=...`)
 * independente do provedor original — é o mesmo mecanismo usado pelos
 * redirects de magic link / recuperação de senha do Supabase Auth.
 *
 * Requer E2E_GESTAO_TEST_EMAIL/PASSWORD e VITE_SUPABASE_URL/ANON_KEY em
 * .env/.env.local. Pula o teste (via test.skip) se essas credenciais não
 * estiverem configuradas, em vez de falhar.
 */
export async function loginAsGestor(page: Page) {
  const email = process.env.E2E_GESTAO_TEST_EMAIL;
  const password = process.env.E2E_GESTAO_TEST_PASSWORD;
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!email || !password || !url || !anonKey) {
    throw new Error(
      'loginAsGestor: faltam E2E_GESTAO_TEST_EMAIL/PASSWORD (ou VITE_SUPABASE_URL/ANON_KEY) em .env.local — ' +
        'rode scripts/setup-test-gestor.mjs primeiro.'
    );
  }

  const authClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`loginAsGestor: falha ao autenticar a conta de teste gestão: ${error?.message}`);
  }

  const { access_token, refresh_token, expires_in, token_type } = data.session;
  const hash = new URLSearchParams({
    access_token,
    refresh_token,
    expires_in: String(expires_in),
    token_type,
    type: 'recovery',
  });

  await page.goto(`/#${hash.toString()}`);
  // O supabase-js processa o hash, dispara onAuthStateChange, o AuthContext
  // consulta `usuarios` e define role='gestao' — a URL é limpa depois (replaceState).
  await expect(page).toHaveURL('http://localhost:5173/', { timeout: 10000 });
  await expect(page.getByText('Painel Principal')).toBeVisible({ timeout: 10000 });

  const role = await page.evaluate(() => localStorage.getItem('user_role'));
  if (role !== 'gestao') {
    throw new Error(`loginAsGestor: sessão autenticada mas role ficou "${role}" em vez de "gestao".`);
  }
}

/** Botão de logout no header — ícone sem texto acessível, único button no <header>. */
export function logoutButton(page: Page) {
  return page.locator('header button');
}
