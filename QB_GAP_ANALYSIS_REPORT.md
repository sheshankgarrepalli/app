# QuickBooks Gap Analysis Report — AMAFAH ERP

**Date:** 2026-04-30
**Scope:** Full-stack comparison of AMAFAH ERP against QuickBooks Online (CRM, Invoicing, Inventory, Payments)
**Methodology:** Feature-level teardown mapped against live codebase (models, routers, frontend pages, state machine)

---

## Executive Summary

AMAFAH ERP is a purpose-built wholesale electronics inventory and POS system. It handles device lifecycle management (intake → QC → repair → sellable → sold), split-payment POS checkout, layaway, transfer orders between locations, manifest-based receiving, and basic CRM — things QuickBooks cannot do out of the box. Seven critical security vulnerabilities were identified and patched in the current audit cycle (see QA_REPORT.md).

However, as a business management platform, AMAFAH scores roughly **29/100** against QuickBooks Online's feature matrix. The system is a sharp inventory scalpel but a blunt financial instrument. It lacks recurring billing, batch operations, AR aging, lead management, statement generation with proper aging buckets, invoice delivery tracking, and any form of customer self-service.

**The core tension:** AMAFAH's device-centric architecture (IMEI as the operational atom) solves inventory problems QuickBooks cannot touch, but QuickBooks' financial workflow automation makes AMAFAH look like a prototype. Closing this gap requires building the financial automation layer without losing the inventory precision that makes AMAFAH distinct.

**Bottom line:** A wholesale electronics business can run daily operations on AMAFAH today. It cannot run its back office. AR tracking is manual, invoicing is one-at-a-time, and customer management is a flat directory with no pipeline, no segmentation, and no automation.

---

## Current State: What AMAFAH Has

### Backend (FastAPI + SQLAlchemy + SQLite)

| Capability | Status | Location |
|------------|--------|----------|
| Device inventory with full status state machine | Production | `models.py`, `state_machine.py` |
| 12 device statuses with validated transitions | Production (post-CVE-002) | `state_machine.py` |
| Retail POS checkout with split payments | Production | `pos_router.py:17` |
| Row-level pessimistic locking on checkout | Production (post-CVE-003) | `pos_router.py:48` |
| Layaway with 10% minimum deposit | Production (post-CVE-007) | `pos_router.py:73-77` |
| Wholesale bulk checkout with PDF generation | Production | `pos_router.py:236` |
| Invoice CRUD with payment processing | Production | `pos_router.py:143,354` |
| Invoice editing (add/remove items, recalculate) | Production | `pos_router.py:436` |
| Invoice voiding, correction, and refund | Production | `pos_router.py:766,804,843` |
| Estimates with one-click conversion | Production | `pos_router.py:273` |
| Client statement PDF (basic, no aging) | Production | `pos_router.py:626` |
| Transfer orders with manifest-based receiving | Production | `transfers_router.py` |
| Bulk route devices via state machine | Production (post-CVE-002) | `transfers_router.py:11` |
| Manifest verification with status-aware routing | Production (post-CVE-004) | `wms_core.py` |
| CRM: customer CRUD, search, deactivation | Production | `crm_router.py` |
| Customer history (devices purchased, lifetime spent) | Production | `crm_router.py:53` |
| Pricing tiers (wholesale discount %) | Production | `models.py:94` |
| Tax exemption support | Production | `models.py:92-93` |
| Credit limits and AR balance tracking | Production | `models.py:95-96` |
| Payment terms (net-N days) | Production | `models.py:97` |
| Organization-level settings (tax rate, currency, terms) | Production | `models.py:51-57` |
| QC labor fee auto-posting on transit receive | Production | `transfers_router.py:148-155` |
| Repair ticket auto-creation on repair transit receive | Production | `transfers_router.py:126-141` |
| Parts inventory with moving average cost | Production | `models.py:294-303` |
| Employee error dashboard (voids/corrections/refunds) | Production | `pos_router.py:882` |
| Device history audit log | Production | `models.py:180-190` |
| Device cost ledger | Production | `models.py:304-311` |
| Inventory audits (cycle counts) | Production | `models.py:262-283` |
| Role-based auth (Clerk JWT + store-level scoping) | Production | `auth.py` |
| Location ownership enforcement on dispatch | Production (post-CVE-005) | `transfers_router.py:73-76` |
| Overpayment rejection | Production (post-CVE-006) | `pos_router.py:385-387,430-431` |

