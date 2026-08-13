# Tasks: Sistema de Inventário e WMS (Padaria)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Initialize React project with Vite template in repository root
- [x] T002 Configure Supabase client settings in `src/services/supabaseClient.ts`
- [x] T003 [P] Configure Vitest and setup config in `vite.config.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core database tables, security rules, and base UI layouts

- [x] T004 Create database schema migrations for 14 entities in `supabase/migrations/`
- [x] T005 Setup Row Level Security (RLS) policies for roles in `supabase/migrations/`
- [x] T006 [P] Create main application layout and routing in `src/components/Layout.tsx` and `src/App.tsx`
- [x] T007 [P] Implement PIN validation RPC function `validar_pin` in `supabase/migrations/`
- [x] T008 [P] Configure global state for Auth and connection status in `src/context/AuthContext.tsx`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Inventário por Turno com Captura de Voz (Priority: P1)

**Goal**: Allow operators to input product counts using Web Speech API and manual controls in a mobile-first interface.

**Independent Test**: Access the sector page, click the mic, speak product names with quantities, and see matching counts updated.

### Implementation for User Story 1

- [x] T009 [P] [US1] Create Sector selection view in `src/pages/SectorSelector.tsx`
- [x] T010 [P] [US1] Create Product listing component with quick action buttons in `src/components/ProductList.tsx`
- [x] T011 [US1] Implement voice capturing hook using Web Speech API in `src/hooks/useSpeechToText.ts`
- [x] T012 [US1] Implement local fuzzy matching utility (Levenshtein) in `src/utils/fuzzyMatcher.ts`
- [x] T013 [US1] Build shift inventory layout with "Forçar Fechamento" modal in `src/pages/ShiftInventory.tsx`
- [x] T014 [US1] Write unit tests for fuzzy matching logic in `src/utils/fuzzyMatcher.test.ts`

**Checkpoint**: User Story 1 is functional for voice inputs and inventory records.

---

## Phase 4: User Story 2 - Resiliência com Operação Offline e Self-Healing (Priority: P1)

**Goal**: Save drafts locally during disconnection and auto-generate missed shifts.

**Independent Test**: Terminate network connection, edit counts, verify local retention, reconnect, and check sync. Trigger next shift and confirm generation of missed previous shifts.

### Implementation for User Story 2

- [x] T015 [P] [US2] Setup IndexedDB schema for draft items using Dexie in `src/services/offlineQueue.ts`
- [x] T016 [US2] Implement draft auto-save and restore hooks in `src/hooks/useIndexedDB.ts`
- [x] T017 [US2] Create sync daemon to push local queues to Supabase in `src/services/syncDaemon.ts`
- [x] T018 [US2] Write PostgreSQL RPC function for shift self-healing checks on shift init in `supabase/migrations/`
- [x] T019 [US2] Write integration tests for shift self-healing in `supabase/tests/self_healing.test.sql`

**Checkpoint**: System maintains draft integrity offline and enforces historical logs.

---

## Phase 5: User Story 3 - Sugestão e Simulação de Compra (WMS) (Priority: P2)

**Goal**: Provide purchase recommendations using formulas and vendor simulation.

**Independent Test**: Verify calculated purchase requirements against mock databases in the WMS dashboard.

### Implementation for User Story 3

- [x] T020 [P] [US3] Create SQL views for current stock calculations in `supabase/migrations/`
- [x] T021 [US3] Implement purchase suggestion formula function in `supabase/migrations/`
- [x] T022 [US3] Build WMS dashboard interface displaying suggested quantities in `src/pages/WmsDashboard.tsx`
- [x] T023 [US3] Build shareable order preview panel (WhatsApp export) in `src/components/OrderPreview.tsx`
- [x] T024 [US3] Write unit tests verifying purchase suggestion formula bounds in `src/utils/mathCalculations.test.ts`

**Checkpoint**: WMS provides accurate purchases suggestions and sharing options.

---

## Phase 6: User Story 4 - Controle de Fiado (Crédito Loja) (Priority: P3)

**Goal**: Manage staff store debts with active limit blocking and gestion-only overrides.

**Independent Test**: Register staff member, attempt debit beyond limit, verify refusal, log in as manager and quit outstanding balance.

### Implementation for User Story 4

- [x] T025 [P] [US4] Create staff credit activity log component in `src/components/StaffCreditHistory.tsx`
- [x] T026 [US4] Implement database checks preventing writes exceeding `limite_global_fiado` in `supabase/migrations/`
- [x] T027 [US4] Create managerial debit clearance interface in `src/pages/CreditManagement.tsx`
- [x] T028 [US4] Write integration tests verifying operational account exclusion from quitações in `supabase/tests/fiado_security.test.sql`

**Checkpoint**: Credit limits are strictly enforced on db level and clearance restricted.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation updates, UI styling polish, and system-wide verification.

- [x] T029 Update system documentation in `README.md`
- [x] T030 Perform system-wide verification checklist in `quickstart.md`
- [x] T031 Optimize application build bundle size and check PWA install configurations

---

## Phase 8: Adequação à Constituição (E2E e Cobertura)

**Purpose**: Garantir 100% de adequação ao item IV da Constituição (Test-Driven & Qualidade Garantida).

- [x] T032 Install `@vitest/coverage-v8` to enforce unit test coverage rule.
- [x] T033 Write E2E test for WMS Flow in `tests/e2e/wms-flow.spec.ts`.
- [x] T034 Write E2E test for Fiado Flow in `tests/e2e/fiado-flow.spec.ts`.

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Phase 1 completion. Blocks all subsequent user stories.
- **User Stories (Phases 3-6)**: Depend on Phase 2 completion. Executed in priority order.
- **Polish (Phase 7)**: Depends on all user stories being completed.

---

## Parallel Example: User Story 1

```bash
# Models/Utils and independent Views can start together:
Task: "Create Sector selection view in src/pages/SectorSelector.tsx"
Task: "Create Product listing component with quick action buttons in src/components/ProductList.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 & 2)
1. Complete Setup and Foundational phases.
2. Complete Voice Input (US1) and Offline storage (US2) tasks.
3. Test locally using quickstart validation guide.
