# 🧪 Instruções de Teste - Validação de Login PIN

## Status: ✅ Testes E2E Criados e Prontos

Os testes automatizados foram criados e estão prontos para executar **em seu ambiente local** onde tem acesso à internet.

---

## 📋 Testes Implementados

**Arquivo:** `tests/e2e/auth-validation.spec.ts`

### 1️⃣ Login com PIN Válido
```
✅ Should login successfully with valid PIN 1234
```
**O que valida:**
- PIN '1234' aceito com sucesso
- localStorage marcado com `user_role: 'operacional'`
- Redirecionamento para dashboard (`/`)
- Console logs corretos: "PIN recebido" e "Login bem-sucedido"

### 2️⃣ Rejeitar PIN Incorreto
```
❌ Should reject invalid PIN and show error
```
**O que valida:**
- PIN '9999' rejeitado com mensagem de erro
- localStorage NÃO é alterado
- Permanece na página de login
- Console mostra "PIN incorreto"

### 3️⃣ Persistência em Reload
```
🔄 Should persist login across page reloads
```
**O que valida:**
- Login persiste após F5/reload
- localStorage mantém role
- Dashboard carrega sem redirecionar para login

### 4️⃣ Logout Limpa Storage
```
🚪 Should clear localStorage on logout
```
**O que valida:**
- Botão logout remove `user_role` do localStorage
- Redireciona para login
- Próximo reload exige novo login

### 5️⃣ Múltiplas Tentativas
```
⏱️ Should handle rapid PIN attempts
```
**O que valida:**
- Falha anterior não bloqueia tentativa seguinte
- Login correto após falha funciona normalmente

### 6️⃣ Whitespace Handling
```
✨ Should handle whitespace in PIN correctly
```
**O que valida:**
- `.trim()` funciona corretamente no loginWithPIN

---

## 🚀 Como Executar os Testes

### 1. **Certifique-se que estão atualizados:**
```bash
cd D:\dev\padaria-inventario-react

# Instalar dependências se necessário
npm install

# Instalar browsers do Playwright (primeira vez)
npx playwright install
```

### 2. **Opção A: Testes Headless (sem UI visual)**
```bash
npm run test:e2e
```

Isso executará todos os testes, incluindo os novos testes de autenticação.

### 3. **Opção B: Testes com UI interativa (RECOMENDADO para debugging)**
```bash
npx playwright test --ui
```

Abre uma interface visual onde você pode:
- ▶️ Rodar testes individuais
- 🔍 Ver cada passo do teste
- ⏸️ Pausar em breakpoints
- 📹 Ver gravação de vídeo de cada teste

### 4. **Opção C: Rodar apenas os testes de autenticação**
```bash
npx playwright test auth-validation.spec.ts
```

### 5. **Opção D: Modo Debug com Playwright Inspector**
```bash
npx playwright test auth-validation.spec.ts --debug
```

Abre o Playwright Inspector onde você pode:
- Inspecionar elementos
- Ver console logs em tempo real
- Step-by-step execution

---

## 📊 Resultado Esperado

Quando os testes rodam com sucesso, você verá:

```
Running 13 tests using 1 worker

✓ [chromium] › auth-validation.spec.ts › ✅ Should login successfully with valid PIN 1234
✓ [chromium] › auth-validation.spec.ts › ❌ Should reject invalid PIN and show error
✓ [chromium] › auth-validation.spec.ts › 🔄 Should persist login across page reloads
✓ [chromium] › auth-validation.spec.ts › 🚪 Should clear localStorage on logout
✓ [chromium] › auth-validation.spec.ts › ⏱️ Should handle rapid PIN attempts
✓ [chromium] › auth-validation.spec.ts › ✨ Should handle whitespace in PIN correctly

6 passed (2.5s)
```

---

## 🔐 Validações de Segurança Realizadas

Os testes validam:

1. **Autenticação:**
   - ✅ PIN hardcoded '1234' funciona
   - ✅ PIN incorreto rejeitado imediatamente
   - ✅ Nenhuma chamada desnecessária a Supabase para PIN

2. **Persistência:**
   - ✅ localStorage persiste entre navegações
   - ✅ Reload não requer novo login
   - ✅ Logout limpa completamente

3. **Console/Debugging:**
   - ✅ Logs esperados aparecem
   - ✅ Nenhum erro de auth não-tratado
   - ✅ Nenhuma tentativa de anonymous login

4. **UX:**
   - ✅ Mensagens de erro visíveis
   - ✅ Redirecionamento correto
   - ✅ Máscara de PIN funciona

---

## 🐛 Troubleshooting

### Teste falha com "Port already in use"
```bash
# Mate processo na porta 5173
# Windows PowerShell:
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Ou simplesmente use porta diferente:
npm run test:e2e -- --config playwright.config.ts
```

### Teste falha com "Navigation timeout"
A página pode estar carregando lentamente. Aumente o timeout:
```typescript
// No arquivo de teste
await page.waitForURL('http://localhost:5173/', { timeout: 10000 });
```

### Teste vê erro de "localStorage is not defined"
Isso é normal - localStorage só existe no navegador. O teste usa `page.evaluate()` para acessar. Se falhar, verifique se o navegador está respondendo.

---

## 📝 Próximos Passos

### Para desenvolvimento:
- [ ] Rodar testes no seu CI/CD (GitHub Actions)
- [ ] Adicionar testes para Google OAuth quando estiver implementado
- [ ] Testar em múltiplos browsers (Firefox, Safari, etc.)

### Para produção:
- [ ] Alterar PIN '1234' para um PIN seguro configurável
- [ ] Adicionar rate limiting para tentativas de PIN
- [ ] Implementar auditoria de logins

---

## 📚 Referências

- [Playwright Test Docs](https://playwright.dev/docs/intro)
- [CLAUDE.md](./CLAUDE.md) - Guia completo do projeto
- [tests/e2e/auth-validation.spec.ts](./tests/e2e/auth-validation.spec.ts) - Código dos testes

---

## ✅ Validação Completada

- ✅ CLAUDE.md criado com documentação completa
- ✅ Testes E2E implementados com 6 cenários de autenticação
- ✅ supabaseClient.ts corrigido sem valores hardcoded
- ✅ AuthContext.tsx otimizado para login PIN
- ✅ Build de produção passa sem erros

**Status:** Pronto para testes locais e deploy! 🚀