### Frontend (React + TypeScript + Tailwind)

| Page/Component | Status |
|----------------|--------|
| POS checkout (barcode scanning, cart, split tender) | Production |
| Wholesale POS (bulk checkout, CRM lookup) | Production |
| CRM Directory (search, CRUD, detail modal) | Production |
| Invoice Management (list, search, status tracking) | Production |
| Invoicing System (creation workflow) | Production |
| Transfer Dispatch (IMEI scanning, destination selection) | Production |
| Bulk Transfer | Production |
| Central Inventory (device lookup, status management) | Production |
| Inventory Hub | Production |
| Manual Intake | Production |
| Receive Inventory / Receive Shipment | Production |
| QC Triage | Production |
| Repair Dashboard / Tech Kanban | Production |
| Rapid Audit | Production |
| Track Device | Production |
| Finance Hub | Production |
| Admin Dashboard / System Admin | Production |
| Auction Importer | Production |
| Returns (RMA) | Production |
| Part Detail | Production |
| Settings / Team Management / User Management | Production |

---

## Feature Gap Matrix

### CRM & Customer Management

| QuickBooks Feature | AMAFAH Status | Gap Severity | Effort Estimate |
|-------------------|---------------|--------------|-----------------|
| Customer directory with search | Has it | None | — |
| Customer detail with transaction history | Has it | None | — |
| Customer type (Retail/Wholesale) | Has it | None | — |
| Multiple contacts per customer | Has partial (`CustomerContact` model, no UI) | Low | ~2 hours |
| Customer documents (resale cert, license) | Has partial (`CustomerDocument` model, no UI) | Low | ~2 hours |
| Custom fields on customer | Missing | Medium | ~3 hours |
| Lead/prospect pipeline | **Missing entirely** | Critical | ~3 days |
| Lead → customer conversion | **Missing entirely** | Critical | ~2 days |
| Customer notes with timestamps | Has `notes` field (one blob, no history) | Low | ~1 hour |
| Customer status (active/inactive) | Has `is_active` flag | None | — |
| Preferred payment method | Missing | Low | ~30 min |
| Preferred delivery method | Missing | Low | ~30 min |
| Customer title (Mr/Ms/Dr) | Missing | Low | ~30 min |
| Customer website | Missing | Low | ~30 min |
| Display name (separate from legal name) | Missing | Low | ~30 min |
| Parent/sub-customer hierarchy | Missing | Medium | ~4 hours |
| Lead source tracking | Missing | Medium | ~1 hour |
| Customer merge/dedupe | Missing | Medium | ~4 hours |
| Bulk customer import/export | Missing | Medium | ~3 hours |

### Invoicing & Estimates

