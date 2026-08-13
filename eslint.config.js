import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'dev-dist', 'dist-ssr', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Dispara em todo "fetch on mount" (useEffect(() => { fetchData() }, []),
      // com setLoading(true) como primeira linha) — o padrão dominante nesta
      // base, usado de forma correta e intencional em ~15 componentes.
      // Corrigir de verdade exigiria adiar cada chamada via microtask
      // (queueMicrotask/Promise.resolve().then) só para satisfazer uma regra
      // nova/experimental (voltada para compatibilidade com o React Compiler),
      // sem ganho real numa app de baixo tráfego. Ver CLAUDE.md.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
