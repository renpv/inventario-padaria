// Cria (idempotente) uma conta de teste dedicada com role='gestao', usada
// pelos testes e2e/integração para autenticar sem depender do fluxo real de
// Google OAuth (não automatizável). Ver tests/e2e/helpers.ts (loginAsGestor).
//
// Requer SUPABASE_SERVICE_ROLE_KEY em .env.local (nunca commitado — a chave
// tem acesso administrativo total, contorna RLS). Nunca usar essa chave em
// código do cliente (src/).
//
// Uso: node scripts/setup-test-gestor.mjs
import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const loadEnvFile = (path, target) => {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key && target[key] === undefined) target[key] = value;
  }
};

loadEnvFile('.env', process.env);
loadEnvFile('.env.local', process.env);

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.E2E_GESTAO_TEST_EMAIL ?? 'e2e-gestao-test@padaria.local';
const password = process.env.E2E_GESTAO_TEST_PASSWORD;

if (!url || !serviceKey || !password) {
  console.error(
    'Faltam variáveis: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e E2E_GESTAO_TEST_PASSWORD precisam estar em .env/.env.local.'
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: existingUsuario } = await admin
  .from('usuarios')
  .select('id_usuario, auth_user_id, role, ativo')
  .eq('email', email)
  .maybeSingle();

if (!existingUsuario) {
  // Pré-whitelist ANTES de criar o auth user: o trigger handle_new_user
  // vincula auth_user_id automaticamente quando o e-mail já existe aqui.
  const { error } = await admin.from('usuarios').insert({ nome: 'E2E Test Gestor', email, role: 'gestao', ativo: 'SIM' });
  if (error) {
    console.error('Falha ao pré-cadastrar usuarios:', error.message);
    process.exit(1);
  }
  console.log('usuarios: linha criada (pré-whitelist).');
} else if (existingUsuario.role !== 'gestao' || existingUsuario.ativo !== 'SIM') {
  await admin.from('usuarios').update({ role: 'gestao', ativo: 'SIM' }).eq('id_usuario', existingUsuario.id_usuario);
  console.log('usuarios: linha existente corrigida (role/ativo).');
} else {
  console.log('usuarios: linha já existente e correta.');
}

const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
let user = list?.users?.find((u) => u.email === email);

if (!user) {
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    console.error('Falha ao criar auth user:', error.message);
    process.exit(1);
  }
  user = created.user;
  console.log('auth.users: usuário criado.');
} else {
  await admin.auth.admin.updateUserById(user.id, { password });
  console.log('auth.users: usuário já existia, senha sincronizada.');
}

const { data: linked } = await admin.from('usuarios').select('auth_user_id, role, ativo').eq('email', email).maybeSingle();
if (linked?.auth_user_id !== user.id) {
  console.error('AVISO: o gatilho handle_new_user não vinculou auth_user_id corretamente. Verifique a migração 20260813103000_auth_whitelist.sql.');
  process.exit(1);
}

console.log(`OK — conta de teste gestão pronta: ${email} (auth_user_id=${user.id}, role=${linked.role}, ativo=${linked.ativo}).`);