| QuickBooks Feature | AMAFAH Status | Gap Severity | Effort Estimate |
|-------------------|---------------|--------------|-----------------|
| Create invoice from devices | Has it | None | — |
| Split payments (multiple tender types) | Has it | None | — |
| Estimate → invoice conversion | Has it | None | — |
| Invoice PDF generation | Has it (wholesale + retail) | None | — |
| Tax calculation with exemption support | Has it | None | — |
| Invoice status tracking (Unpaid → Paid → Voided) | Has it | None | — |
| Invoice editing post-creation | Has it (with device restore) | None | — |
| Invoice voiding with device restoration | Has it | None | — |
| Invoice corrections (model number fix) | Has it | None | — |
| Refund processing with device restoration | Has it | None | — |
| Payment processing against invoices | Has it | None | — |
| Layaway partial payment tracking | Has it | None | — |
| Due dates on invoices | Has field (`due_date`), not enforced | Low | ~1 hour |
| Recurring invoices / templates | **Missing entirely** | Critical | ~5 days |
| Batch invoice creation (multiple customers at once) | **Missing entirely** | Critical | ~3 days |
| Progress invoicing (% of estimate) | **Missing entirely** | High | ~2 days |
| Invoice delivery tracking (viewed/not viewed) | **Missing entirely** | Medium | ~2 days |
| Invoice email sending | **Missing entirely** | High | ~2 days |
| Automated payment reminders | **Missing entirely** | High | ~3 days |
| Payment links in invoices | **Missing entirely** | Medium | ~2 days |
| Late fees / finance charges | Missing | Medium | ~1 day |
| Discount line items (%-off, $ amount) | Missing | Medium | ~3 hours |
| Line item descriptions | Missing | Low | ~1 hour |
| Invoice memos / internal notes | Missing | Low | ~1 hour |
| Attachments on invoices | Missing | Low | ~2 hours |
| Multi-currency support | Has `currency` in org settings, not used | Low | ~4 hours |
| Sales tax by location (not flat rate) | Missing | Medium | ~1 day |
| Invoice customization (logo, colors, template) | Missing | Low | ~1 day |

### Payment Processing & AR

| QuickBooks Feature | AMAFAH Status | Gap Severity | Effort Estimate |
|-------------------|---------------|--------------|-----------------|
| Record payments against invoices | Has it | None | — |
| Multiple payment methods (Cash, Card, Wire, Zelle, Store Credit, On Terms) | Has it | None | — |
| Customer AR balance tracking | Has it | None | — |
| Credit limit enforcement | Has it (on estimate conversion) | None | — |
| Payment receipt generation | Missing | Low | ~2 hours |
| Overpayment handling (credit balance) | Has it (rejects overpayments post-CVE-006) | None | — |
| AR aging report (30/60/90 day buckets) | **Missing entirely** | Critical | ~2 days |
| Collections dashboard | **Missing entirely** | High | ~2 days |
| Payment allocation (which invoice gets paid) | Missing (pays single invoice only) | Medium | ~1 day |
| Bulk payment application | Missing | Medium | ~1 day |
| Customer payment portal (self-service) | **Missing entirely** | Critical | ~10 days |
| Bank reconciliation | **Missing entirely** | Out of scope | — |
| Payment gateway integration (Stripe/Square) | Missing | High | ~5 days |
| Partial payments with remaining balance tracking | Has it (layaway) | None | — |
| Deposit/retainer tracking | Missing | Medium | ~1 day |

### Statements & Reporting

| QuickBooks Feature | AMAFAH Status | Gap Severity | Effort Estimate |
|-------------------|---------------|--------------|-----------------|
| Client statement (list of invoices) | Has it (basic PDF, no aging) | Partial | ~4 hours |
| Aging buckets on statements | **Missing** | High | ~3 hours |
| Statement period selection | Has it (start/end date params) | None | — |
| Statement email delivery | Missing | Medium | ~2 hours |
| AR aging summary report | **Missing entirely** | Critical | ~2 days |
| Sales by customer report | Missing | Medium | ~1 day |
| Sales by item/model report | Missing | Medium | ~1 day |
| Profit & Loss report | Missing | High | ~2 days |
| Balance sheet | Missing | Out of scope | — |
| Cash flow statement | Missing | Out of scope | — |
| Tax liability report | Missing | Medium | ~1 day |
| Custom report builder | Missing | Low priority | — |
| Employee error dashboard | Has it (voids/corrections/refunds by employee) | None | — |

### Inventory & Products

