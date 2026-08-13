# Implementation Plan: Sistema de Inventário e WMS (Padaria)

**Branch**: `001-inventario-padaria` | **Date**: 2026-08-12 | **Spec**: [spec.md](file:///d:/dev/padaria-inventario-react/specs/001-inventario-padaria/spec.md)

**Input**: Feature specification from `/specs/001-inventario-padaria/spec.md`

## Summary

This plan outlines the architecture, database design, and implementation phases for the Padaria Inventário & WMS application. The system leverages Supabase (PostgreSQL, Auth, Edge Functions) for the backend and React (PWA) for the mobile-first frontend. The design focuses on voice-first inventory input, offline robustness, sequential shift locks, self-healing audits, and WMS inventory metrics.

## Technical Context

**Language/Version**: JavaScript / TypeScript (Node.js LTS, React 18+)

**Primary Dependencies**: `@supabase/supabase-js`, `react-router-dom`, `lucide-react`, `indexeddb-connected` (or local forage/Dexie.js for IndexedDB)

**Storage**: PostgreSQL (Supabase relational DB) + IndexedDB/localStorage (offline drafts)

**Testing**: Vitest (Unit & Integration tests) + Playwright (E2E testing)

**Target Platform**: Progressive Web App (PWA) optimized for mobile Chrome browser

**Project Type**: React SPA + Supabase backend

**Performance Goals**: Instant transcription response (<200ms fuzzy matching local processing latency), smooth PWA transition

**Constraints**: Offline-capable for operations, strict Google OAuth requirement for management, PIN required for operation

**Scale/Scope**: 1 bakery location, dozens of products, 4 daily shifts, 1 shared device

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Voice-First Input**: Confirmed. Transcriptions processed locally via Web Speech API fuzzy matching.
- **Offline Drafts**: Confirmed. Local IndexedDB cache stores work-in-progress contagens before server upload.
- **Strict Shifts & Self-Healing**: Confirmed. DB functions enforce turn order, automatically injecting "NÃO REALIZADO" on skip.
- **WMS Formula Compliance**: Confirmed. Suggestions calculated purely via the defined relational logic.
- **Role Boundary**: Confirmed. Separation between PIN-based operation and OAuth-based management.

## Project Structure

### Documentation (this feature)

```text
specs/001-inventario-padaria/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (created by tasks command)
```

### Source Code (repository root)

```text
src/
├── components/          # Reusable UI parts (VoiceButton, Layout, InputField)
├── context/             # AuthContext, SyncContext
├── hooks/               # useSpeechToText, useIndexedDB
├── pages/               # OperationalDashboard, ManagementDashboard, Login, PINAuth
├── services/            # supabaseClient, offlineQueue
├── utils/               # fuzzyMatcher, mathCalculations
└── index.css            # Stylesheet with warm theme

supabase/
├── migrations/          # PostgreSQL schemas, functions, and triggers
└── functions/           # Edge functions (e.g. email-sender)
```

**Structure Decision**: Standard React + Supabase structure using a mono-repo layouts with backend components inside `supabase/` and frontend within `src/`.

## Complexity Tracking

*No constitution violations detected.*
