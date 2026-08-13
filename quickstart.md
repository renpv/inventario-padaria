# Padaria Inventário & WMS - Quickstart / Verification Checklist

Este checklist cobre todo o fluxo básico do sistema, simulando uma avaliação final (Homologação) antes do Deploy em Produção e detalhando os passos para rodar na sua máquina local ou configurar do zero no Vercel/Supabase.

## 1. Configurando Supabase e Migrations

Para instanciar o Supabase com todos os domínios do banco de dados e os RPCs customizados:
1. Acesse o painel do seu projeto no Supabase e vá para o SQL Editor.
2. Copie e cole, sequencialmente, os seguintes scripts da pasta `supabase/migrations/`:
   - `20260812204800_initial_schema.sql` (Criação de Tabelas)
   - `20260812205500_security_and_rpc.sql` (RLS e Auth RPC)
   - `20260812210500_self_healing_rpc.sql` (Injeção de Faltas/Turnos Omissos)
   - `20260812211500_wms_calculations.sql` (Rotinas WMS)
   - `20260812220000_fiado_logic.sql` (Limites Globais Fiado US4)
3. Habilite o Login via Google Auth em *Authentication -> Providers*.

## 2. Configurando o Ambiente (Frontend)

O frontend React se comunica com o Supabase através do arquivo `.env` configurado.
1. Crie o arquivo `.env` usando `.env.example` como molde.
2. Adicione sua VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY coletados em *Settings -> API* no painel do Supabase.
3. Instale os pacotes e inicialize:
   ```bash
   npm install
   npm run dev
   ```

## 3. PWA (Progressive Web App)

Este repositório está munido do pacote `vite-plugin-pwa` e dos ícones `pwa-192x192.png` e `pwa-512x512.png`.
Se o site for rodado em HTTPS e sem erros em Console, navegadores mobile apresentarão a opção nativa de "Adicionar à Tela Inicial", instalando o sistema no celular como um app imersivo.

Para testar o modo PWA:
```bash
npm run build
npm run preview
```
Inspecione no Chrome (F12) > Lighthouse > Gerar Relatório PWA. 

## 4. Roteiro de Verificação E2E

Siga os seguintes passos para homologação cruzada do sistema:
- [ ] Logar como operador pelo PIN (`1234`), simular a ausência de internet via DevTools (Aba Network -> Offline), escolher o Setor de Bebidas e ditar `Quatro cocas zeros` (Fuzzy Match em "Coca-cola Zero" = 4).
- [ ] Voltar a rede (Online), constatar via DevTools/Network a submissão via IndexedDB pushando ao backend.
- [ ] Ir em Fiados, lançar um adiantamento no funcionário "Teste Funcionario" em quantia de `R$ 49,00`. Tentar novamente outro adiantamento de `R$ 5,00`. Esperado que lance um alerta visual de recusa do Trigger SQL.
- [ ] Entrar na tela Restrita `/gestao` via Auth Google. Navegar aos Créditos, abrir extrato do funcionário, emitir uma "Quitação" de `R$ 54,00` e ver a linha retroativa sendo amortizada no cálculo de `saldoApos`.

Se todas as etapas acima responderem corretamente, o sistema está **pronto para produção.**