| QuickBooks Feature | AMAFAH Status | Gap Severity | Effort Estimate |
|-------------------|---------------|--------------|-----------------|
| Product/item catalog | Has partial (`DeviceCatalog` + `PhoneModel`) | Partial | ~1 day |
| Serial number / IMEI tracking | Has it (core architecture) | None | — |
| Inventory quantity by location | Has it (location_id on every device) | None | — |
| Inventory status workflow | Has it (state machine, 12 statuses) | None | — |
| Cost tracking per device | Has it (`cost_basis` + `DeviceCostLedger`) | None | — |
| Product images | Missing | Low | ~1 day |
| Product categories/families | Missing | Medium | ~3 hours |
| Bundles/kits | Missing | Low | ~1 day |
| Barcode generation/printing | Has it (scanning), no printing | Medium | ~2 days |
| Inventory valuation (FIFO/LIFO/avg) | Missing (has moving avg for parts only) | Medium | ~2 days |
| Reorder points / low stock alerts | Has it for parts (`low_stock_threshold`) | Partial | ~1 hour |
| Purchase orders to suppliers | Missing | High | ~5 days |
| Supplier/vendor management | Has `Supplier` model (name only, no UI) | High | ~3 days |
| Purchase order receiving against PO | Missing | High | ~3 days |
| Inventory adjustment reasons | Missing (audit captures variance, no reason codes) | Low | ~1 hour |

### Automation & Workflow

| QuickBooks Feature | AMAFAH Status | Gap Severity | Effort Estimate |
|-------------------|---------------|--------------|-----------------|
| Recurring transactions | **Missing entirely** | Critical | ~5 days |
| Auto-reminders (overdue invoices) | **Missing entirely** | High | ~3 days |
| Scheduled report delivery | Missing | Low | ~1 day |
| Workflow rules (if X then Y) | Missing | Medium | ~3 days |
| Email templates | Missing | Medium | ~1 day |
| Batch operations (bulk email, bulk print) | **Missing entirely** | High | ~2 days |

### Platform & UX

| QuickBooks Feature | AMAFAH Status | Gap Severity | Effort Estimate |
|-------------------|---------------|--------------|-----------------|
| Web app | Has it (React SPA) | None | — |
| Mobile app | Missing | Medium | Out of scope |
| Customer self-service portal | **Missing entirely** | Critical | ~10 days |
| Multi-user with role-based access | Has it (Clerk auth + role scoping) | None | — |
| Multi-location support | Has it (store_a/b/c + Warehouse_Alpha) | None | — |
| Dark mode | Has it | None | — |
| Keyboard shortcuts / scanner-first UX | Has it | None | — |
| Undo/redo support | **Missing** (noted as UX-002 in QA_REPORT.md) | Medium | ~2 days |
| Error message persistence | **Missing** (noted as UX-004) | Low | ~2 hours |
| Notification center (in-app) | Missing | Medium | ~2 days |
| Activity feed / audit trail UI | Missing (logs exist in DB, no UI) | Medium | ~1 day |
| Bulk edit / spreadsheet mode | Missing | Medium | ~2 days |

---

## UX & Usability Friction Catalog

These are issues identified during the static chaos audit (see QA_REPORT.md for full detail):

1. **UX-001: Scanner Always-On Conflicts With Form Inputs** (`POS.tsx:89-97`) — Barcode scanner focus keeper steals focus back from CRM search, payment fields, and reference inputs. Cashiers must click into fields and type fast before focus snaps back.

2. **UX-002: No Undo After Removing Device From Cart** (`POS.tsx`) — Cart removal is permanent. Accidental barcode scan removal loses the sale and requires re-scanning.

3. **UX-003: Layaway Payment Flow Is Disconnected From Cart** (`POS.tsx:274-299`) — Processing a layaway payment requires mental context switch from "sale" to "layaway payment." No "pay remaining balance" quick button exists.

