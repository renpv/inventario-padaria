# Research Notes: Padaria Inventário & WMS

## 1. Voice Recognition & Fuzzy Matching
- **Decision**: Web Speech API (`webkitSpeechRecognition`) for local frontend transcription + Levenshtein Distance library/utils for fuzzy matching.
- **Rationale**: Web Speech API is built into modern Chrome (target browser) and provides direct speech-to-text without network cost or external APIs. Levenshtein algorithm provides simple, lightweight local matching between transcribed words and the active product list.
- **Alternatives Considered**: 
  - *Whisper API (OpenAI)*: Rejected due to API cost, network latency, and complexity of online-only dependencies.

## 2. Offline State & Sinking Queue
- **Decision**: Dexie.js for wrapping IndexedDB, combined with an active queue mechanism. Conflitos de sincronização concorrente são resolvidos adotando a estratégia de "última escrita vence" (Last Write Wins), comparando os timestamps no servidor Supabase.
- **Rationale**: Dexie.js provides a clean, promise-based API over IndexedDB. Drafts are stored locally per sector/shift. Upon reconnection (detected via `window.navigator.onLine` and pinging Supabase), the sync module pushes pending logs.
- **Alternatives Considered**: 
  - *Direct LocalStorage*: Rejected because of the 5MB size limit and lack of structured index querying for large product lists.

## 3. PIN-based Operational Authentication & RLS
- **Decision**: Validate PIN via RPC `validar_pin(pin)` which verifies the value in the `configuracoes` table. For row-level security (RLS), the operational device is authenticated using a shared custom anonymous/restricted JWT or a predefined generic user role `operacional` managed in Supabase Auth.
- **Rationale**: Keeps the operation simple (no personal login required) while complying with PostgreSQL RLS.
- **Alternatives Considered**:
  - *Bypassing RLS entirely for operation*: Rejected. Bypassing RLS poses security risks for the WMS.

## 4. Automatic Shift Log Injection (Self-Healing)
- **Decision**: Triggered on the client or via a Postgres RPC function when a new shift is initiated.
- **Rationale**: A PL/pgSQL function runs on shift initialization, queries active turnos, identifies missing previous shifts for the day, and inserts `NÃO REALIZADO` entries in a single transaction.
- **Alternatives Considered**:
  - *Frontend-driven loops*: Rejected. Network failure during individual shift insertions could corrupt the database audit trail.
