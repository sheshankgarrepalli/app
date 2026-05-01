# QA Report — Static Chaos Audit

**Date:** 2026-05-01
**Scope:** POS Checkout (split-payment/layaway), Device State Machine, Transfer Orders, Invoice Lifecycle
**Methodology:** Full static audit of backend routers, state machine, and frontend state management

---

## Critical Vulnerabilities

### CVE-001: Transfer Dispatch Does Not Block Layaway Devices

**Severity:** HIGH
**Files:** `api/routers/transfers_router.py:71`, `src/pages/TransferDispatch.tsx:35`

The transfer dispatch validation blocks `In_Transit` and `Sold` but does **not** block `Reserved_Layaway`. A customer who has placed a device on layaway with a partial deposit can have their device transferred to another location and sold to someone else. The device is physically at the store but the system allows it to be transferred out.

**Fix:** Add `DeviceStatus.Reserved_Layaway` to the blocked statuses list in both frontend and backend.

```python
# transfers_router.py line 71
if old_status in [models.DeviceStatus.In_Transit, models.DeviceStatus.Sold, models.DeviceStatus.Reserved_Layaway]:
```

---

### CVE-002: Bulk-Route Completely Bypasses the State Machine

**Severity:** CRITICAL
**File:** `api/routers/transfers_router.py:11-43`

The `bulk_route_devices` endpoint directly mutates `device.device_status = req.destination` without going through `state_machine.execute_transition()`. This means:

- No transition map validation (any status → any status is allowed)
- No side-effects fire (RepairTickets are not created, locations are not updated)
- No `Requirement` checks run
- History logs are still written manually, but with no validation

An attacker (or bug) can route a `Sold` device to `Sellable`, skip QC entirely, or create invalid state combinations.

**Fix:** Replace the direct status assignment with `state_machine.execute_transition()`.

---

### CVE-003: POS Checkout Has No Idempotency Protection

**Severity:** MEDIUM
**File:** `api/routers/pos_router.py:17-135`, `src/pages/POS.tsx:233-272`

The frontend sets `isProcessing` state, but React state updates are asynchronous. A determined double-click (or a network retry from axios) can fire two POST requests before the first one commits. The second request races against the first:

- If the first request marks devices as `Sold`/`Reserved_Layaway` before the second reads them, the second fails with "not sellable" — acceptable
- If the second request reads devices before the first commits, both succeed — **duplicate invoices for the same devices**

No idempotency key, no database-level lock (`SELECT ... FOR UPDATE`), no unique constraint on (imei, invoice_id) pairs.

**Fix:** Add `with_for_update()` on device queries, or pass an idempotency key from the frontend, or wrap the entire checkout in a serializable transaction.

---

### CVE-004: Manifest Verification Always Sets Sellable Regardless of Transit Type

**Severity:** MEDIUM
**File:** `api/wms_core.py:269`

The `verify_manifest_imeis` function always sets `device.device_status = DeviceStatus.Sellable` (line 269), even for devices that were in `Transit_to_Repair` or `Transit_to_QC`. This is inconsistent with `bulk_receive_devices` (transfers_router.py:118-155) which correctly routes to the appropriate status.

**Fix:** Mirror the logic from `bulk_receive_devices` — check the previous status and route accordingly.

---

### CVE-005: No Location Ownership Check on Transfer Dispatch

**Severity:** MEDIUM
**File:** `api/routers/transfers_router.py:46-99`

The `dispatch_transfer` endpoint does not verify that the authenticated user's location actually holds the devices being dispatched. A `store_a` cashier can dispatch devices from `store_b` inventory if they know the IMEIs.

**Fix:** Add `device.location_id == current_user.role` (or `current_user.store_id`) to the dispatch validation.

---

### CVE-006: Negative Payments and Silent Overpayment Absorption

**Severity:** LOW-MEDIUM
**File:** `api/routers/pos_router.py:418-420`

When processing layaway payments, `customer.current_balance -= payment.amount` can go negative, and the code silently resets it to 0 with `if customer.current_balance < 0: customer.current_balance = 0`. This silently absorbs overpayments rather than flagging them as errors.

The same pattern exists in RMA returns (line 558-559).

**Fix:** Raise an error if `payment.amount` exceeds what's actually owed, rather than silently capping.

---

### CVE-007: $0 Tender Creates Layaway With Zero Collected

**Severity:** LOW
**File:** `api/routers/pos_router.py:69-88`, `src/pages/POS.tsx:237`

The frontend blocks `activeSlots.length === 0`, but the API has no such guard. Sending `payments: []` creates an invoice with `Partial_Layaway` status and `Reserved_Layaway` on devices with $0 collected. This is technically valid layaway behavior, but without any deposit requirement, devices can be reserved indefinitely at no cost.

**Fix:** Require a minimum deposit percentage (e.g., 10%) for layaway transactions at the API level.

---

## Usability Friction

### UX-001: Scanner Always-On Conflicts With Form Inputs

**File:** `src/pages/POS.tsx:89-97`

The barcode scanner focus keeper forces focus back to the scan input whenever the user clicks elsewhere. This fights against the user when they try to:
- Search for a customer by typing in the CRM search box
- Enter payment amounts in tender slots
- Type reference IDs

Every click outside an input steals focus back to the scanner. Users must carefully click into fields and type fast.

### UX-002: No Undo After Removing Device From Cart

**File:** `src/pages/POS.tsx`

Devices removed from the cart are gone permanently. There's no undo mechanism. In a high-volume store environment with barcode scanning, accidental removals lose the sale and require re-scanning.