4. **UX-004: Error Messages Are Transient** (`POS.tsx:109`) — Error banner disappears on next successful action. Sequential errors (3 bad scans) only show the last one. No error history queue.

5. **UX-005: No Loading State Distinction Between Scan Lookup and Processing** (`POS.tsx`) — Both IMEI lookup and checkout use the same `isProcessing` state. User cannot tell if the system is looking up an IMEI or processing payment. System appears frozen during checkout.

### Additional UX Gaps vs. QuickBooks

6. **No inline editing in tables** — QuickBooks allows clicking into any field in a list view. AMAFAH requires opening modals for everything.

7. **No keyboard navigation between form sections** — POS has sections (cart, customer, payments, layaway) but no keyboard flow between them.

8. **No bulk selection with checkboxes in list views** — CRM, invoices, and inventory lists have no multi-select for batch operations.

9. **No column sorting or resizing in data tables** — All list views are fixed-layout.

10. **No "save and new" pattern** — Creating multiple customers/invoices requires closing and reopening the modal each time.

---

## The "Path to 100%" — Prioritized Roadmap

### Tier 0: Quick Wins (8 fields, ~2 hours total)

Add these to `UnifiedCustomer` model immediately. They unlock filtering, segmentation, and professional invoicing without architectural risk:

| # | Field | Type | Why |
|---|-------|------|-----|
| 1 | `title` | String(10) | Mr/Ms/Dr/Mx on invoices |
| 2 | `website` | String(200) | Wholesale customer research |
| 3 | `preferred_payment_method` | Enum | Default tender on checkout |
| 4 | `preferred_delivery_method` | String(50) | Pickup vs. Ship default |
| 5 | `display_name` | String(200) | Separate from legal name |
| 6 | `parent_customer_id` | FK→self | Sub-customer hierarchy |
| 7 | `lead_source` | String(100) | Trade show, referral, website |
| 8 | `notes` → `notes_history` | JSON array | Timestamped note entries instead of one blob |

### Tier 1: Operational Critical (Days 1-14)

These features are blocking daily financial operations. A wholesale business cannot run AR without them.

#### 1. Recurring Invoices System (~5 days)

What QuickBooks does: A template invoice that auto-generates on a schedule (weekly, monthly, quarterly). The user sets it once and the system fires it.

Implementation:
- New model `RecurringInvoiceTemplate` with: customer_id, frequency (Weekly/Monthly/Quarterly), next_run_date, line_items (JSON), status (Active/Paused)
- New model `RecurringInvoiceLog` for execution history
- Cron-like scheduler endpoint (`/api/scheduler/run`) triggered via Vercel Cron Jobs
- On execution: create real Invoice from template, generate PDF, log execution
- Frontend: template list view, create/edit form with frequency picker, execution history table

Files to create/modify:
- `api/routers/scheduler_router.py` (new)
- `api/models.py` (add RecurringInvoiceTemplate, RecurringInvoiceLog)
- `api/schemas.py` (add Pydantic schemas)
- `src/pages/RecurringInvoices.tsx` (new)
- `vercel.json` (add cron job config)

#### 2. Batch Invoicing (~3 days)

What QuickBooks does: Select N customers, create invoices for all of them in one operation with common line items or individual amounts.

Implementation:
- POST `/api/invoicing/batch` accepting `[{customer_id, items[], due_date}]`
- Frontend: multi-select customer grid, line item form, preview before commit
- PDF batch generation with zip download option

#### 3. AR Aging Report (~2 days)

What QuickBooks does: A report showing all outstanding balances grouped into 1-30, 31-60, 61-90, and 90+ day buckets per customer. With a total row and clickable drill-down into invoices.

Implementation:
- GET `/api/reports/ar-aging` with optional `as_of` date
- SQL: Group unpaid invoices by customer, subtract payments, bucket by `created_at` age
- Frontend: `src/pages/ARAgingReport.tsx` — summary table with expand/collapse per customer, export to CSV
- Integrate into `FinanceHub.tsx` as a tab

