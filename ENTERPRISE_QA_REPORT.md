# ENTERPRISE QA REPORT — AMAFAH ERP

**Generated:** 2026-05-01
**Audit scope:** Full-stack (React frontend + FastAPI backend)
**Personas audited:** Store Owner/Admin, Warehouse Manager, Retail Cashier, Repair Tech
**Methodology:** Static workflow trace, code deduplication scan, N+1 query analysis, error handling audit

---

## 1. USABILITY SHORTCOMINGS

### 1.1 "Grandma Test" Failures

These are points where a non-technical user would get stuck or confused.

| # | Issue | Impact | Location |
|---|-------|--------|----------|
| 1 | **`alert()` used for errors in 7+ places** — raw browser alerts are disorienting, block the UI, and give no recovery path | Users get a jarring popup with a raw error string, then are left wondering what to do next | BulkTransfer:58, ReceiveInventory:48, UserManagement:43, AuctionImporter:82, RapidAudit:45, SystemAdmin:89, InventoryManager:221 |
| 2 | **No "New Customer" button during checkout** — cashier must abandon their cart to create a customer | Sale interrupted. Cashier either processes as walk-in (losing CRM data) or loses the sale | POS.tsx — CustomerModal not accessible during checkout |
| 3 | **FinanceHub has two "Under Construction" tabs** — Profitability & COGS and Daily Z-Reports lead to dead placeholder text | Admin clicks expecting reports, gets nothing. Looks broken. | FinanceHub.tsx:35-42 |
| 4 | **InvoiceForm gear menu has disabled checkboxes for features that already exist** — "Schedule recurring (coming soon)" is disabled despite RecurringInvoices.tsx being fully implemented | Admin sees a disabled feature and assumes it's not built, never discovers the working /invoices/recurring page | InvoiceForm.tsx gear dropdown |
| 5 | **InvoicesDashboard action buttons do nothing** — FileText and Printer icons have no onClick handlers | User clicks to view/print an invoice, nothing happens. No feedback. Silence. | InvoicesDashboard.tsx:96-111 |
| 6 | **No receipt/invoice printing from POS success screen** — after completing a sale, there is no print button | Cashier can't give customer a receipt. Must navigate to InvoiceManagement to print. | POS.tsx success state |

### 1.2 Power User Friction

These slow down experienced users who know the system.

| # | Issue | Clicks Wasted | Location |
|---|-------|---------------|----------|
| 1 | **4 different pages for invoice operations** — InvoicesDashboard (broken), InvoiceManagement, InvoiceForm, InvoicingSystem (dead) | Power user has to remember which page actually works for which task | 4 files, 2 wired |
| 2 | **3 different payment UIs** — POS inline tender, CheckoutModal, PaymentModal — each with different payment method lists (6 vs 4 vs 3 methods) | Muscle memory broken when switching between pages | POS.tsx, CheckoutModal.tsx, PaymentModal.tsx |
| 3 | **3 different transfer receiving flows** — ReceiveShipment (per-IMEI manifest verify), ReceiveInventory (IMEI batch), CentralInventory (per-transfer acknowledge) | Warehouse manager must learn 3 different UIs for the same concept | 3 files |
| 4 | **No drag-and-drop on Kanban** — cards move via discrete action buttons only | Slower than drag-and-drop for power users processing 20+ repairs/day | TechKanban.tsx |
| 5 | **Hardcoded 50% markup** in POS.tsx IMEI scanner — `cost_basis * 1.5` on line 152 | Power user can't adjust pricing during checkout without editing each line item manually | POS.tsx:152 |
| 6 | **No bulk layaway operations** — each layaway must be paid individually | Store manager processing 10 layaway payments must repeat the same flow 10 times | POS.tsx layaway mode |

---

## 2. DUPLICATE / TECH DEBT AUDIT

### 2.1 Frontend Duplicates — DELETE OR MERGE

| Files | Relationship | Action |
|-------|-------------|--------|
| **InvoicesDashboard.tsx** (128 lines) vs **InvoiceManagement.tsx** (330 lines) | InvoicesDashboard is a stripped-down, broken copy of InvoiceManagement | **DELETE** InvoicesDashboard.tsx. Replace FinanceHub tab with InvoiceManagement |
| **InvoicingSystem.tsx** (643 lines) vs **InvoiceForm.tsx** (642 lines) | InvoicingSystem is dead code (not routed). Its IMEI-scanner-based invoice creation has no equivalent in InvoiceForm | **EXTRACT** scanner logic into a shared hook, **DELETE** InvoicingSystem.tsx |
| **WholesalePOS.tsx** (430 lines) | Dead code, never imported | **DELETE** or merge its fulfillment/shipping fields into POS.tsx |
| **AuditDashboard.tsx** (246 lines) vs **RapidAudit.tsx** (221 lines) | Same function (IMEI variance audit), different backends | **DELETE** AuditDashboard.tsx. Keep RapidAudit |
| **CheckoutCRMWidget.tsx** (80 lines) | Redundant customer search widget | **DELETE** — POS.tsx already has inline customer search |
| **PaymentModal.tsx** (108 lines) + **CheckoutModal.tsx** (160 lines) | Both duplicate POS.tsx's inline tender UI | **DELETE** both. POS.tsx split tender is the canonical implementation |
| **RepairDashboard.tsx** (103 lines) vs **TechKanban.tsx** (460 lines) | RepairDashboard is a simplified legacy view | **DELETE** RepairDashboard. Redirect /repair/dashboard to /repair/kanban |