### UX-003: Layaway Payment Flow Is Disconnected From Cart

**File:** `src/pages/POS.tsx:274-299`

The layaway payment section is a separate panel from the main checkout flow. To process a layaway payment, the cashier must:
1. Switch mental context from "sale" to "layaway payment"
2. Search for the invoice
3. Enter a payment amount manually (no "pay remaining" button)

No quick "Pay off remaining balance" shortcut button exists.

### UX-004: Error Messages Are Transient

**File:** `src/pages/POS.tsx:109`

The `errorStatus` state is displayed as a banner, but it disappears on the next successful action. If a user misses the error message, they have no queue of past errors to review. Multiple errors in sequence (e.g., scanning 3 bad IMEIs) only show the last one.

### UX-005: No Loading State Distinction Between Scan Lookup and Processing

**File:** `src/pages/POS.tsx`

Both IMEI lookup and checkout use the same `isProcessing` state. During checkout, the scan input appears disabled but there's no visual distinction between "looking up this IMEI" and "processing payment." The user may think the system froze.

---

## Race Conditions Discovered

| ID | Description | Location | Severity |
|----|-------------|----------|----------|
| RC-001 | Double POST to `/checkout` can create duplicate invoices | `pos_router.py:17` | MEDIUM |
| RC-002 | Rapid parallel transitions on same IMEI can both succeed | `inventory_router.py:431` | LOW |
| RC-003 | Invoice payment + void can interleave (pay then void, payment orphaned) | `pos_router.py:348,754` | LOW |
| RC-004 | Bulk blind intake duplicate IMEI idempotency check is not atomic | `inventory_router.py:303` | LOW |

---

## Unhandled Null States

| ID | Description | Location |
|----|-------------|----------|
| NS-001 | `device.device_status` can be `None` during transition — `state_machine.execute_transition` handles `None` in TRANSITION_MAP but logs `.value` which crashes | `state_machine.py:272` |
| NS-002 | `customer_db_obj` can be `None` after auto-create fails silently — pricing tier defaults to 0 but no error logged | `pos_router.py:56` |
| NS-003 | `org_settings` can be `None` (no row for org) — invoice_terms silently set to None, PDF renders default text, no warning | `pos_router.py:131-134` |
| NS-004 | `device.model` relationship can return `None` for unscanned/hydrated devices — `brand` and `name` accesses crash | `POS.tsx:162-163` handled with fallback, but `TrackDevice.tsx` and `CentralInventory.tsx` may crash |

---

## Test Execution Plan

### Prerequisites

```bash
# Install Playwright (already available via npx)
npx playwright install chromium

# Create playwright.config.ts if it doesn't exist
cat > tests/playwright.config.ts << 'EOF'
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: process.env.TEST_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
EOF
```

### Running the Abuse Suite

```bash
# Start the dev servers first
# Terminal 1: Backend
cd api && uvicorn main:app --reload --port 8000

# Terminal 2: Frontend
npm run dev

# Terminal 3: Run the abuse tests
TEST_URL=http://localhost:5173 API_URL=http://localhost:8000 npx playwright test tests/e2e/workflow_abuse.spec.ts

# For headed mode (watch the browser)
TEST_URL=http://localhost:5173 API_URL=http://localhost:8000 npx playwright test --headed tests/e2e/workflow_abuse.spec.ts

# Run only critical abuse tests
npx playwright test tests/e2e/ --grep "ABUSE-00[1-5]"
```

### Authentication Setup

The abuse tests hit the API directly for most tests (bypassing Clerk auth). For UI tests that require a logged-in session, you have two options:

**Option A — Mock auth in dev mode:**
Set `VITE_BYPASS_AUTH=true` in `.env` and configure the backend to accept a test header.

**Option B — Record a logged-in session:**
```bash
# Login manually once and save the storage state
npx playwright codegen --save-storage=auth.json http://localhost:5173
# Then run tests with the saved state
npx playwright test --storage-state=auth.json
```

### Expected Results

- **Tests that PASS today and SHOULD PASS:** ABUSE-003, 004, 005, 008, 010, 011, 012, 016, 017, 018, 019, 020, 023, 024, 025
- **Tests that PASS today but SHOULD FAIL (bugs):** ABUSE-007 (layaway transfer not blocked), ABUSE-009 (bulk-route bypasses state machine)
- **Tests that may FLAKE (race conditions):** ABUSE-001 (double checkout), ABUSE-014 (double transition)
- **Tests that need real data seeded:** ABUSE-002, 006, 021, 022

### After Fixing Bugs, These Tests Should Change Behavior:

| Test | Current Expected | After Fix Expected |
|------|-----------------|-------------------|
| ABUSE-007 | 200 OK (bug) | 400 "cannot be dispatched" |
| ABUSE-009 | 200 OK (bug) | 400 "Cannot transition" |
| ABUSE-006 | 200 OK | 400 "Payment exceeds balance" |

---

## Summary

- **7 critical/moderate vulnerabilities** found — top priority is CVE-002 (bulk-route bypasses state machine) and CVE-001 (layaway devices can be transferred)
- **5 usability friction points** — scanner focus-stealing is the most impactful for daily operations
- **4 race conditions** — double-checkout is the only one likely to manifest in production
- **4 unhandled null states** — NS-001 (None.status.value crash) is the only one that can cause a 500 error
- **27 abuse test cases** written in `tests/e2e/workflow_abuse.spec.ts`