Files:
- `api/routers/reports_router.py` (add endpoint)
- `src/pages/ARAgingReport.tsx` (new)
- `src/pages/FinanceHub.tsx` (modify)

#### 4. Statement Generator with Aging (~4 hours)

What QuickBooks does: A client statement that shows beginning balance, invoices in aging columns (Current/1-30/31-60/61-90/90+), payments received, and ending balance.

We have `get_client_statement` (pos_router.py:626) generating a flat list of invoices. It needs:
- Opening balance from previous period
- Aging column headers and invoice placement
- Total by aging bucket
- Better PDF layout (table with columns, not just lines)

### Tier 2: Growth Features (Days 15-30)

#### 5. Lead Pipeline (~5 days)

What QuickBooks does: A kanban-style pipeline for prospects. Leads enter with "New" status, move through "Contacted" → "Qualified" → "Proposal Sent" → "Won" (converts to customer) or "Lost."

Implementation:
- New model `Lead` with: name, company, phone, email, source, status (enum), assigned_to, estimated_value, expected_close_date, notes, converted_customer_id (nullable FK)
- POST `/api/crm/leads` and GET/PUT endpoints
- POST `/api/crm/leads/{id}/convert` — creates UnifiedCustomer and optionally an estimate
- Frontend: `src/pages/LeadPipeline.tsx` — kanban board with drag-and-drop using framer-motion (already installed)
- Add to sidebar navigation

#### 6. Invoice Delivery Tracking (~2 days)

What QuickBooks does: Tracks whether the customer has viewed the invoice, shows "Viewed" or "Unpaid (X days)" status.

Implementation:
- Add `viewed_at` and `emailed_at` to Invoice model
- Email sending via Resend/SendGrid API
- Track email open events via webhook
- Frontend: status column in InvoiceManagement showing sent/viewed/never sent

#### 7. Payment Reminders (~3 days)

What QuickBooks does: Automatically sends reminder emails for overdue invoices at configurable intervals.

Implementation:
- New model `ReminderRule`: invoice_age_days, email_template, is_active
- Cron job: each morning, find invoices where `due_date` is past and `status` is Unpaid/Partially_Paid, filter by reminder rules, send emails
- Frontend: reminder configuration page, manual "Send Reminder" button on invoice detail

#### 8. Supplier Management & Purchase Orders (~5 days)

What QuickBooks does: Supplier directory, purchase order creation, PO receiving against inventory.

AMAFAH has a `Supplier` model (name only) and `PartIntake` model. Needs:
- Supplier detail page with purchase history
- PO creation with line items
- PO receiving workflow (mark items received → auto-update PartsInventory)
- PO status tracking (Draft → Sent → Partially Received → Received → Closed)

### Tier 3: Differentiators (Days 30-60)

#### 9. Customer Self-Service Portal (~10 days)

What QuickBooks does: Customers log in to view their invoices, pay online, download statements, and see their purchase history.

This is AMAFAH's biggest differentiator opportunity. Build a device-centric portal where wholesale customers can:
- View their purchased device inventory with IMEI-level detail
- See warranty status per device
- Download invoices and statements
- Pay outstanding balances via payment gateway
- Submit RMAs
- View repair status on devices they've sent in

Implementation:
- New React app or route group at `/portal/*` with separate auth (magic link or customer-specific login)
- JWT issued for customer identity (not Clerk user)
- Customer-specific API endpoints at `/api/portal/*` with customer-token auth
- Stripe/Square integration for online payments

#### 10. Device-Centric Inventory Sharing (~5 days)

A feature QuickBooks cannot do: Share a live inventory feed with wholesale customers. "Here are the 47 iPhone 15 Pro units we have in Sellable condition across all locations. Prices by grade. Order with one click."