**Total dead/unnecessary code: ~2,500 lines across 8 files**

### 2.2 Backend Duplicates

| Pattern | Locations | Action |
|---------|-----------|--------|
| Customer lookup (`db.query(UnifiedCustomer).filter(crm_id==X, org_id==Y).first()`) | 11 instances across pos_router, crm_router, wms_core | Extract to a `get_customer_by_crm_id(db, crm_id, org_id)` helper |
| Customer name formatting (`company_name or f"{first_name} {last_name}")`) | 9 instances | Extract to a `customer_display_name(customer)` helper |
| Invoice number generation (`db.query(Invoice).order_by(id.desc()).first()`) | 4 instances | Use a sequence or atomic counter — also fixes the race condition |
| Device state transitions bypassing state machine | 6 locations in pos_router.py | Route ALL status changes through `state_machine.execute_transition()` |
| Two labor rate backends | admin_router vs parts_router — different seed values | Unify on parts_router endpoints, remove admin_router labor rate endpoints |
| Two device catalog models | `PhoneModel` vs `DeviceCatalog` — overlap with different field names | Merge into `PhoneModel`, add `org_id` to it |

### 2.3 Missing Database Indexes

11 columns are queried repeatedly without indexes:

`sold_to_crm_id`, `assigned_transfer_order_id`, `serial_number` (DeviceInventory)
`imei` (InvoiceItems, ManifestItems, RepairTickets, DeviceCostLedger)
`invoice_id` (InvoiceItems)
`device_model_number` (RepairMapping)
`sku` (PartIntakes)
`timestamp` (DeviceHistoryLog)

### 2.4 N+1 Query Hotspots (4 Critical)

| File | Lines | Severity | Query Pattern |
|------|-------|----------|---------------|
| repair_router.py | 39-51 | HIGH | N queries for DeviceInventory inside ticket list loop |
| transfers_router.py | 238-253 | HIGH | N queries for DeviceInventory inside manifest items loop |
| repair_router.py | 272-300 | HIGH | 2N queries for RepairMapping + PartsInventory inside completion loop |
| pos_router.py | 44-61, 106-124 | HIGH | N `with_for_update()` queries for devices, then re-queries same devices again |

---

## 3. THE ENTERPRISE GAP

### What Makes This App Feel "Half-Baked" Compared to Enterprise Giants

**1. No undo, no confirmation safety net.**

Enterprise systems (NetSuite, SAP, QuickBooks) have confirmation dialogs before destructive actions. AMAFAH ERP voids invoices, scraps devices, and processes returns with a single click. There's no "Are you sure?" for any irreversible action. Void invoice? One click, gone. Scrap a $1,000 device? One click, scrapped. The undo path in pos_router.py (invoice correction endpoint at line 806) exists but is not exposed in the UI.

**2. Error handling is either missing or wrong.**

22 backend endpoints have no try/except. A database hiccup produces a raw Python stack trace to the user. On the frontend, 7+ components use `alert()` for errors — the crudest possible error UX. Enterprise apps provide: (a) inline error messages near the field that failed, (b) retry buttons, (c) graceful degradation when subsystems are down. AMAFAH does none of these.

**3. State management is schizophrenic.**

The `state_machine.py` file defines proper device state transitions with validation. But 6 places in pos_router.py bypass it entirely, setting `device_status` directly. This means the state machine says "you can't move a Sold device to In_Repair" but the checkout handler can do it anyway. In an enterprise system, the state machine is the single source of truth — nothing else touches state directly. This is the biggest architectural integrity problem in the codebase.

**4. The frontend routing is a maze.**

10 React page components are not directly wired in App.tsx. Users discover features by accident (navigating through deeply nested tabs inside tab containers). WholesalePOS.tsx (430 lines) and InvoicingSystem.tsx (643 lines) are fully implemented but completely unreachable. AuditDashboard.tsx is unreachable. This looks like a system built by multiple developers who never communicated.

**5. No audit trail for admin actions.**

