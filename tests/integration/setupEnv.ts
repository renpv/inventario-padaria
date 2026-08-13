import { readFileSync, existsSync } from 'fs';

// Garante que variáveis SEM prefixo VITE_ (ex.: E2E_GESTAO_TEST_EMAIL,
// SUPABASE_SERVICE_ROLE_KEY) fiquem disponíveis via `process.env` nos testes
// de integração — o Vite só expõe automaticamente as prefixadas com VITE_
// em `import.meta.env`, por design (evita vazar segredos no bundle do
// cliente). Isso roda em Node puro, então não é afetado por esse filtro.
const loadEnvFile = (path: string) => {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
};

loadEnvFile('.env');
loadEnvFile('.env.local');
