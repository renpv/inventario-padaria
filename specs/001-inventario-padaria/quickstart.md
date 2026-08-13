# Quickstart Validation Guide: Padaria Inventário & WMS

This guide assists in executing local verification tasks to validate the core behaviors of the Padaria Inventário & WMS application.

## Prerequisites

- Node.js LTS installed.
- Supabase CLI installed (for local database emulation / migrations).

## 1. Setup & Installation

Install dependencies and start development server:
```bash
npm install
npm run dev
```

Run Supabase locally (optional, if emulating backend):
```bash
supabase start
```

## 2. Core Validation Scenarios

### Scenario A: Voice Input and Fuzzy Matching
1. Navigate to the operational dashboard at `/`.
2. Input the operational PIN (default: `1234`).
3. Click on the "Padaria" sector.
4. Click the "Microfone" icon. Say: `"pão francês 50"`.
5. Verify that the input box for "Pão Francês" is auto-populated with `50` and the matching similarity threshold passed.

### Scenario B: Shift Flow & Self-Healing
1. In the database configuration, set four active shifts.
2. Log in and initiate the 3rd shift (`Tarde - entrada`).
3. Verify that `lancamentos_op` auto-injects two logs with status `NÃO REALIZADO` for shifts 1 and 2.

### Scenario C: Offline Cache
1. Disconnect the network (toggle DevTools Offline mode).
2. Edit product quantities in the "Padaria" sector.
3. Refresh the page.
4. Verify that the values persist under the offline cache warning.
5. Reconnect network and verify automatic synchronization status updates.

## 3. Running Automated Tests

Run the test suite to validate the math calculations and trigger logic:
```bash
npm run test
```