Implementation:
- Public (auth-gated) endpoint exposing sellable inventory summary
- Customer-specific pricing based on their `pricing_tier`
- "Add to cart" from shared inventory view → creates estimate

#### 11. Mobile Barcode Scanner App (~15 days)

What QuickBooks has: Mobile app with receipt capture, invoice creation, expense tracking.

AMAFAH differentiator: A mobile app that is a barcode scanner first. Scan IMEI → see full device history, status, cost basis, and customer (if sold). Scan to receive, scan to dispatch, scan to audit.

---

## Implementation Sequence (Recommended Order)

```
Week 1-2:  Tier 0 quick wins + AR Aging Report + Statement with Aging
Week 3-4:  Batch Invoicing + Invoice Delivery Tracking
Week 5-6:  Recurring Invoices System
Week 7-8:  Lead Pipeline + Payment Reminders
Week 9-10: Supplier Management + Purchase Orders
Week 11+:  Customer Portal (long pole)
```

---

## Architecture Notes

### What's Sound

- **State machine is the right abstraction.** Post-CVE-002, all device status transitions go through `state_machine.execute_transition()`, which validates, runs side-effects, and writes audit logs atomically. This is architecturally better than QuickBooks' implicit status changes.
- **Row-level locking on checkout** (CVE-003 fix) prevents duplicate sales. Production-grade.
- **IMEI as the operational atom** enables device-level cost tracking, warranty tracking, and repair history that QuickBooks cannot match.
- **Role-based access with store-level scoping** (CVE-005 fix) is properly enforced for non-admin users.

### What Needs Rethinking

- **No service layer.** Routers mix HTTP concerns with business logic. As features grow (recurring invoices, batch operations, reminders), extract a `services/` directory with: `invoice_service.py`, `customer_service.py`, `scheduler_service.py`, `notification_service.py`.
- **No background job queue.** Recurring invoices, email sending, and payment reminders need a queue (Vercel Queues or simple DB-backed job table with cron polling).
- **PDF generation is scattered.** Three different PDF functions across `pos_router.py` (statement), `pdf_worker.py` (wholesale invoice), and `wholesale_invoice_pdf.py`. Consolidate into a single `pdf/` package with shared layouts, fonts, and branding.
- **Frontend state is all React `useState` + axios.** No global cache, no optimistic updates, no offline queue. Adding React Query or SWR would reduce loading spinners and enable background refetch. Consider for Tier 2+.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Adding recurring invoices creates billing errors at scale | Medium | High | Require template preview + confirmation before activation. Add execution log with rollback capability. |
| Payment gateway integration exposes PCI scope | Medium | Critical | Use Stripe Checkout (hosted page) or Square Web Payments SDK. Never handle raw card numbers. |
| Customer portal exposes inventory data to competitors | Low | High | Portal auth must be per-customer with strict row-level filtering. Audit every portal endpoint for org_id/customer_id scoping. |
| Feature bloat dilutes core inventory precision | Medium | Medium | Keep device state machine as the source of truth. Financial features read from it, never bypass it. |

---

## Summary

AMAFAH ERP is a **specialized inventory management system** that happens to do invoicing. QuickBooks is a **general-purpose financial automation platform** that happens to track inventory. They occupy opposite ends of the same spectrum.

The gap is real but closable. The 8 quick-win fields take 2 hours. The AR aging report takes 2 days. Recurring invoices take 5 days. The full Tier 1-2 roadmap is ~30 days of focused development.

The strategic move is to build the financial automation layer without compromising the inventory precision. Every invoice feature should read from the device state machine, not bypass it. Every customer feature should enrich the CRM without adding a parallel customer record system. The result is a platform that does what QuickBooks does for money, plus what no general-purpose accounting system can do for wholesale electronics inventory.

**Current score: 29/100. Path to 70/100: Tiers 0-2 (~30 days). Path to 85+/100: Customer portal + mobile.**
