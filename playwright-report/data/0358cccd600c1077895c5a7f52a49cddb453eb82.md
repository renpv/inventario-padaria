# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login-flow.spec.ts >> Login and Inventory Flow >> should login with valid PIN and navigate to inventory
- Location: tests\e2e\login-flow.spec.ts:4:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Inventário:')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Inventário:')

```

```yaml
- banner:
  - heading "Padaria WMS" [level=1]
  - text: Online
  - button
- main: Carregando lista de produtos...
- navigation:
  - link "Painel":
    - /url: /
  - link "Inventário":
    - /url: /inventario
  - link "Fiados":
    - /url: /fiado
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Login and Inventory Flow', () => {
  4  |   test('should login with valid PIN and navigate to inventory', async ({ page }) => {
  5  |     // Navigate to the login page (or root which redirects to login)
  6  |     await page.goto('/');
  7  | 
  8  |     // Wait for redirect to login
  9  |     await expect(page).toHaveURL(/.*\/login/);
  10 | 
  11 |     // Assert login page elements
  12 |     await expect(page.getByText('Acesso ao Sistema')).toBeVisible();
  13 | 
  14 |     // Enter PIN '1234'
  15 |     const pinInput = page.getByPlaceholder('••••');
  16 |     await pinInput.fill('1234');
  17 |     
  18 |     // Click login button
  19 |     await page.getByRole('button', { name: /entrar como operador/i }).click();
  20 | 
  21 |     // Verify successful login and redirect to dashboard
  22 |     await expect(page).toHaveURL('http://localhost:5173/');
  23 |     
  24 |     // Assert dashboard elements
  25 |     await expect(page.getByText('Painel Principal')).toBeVisible();
  26 | 
  27 |     // Click on 'Inventário'
  28 |     await page.getByRole('link', { name: /inventário/i }).click();
  29 | 
  30 |     // Verify navigation to sector selector
  31 |     await expect(page).toHaveURL(/.*\/inventario/);
  32 | 
  33 |     // Select 'Padaria'
  34 |     await page.getByRole('button', { name: /padaria/i }).click();
  35 | 
  36 |     // Verify navigation to shift inventory
  37 |     await expect(page).toHaveURL(/.*\/inventario\/.*\/1/);
  38 | 
  39 |     // Verify inventory elements
> 40 |     await expect(page.getByText('Inventário:')).toBeVisible();
     |                                                 ^ Error: expect(locator).toBeVisible() failed
  41 |     await expect(page.getByPlaceholder('Adicionar item (Ex: pão francês, bolo)')).toBeVisible();
  42 |   });
  43 | 
  44 |   test('should show error for invalid PIN', async ({ page }) => {
  45 |     await page.goto('/login');
  46 | 
  47 |     const pinInput = page.getByPlaceholder('••••');
  48 |     await pinInput.fill('9999');
  49 |     
  50 |     await page.getByRole('button', { name: /entrar como operador/i }).click();
  51 | 
  52 |     // Verify error message
  53 |     await expect(page.getByText('PIN incorreto. Tente novamente.')).toBeVisible();
  54 |   });
  55 | });
  56 | 
```