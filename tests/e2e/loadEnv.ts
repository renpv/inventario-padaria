import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Loader mínimo de .env para os testes Playwright, que rodam em Node puro
 * (sem passar pelo pipeline do Vite, então `import.meta.env` não é populado
 * aqui). Carrega `.env` e depois `.env.local` (que sobrescreve `.env`,
 * mesma precedência do Vite), sem sobrescrever variáveis já definidas no
 * processo. Evita adicionar a dependência `dotenv` só para isso.
 */
const loadEnvFile = (path: string) => {
  if (!existsSync(path)) return;
  const content = readFileSync(path, 'utf8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex).trim();
    const value = line.slice(eqIndex + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

export const loadEnv = () => {
  const root = resolve(__dirname, '../..');
  loadEnvFile(resolve(root, '.env'));
  loadEnvFile(resolve(root, '.env.local'));
};

loadEnv();