The DeviceHistoryLog table exists but is only populated by the state machine (which is bypassed in 6 places). There's no log of who voided an invoice, who changed a price, who created a user, or who modified org settings. Enterprise systems make every admin action auditable. AMAFAH does not.

### Top 3 Things Required to Bridge the Gap

**1. Enforce the state machine as the single source of truth.**

Every device status change must go through `state_machine.execute_transition()`. Remove all direct `device_status = X` assignments from pos_router.py. This one change eliminates the biggest class of data integrity bugs and ensures the audit trail is always populated.

**Effort:** Human ~3 days / CC+gstack ~4 hours
**Impact:** Prevents devices getting into impossible states, ensures audit trail completeness, makes system behavior predictable.

**2. Replace all `alert()` calls with inline error components.**

Create a shared `<ErrorBanner>` and `<SuccessBanner>` component. Every page that currently uses `alert()` gets proper inline feedback. Add confirmation dialogs before void/scrap/return actions.

**Effort:** Human ~2 days / CC+gstack ~3 hours
**Impact:** Users go from "what just happened?" to "I see the problem, let me fix it." This is the single biggest UX improvement.

**3. Delete dead code and unify duplicates.**

Remove the 8 dead/duplicate frontend files (~2,500 lines). Extract shared backend helpers for customer lookup and name formatting. Add the 11 missing database indexes. Fix the 4 N+1 query hotspots.

**Effort:** Human ~3 days / CC+gstack ~5 hours
**Impact:** Smaller surface area for bugs, faster queries (indexes fix N+1), simpler mental model for developers and users.

---

## 4. NOT IN SCOPE (deferred)

| Item | Reason |
|------|--------|
| Full Alembic migration suite | db_sync.py handles schema drift manually; migration to Alembic is a separate project |
| Real-time WebSocket updates for Kanban | Current polling model works; WebSockets add infrastructure complexity |
| Role-based access control (RBAC) granular permissions | Current role check is coarse but functional; fine-grained permissions need product design first |
| Multi-currency support | No business requirement yet |
| Automated backup/restore | Infrastructure concern, not application code |

---

## 5. E2E TEST COVERAGE

4 persona-based test suites generated in `tests/e2e/personas/`:

| File | Persona | Tests | Coverage |
|------|---------|-------|----------|
| `cashier_workflow.spec.ts` | Retail Cashier | 8 tests | Walk-in sale, customer-attached sale, split tender (2 methods), layaway deposit, layaway completion, 3 error states |
| `tech_workflow.spec.ts` | Repair Tech | 7 tests | Ticket creation via IMEI scan, full kanban pipeline (3 columns), part consumption, Awaiting_Parts roundtrip, scrap device, QC triage, 2 error states |
| `warehouse_workflow.spec.ts` | Warehouse Manager | 8 tests | Manifest verification, 2 receiving error states, transfer dispatch, intake (quick + batch modes), intake error, rapid audit, central inventory search |
| `admin_workflow.spec.ts` | Store Owner/Admin | 9 tests | Dashboard KPI load, date range filter, CSV export, invoice filter chips, batch print, context menu, recurring template CRUD, estimate detail, org settings |

**Total: 32 persona-driven E2E tests**

---

## 6. FAILURE MODES — CRITICAL GAPS

| Failure Mode | Tested? | Error Handling? | User Sees? |
|-------------|---------|-----------------|------------|
| Database connection drops mid-checkout | No | No — raw 500 stack trace | Raw Python traceback in browser |
| Device state machine bypassed in void flow | No | No validation | Device silently stuck in wrong state |
| Invoice number race condition (two concurrent creates) | No | No — uses `id.desc().first()` | Duplicate invoice numbers possible |
| PaymentModal calls wrong endpoint (`/pay` vs `/payments`) | No | No — 404 silent | Payment silently fails |
| Layaway payment below 10% minimum | Partial | Backend rejects | 400 error, but no frontend validation hint |
| Part consumption with zero stock | No | No stock check in UI | Backend error, tech confused |

---

## 7. VERDICT

**ARCHITECTURAL INTEGRITY:** 4/10 — State machine exists but is routinely bypassed. Two parallel data models. Inconsistent org_id patterns.

**CODE QUALITY:** 3/10 — 22 endpoints without error handling. N+1 queries in 4 critical paths. 11 missing indexes. `alert()` used as error UI in 7+ places.

**USABILITY:** 4/10 — Core workflows function but lack safety nets. Dead ends and broken buttons exist in main navigation. Power users are slowed by duplicated pages.

**ENTERPRISE READINESS:** 3/10 — The system works for internal use by a technical operator who knows the workarounds. It would fail a third-party audit on: audit trail completeness, error handling consistency, and state integrity guarantees. The top 3 fixes above would bring it to 6/10.
