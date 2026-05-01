# AMAFAH Electronics ERP — System Architecture & Workflow Blueprint

**Audience:** Senior Engineering & Product Leadership  
**Generated:** 2026-04-28  
**Methodology:** Full codebase sweep of backend models, routers, auth layer, business logic core, frontend routing, and UI components.  
**Repository State:** Unlogged changes present; all analysis reflects actual files on disk.

---

## 1. Authentication & Multi-Tenant Architecture

### 1.1 Identity Provider — Clerk

The application delegates all identity concerns to Clerk. The frontend wraps the entire React tree in `ClerkProvider` and the backend configures Clerk as its sole JWT issuer.

**Frontend Boot Sequence**

1. `ClerkProvider` initializes with the publishable key extracted from the Vite environment variable `VITE_CLERK_PUBLISHABLE_KEY`.
2. The `AuthProvider` context listens to Clerk's `useUser` and `useAuth` hooks. When a Clerk session is active, it extracts the JWT via `getToken()`, and reads the user's `role` and `store_id` from Clerk's `publicMetadata`. These values are stored in React context for downstream consumption.
3. An `AxiosInterceptor` automatically attaches the `Authorization: Bearer <jwt>` header to every outbound API request.

**Clerk Organization Enforcement**

The `Layout` component and the `ProtectedRoute` component each enforce a mandatory organization check. If `useOrganization()` returns no active organization, the user is presented with the `CreateOrganization` screen (in the Layout sidebar) or the `OrganizationList` component (in ProtectedRoute). No application functionality is accessible without an active Clerk Organization.

The `OrganizationSwitcher` component is rendered persistently in the left sidebar, allowing an authenticated user to change organizations without logging out. When the organization changes, the Clerk session's `org_id` claim updates, and the next API request carries the new organization context.

### 1.2 Backend JWT Verification & User Synchronization

**JWKS Resolution**

The backend constructs the Clerk JWKS endpoint URL by decoding the publishable key's base64-encoded segment to extract the Clerk frontend API domain, then appending `/.well-known/jwks.json`. The resulting keys are cached in-memory keyed by `kid`.

**Token Validation Pipeline (auth.py `get_current_user`)**

1. The `HTTPBearer` security scheme extracts the bearer token from the Authorization header.
2. Rejects tokens with literal values `undefined`, `null`, or `none` with a 401.
3. Reads the unverified JWT header to get the `kid` claim.
4. If the key is not in cache, fetches the JWKS endpoint synchronously.
5. Constructs an RSA public key from the JWK data and decodes the token with RS256 algorithm and expiration verification.
6. Extracts `sub` (clerk_id), `email`, `org_id`, and metadata (`role`, `store_id`) from the decoded payload.

**Database Synchronization Logic**

The backend looks up a local `User` record first by `clerk_id`, then falls back to `email` for legacy accounts.

- **New User Provisioning:** If no record exists, a new `User` row is inserted with the role and store_id from the token's metadata. The role defaults to `store_a` if the metadata value is not a recognized `RoleEnum` member.
- **Existing User Sync:** If a record exists, the system synchronizes `clerk_id` (for legacy users who previously only had email) and role/store_id from the token.
- **Anti-Demotion Safeguard:** If the database record has role `admin` but the token claims a lower role (and not `owner`), the database role is preserved. This prevents an accidental metadata misconfiguration from locking administrators out of the system.

### 1.3 Multi-Tenant Data Isolation — The `org_id` Column

Every major table carries an `org_id` column. Data is isolated by filtering all queries on `org_id = current_user.current_org_id`. The `current_org_id` is dynamically attached to the user object during JWT verification (extracted from the Clerk token's `org_id` claim) and is never persisted to the `users` table.

**Tables with org_id isolation:**
`store_locations`, `users`, `phone_models`, `unified_customers`, `transfer_orders`, `transfer_manifests`, `device_inventory`, `device_history_log`, `invoices`, `payment_transactions`, `parts_inventory`, `device_cost_ledger`, `inventory_audits`, `repair_tickets`, `labor_rate_config`, `part_intakes`

**Fallback Mechanism:** If the Clerk token lacks an `org_id` claim, the system reads the `DEFAULT_ORG_ID` environment variable. If that is also unset, authentication fails with a 401 and the message "Organization context missing from token."

### 1.4 Role-Based Access Control

Six roles are defined in `RoleEnum`:

| Role | Purpose | Typical Access |
|---|---|---|
| `admin` | Central warehouse / system administrator | All routes, dashboard, system settings, device intake, transfers, audit finalization |
| `owner` | Business owner | Dashboard visibility |
| `store_a` | Store A (Downtown) employee | POS, store inventory, CRM, manual intake, rapid audit |
| `store_b` | Store B (Uptown) employee | Same as store_a |
| `store_c` | Store C (Plaza) employee | Same as store_a |
| `technician` | Repair technician | Repair kanban, device tracking, repair completion |

Route protection uses a `require_role` dependency factory. The frontend `ProtectedRoute` component performs an equivalent client-side check using `allowedRoles` arrays. Store-level employees are further restricted by location — they only see inventory assigned to their `store_id`, and they only see invoices originating from their store.

The root redirector (`AuthWrapper`) routes users post-login based on role: admins go to the dashboard, technicians go to the repair dashboard, and everyone else lands on store inventory.

---

## 2. Device Lifecycle & Intake

### 2.1 The Device Status State Machine

Every device in `device_inventory` moves through a defined set of statuses. The status governs what operations are permitted.

| Status | Meaning | Allowed Next Actions |
|---|---|---|
| `Raw` (null status) | IMEI registered with no metadata | Data binding to hydrate specs |
| `Sellable` | Fully hydrated, available for sale | POS checkout, internal routing, transfer, repair assignment |
| `In_QC` | Undergoing quality control inspection | Internal routing back to Sellable, transfer |
| `In_Repair` | Assigned to a technician for repair | Repair completion (returns to Sellable) |
| `In_Transit` | En route between locations via manifest or transfer order | Bulk-receive acknowledgment |
| `Pending_Acknowledgment` | Arrived at destination, awaiting confirmation | Receive workflow |
| `Transit_to_Repair` | En route specifically to a repair facility | Bulk-receive activates In_Repair |
| `Transit_to_QC` | En route specifically to QC | Bulk-receive activates In_QC, logs QC labor cost |
| `Reserved_Layaway` | Reserved for a customer with partial payment | Payment completion (transitions to Sold) or invoice edit (returns to Sellable) |
| `Sold` | Permanent terminal state — device has left inventory | Only RMA/return can reverse (moves to In_QC) |

**Blocking rules enforced at the code level:**
- A device in `Sold` or `In_Transit` status cannot be transferred.
- A device not in `Sellable` status cannot be sold.
- A device in `Sold` or `In_Transit` cannot be internally routed.
- Only devices currently `In_Repair` can be marked as repair-complete.
- A device in `In_Transit` or `Sold` status cannot be dispatched on a manifest.

### 2.2 Intake Workflow — Three Modes

The `ManualIntake` component offers three distinct intake modes. All three ultimately call backend endpoints that create `device_inventory` rows stamped with the current user's `org_id` and `store_id`.

**Mode 1: Quick Intake (Blind IMEI Scan)**

- The user scans IMEIs one at a time into a text input. Pressing Enter adds each to an accumulating buffer displayed below.
- No model, cost, or condition metadata is captured during scanning.
- On submission, the frontend sends the list of IMEIs to `POST /api/inventory/bulk-intake`.
- The backend creates `device_inventory` rows with `device_status = None`, `is_hydrated = False`, `cost_basis = 0.0`, and logs a history entry with action type "Blind Scan" and status "Raw".
- Already-existing IMEIs are silently skipped (idempotent re-scan support).
- These raw devices appear in inventory with no model association and must be hydrated later.

**Mode 2: Batch Intake (Model + Scan)**

- The user first selects a batch header: a specific phone model from the catalog, a condition grade (A/B/C), and a unit acquisition cost.
- IMEIs are then scanned into an auto-focus input. Each scanned IMEI inherits the batch header's model, condition, and cost.
- On submission, the frontend sends the fully-populated device list to `POST /api/inventory/batch-manual`.
- The backend creates fully-hydrated `device_inventory` rows with `device_status = Sellable`, the specified `cost_basis`, and a corresponding `DeviceCostLedger` entry of type "Base_Acquisition".
- A history log marks each device as "Manual Intake" with status "Sellable".
- Duplicate IMEI detection happens pre-flight; if any IMEI already exists, the entire batch is rejected with a list of conflicting IMEIs.

**Mode 3: Standard Intake (Form Rows)**

- Uses a React Hook Form with a dynamic field array. Each row has fields for IMEI, model (selectable from catalog), and cost.
- The user manually fills each row or appends blank rows.
- On submission, the same `POST /api/inventory/batch-manual` endpoint processes the data identically to Batch Mode.

### 2.3 The Data Binding (Hydration) Pattern

Raw-scanned devices (those with `is_hydrated = False` and no model association) undergo a separate "data binding" step. This is the reconciliation step where auction sheets or supplier invoices are matched against blind-scanned IMEIs.

- The admin uploads or pastes a data sheet mapping IMEIs to model numbers, costs, and other specs.
- The frontend calls `POST /api/inventory/bind-specs` with a list of dictionaries, each containing at minimum an `imei` and `model_number`.
- The backend updates each matching raw device: sets `model_number`, `cost_basis`, `is_hydrated = True`, and transitions `device_status` to `Sellable`.
- A history log records "Data Binding" from status "Raw" to "Sellable".
- For existing devices that already have partial data, `POST /api/inventory/batch-reconcile` updates model numbers, cost basis, and condition without the raw-to-hydrated transition.

### 2.4 Fast Receive (Admin Central Intake)

A dedicated endpoint `POST /api/inventory/central/fast-receive` allows admins to intake a single device directly into `Warehouse_Alpha` with its model and cost fully specified. If the referenced phone model does not exist in the catalog, the admin can supply the model data inline and it will be created on the fly. The device arrives in the `Receiving_Bay` sub-location bin with status `Sellable`.

### 2.5 Internal Routing

The `POST /api/inventory/routing` endpoint moves a device between sub-location bins and statuses within the same physical location. For example, moving a device from `Main_Floor` to `QC_Station` with status change from `Sellable` to `In_QC`. This is an internal operation that does not create transfer orders — it is for moving devices around within a single store or warehouse.

### 2.6 Device Tracking & Audit Trail

Every status change, intake event, transfer, sale, repair assignment, and return generates a row in `device_history_log`. The log records:
- The IMEI
- The timestamp
- The action type (e.g., "Received", "Transferred_Out", "Blind Scan", "Invoice_Paid_Full", "RMA_Return")
- The employee email who performed the action
- The previous and new status values
- Optional free-text notes

The `GET /api/inventory/{imei}` endpoint returns the device with full model relationship data. The `GET /api/track/` endpoints provide a device's complete journey — all history logs and cost ledger entries in a single response.

---

## 3. Logistics & Transfer Orders

The system has two overlapping transfer mechanisms: the legacy **TransferOrder** system and the newer **TransferManifest** system. Both are active and serve different workflows.

### 3.1 Legacy Transfer Order Workflow

Used primarily for restocking and repair routing from the warehouse.

**Step 1 — Creation**
- An admin calls `POST /api/transfers/` with a list of IMEIs, a destination location ID, and a transfer type (either `Restock` or `Repair_Routing`).
- The backend creates a `TransferOrder` with a unique ID (format `TO-XXXXXXXX`), sets its status to `In_Transit`, and stamps it with the `org_id`.
- Every device in the list has its status changed to `In_Transit`, its `sub_location_bin` cleared, and its `assigned_transfer_order_id` set. A "Transferred_Out" history log is written for each device.
- Devices already in `Sold` or `In_Transit` status are rejected.

**Step 2 — Receipt**
- A user at the destination calls `POST /api/transfers/{transfer_order_id}/receive`.
- The backend retrieves all devices linked to that transfer order ID.
- For `Restock` transfers, device status becomes `Sellable` and location updates to the destination.
- For `Repair_Routing` transfers, device status becomes `In_Repair`.
- Each device gets a "Transfer_Received" history log. The `assigned_transfer_order_id` is cleared. The transfer order status changes to `Received`.

### 3.2 Manifest-Based Transfer Workflow

This is the more sophisticated system used for inter-store movements with courier tracking.

**Step 1 — Dispatch**
- A user at the origin scans IMEIs using the `TransferDispatch` component (or the `BulkTransfer` component for the QC/Repair routing variant).
- Each IMEI is validated by calling `GET /api/inventory/{imei}` to check its current status. Devices in `In_Transit` or `Sold` are rejected at scan time.
- The user specifies a destination, an optional courier name, and (in the `BulkTransfer` variant) defect tags and notes.
- On submission, `POST /api/transfers/dispatch` creates a `TransferManifest` with a unique `manifest_id` (format `MAN-XXXXXXXX`), origin, destination, courier, and status `In_Transit`.
- Every device transitions to `In_Transit` status. A `ManifestItem` record links each IMEI to the manifest. A history log marks "Transfer Dispatch".
- The frontend renders a `PrintableView` component and triggers the browser's print dialog, producing a physical manifest document with the manifest ID, origin, destination, courier, and full IMEI list.

**Step 2 — Bulk Receive (Acknowledgment)**
- A user at the destination calls `POST /api/transfers/bulk-receive` with the list of received IMEIs.
- The backend examines each device's current status and applies a status transition:
  - `Transit_to_Repair` → `In_Repair` (with repair ticket activation if a pending ticket exists)
  - `Transit_to_Main_Bin` → `Sellable`
  - `Transit_to_QC` → `In_QC` (with automatic QC labor cost applied from `LaborRateConfig` and added to the device's `cost_basis`)
- Devices not in a recognized transit state generate errors in the response. A history log records "Inventory Receipt" with the transition details.

### 3.3 Bulk Routing (Repair/QC Dispatch)

The `BulkTransfer` component is specifically designed for routing devices from the warehouse into QC testing or repair. It supports:
- Defect tagging (Battery, Screen, FaceID, Camera, Back Glass, Housing)
- Destination selection via dropdown: QC/TESTING, REPAIR LAB, or MAIN BIN/SALES FLOOR
- Free-text dispatch directives

This calls `POST /api/transfers/bulk-route`, which directly transitions device statuses without creating a manifest. Each device gets a "Bulk Transfer Dispatch" history log noting the defects and routing notes.

### 3.4 Transfer Visibility

- Admins see all transfer orders across the organization (filtered by `org_id`).
- Non-admin users see only transfer orders where the `destination_location_id` matches their role string (e.g., a `store_b` user sees transfers destined for `store_b`).

---

## 4. Point of Sale & Invoicing

The POS system operates across three distinct checkout surfaces: **Retail POS**, **Wholesale/B2B POS**, and the shared **CheckoutModal** (split-payment tender screen). All three converge on the same invoice and payment infrastructure.

### 4.1 Retail Checkout Workflow

The `POS` component is the retail checkout interface. It operates in a split-panel layout: controls and line items on the left, transaction summary on the right.

**Phase 1 — Entity Selection**

The user may optionally link the transaction to an existing CRM customer using the `CheckoutCRMWidget`. This widget:
- Fetches the CRM directory on mount.
- Provides live search by name, phone, or CRM ID with a dropdown of matches.
- When a customer is selected, their pricing tier discount and tax exemption status are immediately applied to the running totals.

If no CRM customer is selected, the user fills in a walk-in customer's name and phone, which will create a new CRM record on checkout.

**Phase 2 — Line Item Entry**

The user adds IMEIs and unit prices. Multiple line items are supported. Each IMEI is validated at checkout time:
- The device must exist in `device_inventory` with the current user's `org_id`.
- The device's `location_id` must match the user's role (e.g., a `store_b` user can only sell devices at `store_b`).
- The device must be in `Sellable` status.

**Phase 3 — Tender (CheckoutModal)**

When the user clicks "Process Checkout", the `CheckoutModal` appears. This modal presents:
- The total amount due.
- A running remaining balance (red if unpaid, green if fully tendered).
- A list of payment lines, each with a method selector (Cash, Credit Card, Wire, Store Credit, On Terms, Zelle), an amount input, and an optional reference/check number field.
- The user can add multiple payment lines for split tender.
- The first payment line defaults to Cash for the full amount.

**Validation rules in the modal:**
- Overpayment is blocked (total tendered cannot exceed amount due by more than $0.01).
- If the remaining balance exceeds $0.01, the submit button reads "Save as Layaway."
- If the balance is zero or within tolerance, the button reads "Complete Sale & Release Devices."

**Phase 4 — Backend Processing**

`POST /api/pos/checkout` handles the full transaction atomically:

1. If no `customer_id` was provided, a new `UnifiedCustomer` is created with a generated CRM ID (format `CRM-XXXXXXXX`) and type `Retail`.
2. Every IMEI is validated: must be `Sellable`, must be at the current user's location, must belong to the organization.
3. If the identified customer has a `pricing_tier > 0`, each line item's unit price is discounted by that percentage.
4. If the customer has a `tax_exempt_id`, the tax rate is forced to 0%.
5. The invoice total is computed: subtotal + tax.
6. Total payments are summed and validated (cannot exceed the invoice total).
7. An invoice is created with sequential numbering (`INV-0001`, `INV-0002`, etc.) scoped within the organization.
8. Device status transitions are applied:
   - If `total_payments >= total`: device status → `Sold`, invoice status → `Paid`, payment_status → `Paid_in_Full`.
   - If `total_payments < total`: device status → `Reserved_Layaway`, invoice status → `Partially_Paid`, payment_status → `Partial_Layaway`.
9. Each device receives a 15-day warranty expiry date.
10. An `InvoiceItem` row is created per line item with the final unit price.
11. A `PaymentTransaction` row is created for each tendered payment line, stamped with the `org_id`.

### 4.2 Layaway State Machine

When a retail checkout is partially paid, devices enter `Reserved_Layaway` status. These devices are locked from sale by other users (they are no longer `Sellable`).

Subsequent payments against the same invoice use `POST /api/pos/invoices/{invoice_id}/payments`:

- The payment transaction is recorded.
- Total paid across all payments is recalculated.
- If the cumulative total still falls short of the invoice total, the invoice and devices remain in layaway state.
- Once total paid meets or exceeds the invoice total, all devices on the invoice transition from `Reserved_Layaway` → `Sold`, the invoice status becomes `Paid`, and the payment status becomes `Paid_in_Full`.
- If the payment method is "On Terms", the customer's `current_balance` increases (charging to their account). For all other methods, the balance decreases (paying down the tab).

### 4.3 Wholesale / B2B Checkout

The `WholesalePOS` component provides a bulk scan-and-sell interface optimized for high-volume wholesale transactions.

**Workflow:**

1. The user selects a wholesale customer by searching the CRM. Customer selection auto-fills loyalty discount rates and tax exemption flags.
2. The user scans IMEIs via a persistent auto-focus input. Each scanned IMEI is validated in real time against the inventory API, checking for `Sellable` status. Devices are added to a cart with an auto-calculated wholesale price (cost basis × 1.5 markup).
3. Scanned items are displayed grouped by brand + model + price, showing quantity and aggregate value. IMEIs are listed under each group.
4. The user selects a fulfillment method: Walk-in or Shipped. If shipped, a destination address textarea appears.
5. The running summary displays subtotal, loyalty discount, sales tax (or exemption), and total due. Pricing follows the same discount and tax-exemption logic as retail.
6. On checkout, the frontend calls `POST /api/pos/wholesale`.

**Backend B2B processing (`process_bulk_checkout` in wms_core.py):**

1. Validates the customer exists and all IMEIs are found in inventory with `Sellable` status.
2. Computes pricing: base price = cost_basis × 1.2, then discounted by the customer's `pricing_tier` percentage.
3. Applies tax exemption if the customer has a `tax_exempt_id`; otherwise taxes at 8.5%.
4. If the payment method is "On Terms", enforces a credit limit check: `current_balance + unpaid_balance` must not exceed `credit_limit`.
5. If the payment method is "On Terms" and this is not an estimate, the customer's `current_balance` is incremented by the unpaid balance.
6. Creates an invoice with sequential numbering. An upfront payment greater than zero creates a corresponding `PaymentTransaction`.
7. All devices transition to `Sold` status. A history log records "Wholesale_Bulk_Sold" for each.
8. Returns structured invoice data that is rendered into a downloadable PDF via `reportlab`.

### 4.4 Estimates

Estimates are invoices with `is_estimate = 1`. They are created through the wholesale checkout path. When created as an estimate, device status is NOT changed to Sold — the devices remain Sellable and available for other transactions.

An estimate can be converted to a real invoice via `POST /api/pos/estimates/{invoice_id}/convert`:

1. Validates the estimate exists and belongs to the organization.
2. Checks every device is still `Sellable` (they may have been sold while the estimate was pending).
3. Transitions all devices to `Sold`.
4. If "On Terms" was used, enforces the credit limit check and increments the customer balance.
5. Changes the invoice number from `EST-XXXX` to `INV-XXXX`, sets `is_estimate = 0`, and marks status as `Unpaid`.
6. Generates and returns the PDF.

### 4.5 Returns & RMA

`POST /api/pos/returns` processes device returns:

1. For each IMEI, finds the most recent invoice item via a join on `invoices` filtered by `org_id`.
2. Checks the 15-day return window from the invoice creation date. If exceeded and no policy override is requested, the return is rejected.
3. On acceptance, the device transitions to `In_QC`, its location becomes `Warehouse_Alpha`, and its `sold_to_crm_id` is cleared.
4. If the original invoice was unpaid or partially paid and used "On Terms", the return value (including applicable tax and discount) is credited against the customer's `current_balance`.
5. A history log records "RMA_Return" for the device.

### 4.6 Invoice Management

**Invoice Editing (`PUT /api/pos/invoices/{invoice_id}`):**
- Only invoices in `Unpaid` or `Draft` status can be edited.
- Removed IMEIs are restored to `Sellable` status with their `sold_to_crm_id` cleared.
- Added IMEIs must be `Sellable` and are transitioned to `Sold`.
- Invoice totals, tax, items, and any "On Terms" credit ledger balances are recalculated accordingly.

**Invoice Listing (`GET /api/pos/invoices`):**
- Admins see all org invoices. Non-admins see only invoices from their assigned store.
- Supports search by invoice number, customer name, company name, IMEI, or serial number (serial is resolved to IMEI via a subquery).

**Client Statement (`GET /api/pos/crm/{crm_id}/statement`):**
- Generates a statement PDF for a specific customer with a date-filterable list of all invoices, amounts paid, balances, and total outstanding.

---

## 5. CRM & Reporting

### 5.1 Unified Customer Model

The `unified_customers` table handles both retail and wholesale customers in a single table, differentiated by the `customer_type` enum (`Retail` or `Wholesale`).

**Retail customers** use `first_name`, `last_name`, and a deprecated legacy `name` field. **Wholesale customers** use `company_name` and `contact_person`. The CRM router automatically populates the legacy `name` field from the appropriate source during creation and update.

**Customer financial profile fields:**
- `pricing_tier`: A decimal representing the discount percentage (e.g., 0.15 = 15% off all purchases).
- `tax_exempt_id`: If non-null, taxes are waived on all invoices for this customer.
- `tax_exempt_expiry`: An expiry date for tax-exempt status.
- `credit_limit`: Maximum allowed balance for "On Terms" purchases.
- `current_balance`: Running total owed to the business.
- `payment_terms_days`: Net terms in days.
- `is_active`: Soft delete via boolean (0 = deactivated). Deletion in the API sets this to 0 rather than removing the row.

**Related records:**
- `customer_contacts`: Named contacts with phone numbers and an `is_authorized_buyer` flag.
- `customer_documents`: Links to uploaded files (e.g., resale certificates, driver's licenses) with document type and expiry tracking.

### 5.2 CRM Operations

**Customer Search (`GET /api/crm/`):**
- Searches across name, company_name, first_name, last_name, and phone fields.
- Supports an `include_inactive` flag (defaults to false, hiding deactivated customers).
- Results are limited to 20 for dropdown performance.

**Customer History (`GET /api/crm/{crm_id}/history`):**
- Returns the customer profile, all devices ever purchased by that customer, all invoices linked to them, and a calculated `lifetime_total_spent` (sum of all invoice totals).

**Create & Update:**
- CRM ID is auto-generated as `CRM-XXXXXXXX` on creation.
- Updates accept the full customer payload and apply all changed fields via `setattr`.

### 5.3 Dashboard & Analytics

The dashboard (`GET /api/reports/dashboard`) is restricted to `admin` and `owner` roles. It accepts a `date_range` parameter with options: `Today`, `This Week`, `This Month`, `3 Months`, and `6 Months`.

**Metrics returned:**

1. **Total Sold:** Count of `InvoiceItem` rows joined to invoices created within the date range, filtered by `org_id`. This counts individual devices, not invoice count.

2. **Sales by Location:** Count of invoice items grouped by the invoice's `store_id`. Defaults for `store_a`, `store_b`, and `store_c` are initialized to zero so the UI always has consistent keys. The store_id values are preserved as-is in the response.

3. **Warehouse Outflow:** Count of transfer orders created within the date range. This measures how many transfer batches have been initiated from the warehouse.

4. **Top Selling Models:** The five most frequently sold model numbers, counted from invoice items joined to invoices within the date range, ordered by count descending.

### 5.4 Inventory Audit System

The audit system provides physical inventory verification with chain-of-custody tracking.

**Rapid Audit (`POST /api/inventory/rapid-audit`):**
- Scans a list of IMEIs against expected devices at a location (determined from the user's `store_id` or defaults to `Warehouse_Alpha`).
- Expected devices are those with status `Sellable` or `In_QC` at the location.
- Returns three categories: `matched` (scanned and expected), `missing` (expected but not scanned, with last-known employee and action), and `unexpected` (scanned but not expected).

**Reconciliation & Finalization:**
- `POST /api/inventory/audit/reconcile` generates a full audit report classifying all devices as matched, missing, or unexpected.
- `POST /api/inventory/audit/finalize` persists the audit: creates an `InventoryAudit` record with counts of expected, scanned, missing, and unexpected devices, plus individual `InventoryAuditItem` rows for each device with its variance status.

---

## 6. Repair Operations

### 6.1 Repair Lifecycle

1. **Ticket Creation:** A repair ticket is created for an IMEI with symptoms and notes. Initial status is `Pending_Triage`.
2. **Technician Assignment:** An admin assigns a device to a specific technician via `POST /api/inventory/repair/assign`. The device transitions to `In_Repair` and the `assigned_technician_id` is set.
3. **In-Progress Work:** The technician views their assigned devices on the repair kanban board. Repairs consume parts from `parts_inventory` via repair mappings that link device model numbers and repair categories to default part SKUs.
4. **Repair Completion:** The technician or admin calls `POST /api/inventory/repair/{imei}/complete`. The device transitions to `Sellable`, the technician assignment is cleared, and the device is routed to the `Main_Floor` bin.

### 6.2 Parts Inventory

Parts are tracked by SKU with:
- `current_stock_qty` — current on-hand count.
- `moving_average_cost` — dynamic cost basis.
- `low_stock_threshold` — triggers reorder alerts.
- Parts are received through `part_intakes` which link a supplier, quantity, and total price. Intakes can be marked as priced or unpriced.

### 6.3 Cost Accounting

`DeviceCostLedger` tracks all costs accumulated against a device:
- "Base_Acquisition" — initial purchase cost.
- "Part: {PartName}" — cost of parts used in repair.
- "QC Labor" — automatically applied when a device arrives at QC via bulk receive.
- "Labor" — technician labor charges.

The device's `cost_basis` field is incremented as costs are added, maintaining a running total cost for margin analysis.

---

## 7. Application Shell & Navigation

### 7.1 Layout Architecture

The `Layout` component provides a persistent left sidebar (264px wide) alongside a scrollable main content area. The sidebar contains:

- **Brand header** with "AMAFAH Enterprise WMS" identity.
- **Role-filtered navigation menu** — each menu item declares an array of allowed roles, and the `Layout` component filters the visible items based on the current user's role.
- **Organization area at the bottom** — `OrganizationSwitcher`, `UserButton`, and a display of the current user's email prefix and role.

The menu items and their audience:

| Navigation Item | Visible To |
|---|---|
| Dashboard | admin |
| Point of Sale | admin, store_a, store_b, store_c |
| Logistics | admin |
| Rapid Audit | admin, store_a, store_b, store_c |
| Manual Intake | admin, store_a, store_b, store_c |
| Repairs | admin, technician |
| CRM | admin, store_a, store_b, store_c |
| Finance | admin |
| Team Settings | admin |
| Settings | admin |

### 7.2 Protected Routing

The `ProtectedRoute` wrapper enforces a three-tier gate before rendering any child component:

1. **Loading Gate:** If Clerk or AuthContext are still initializing, a spinner with "Loading Security..." is displayed.
2. **Authentication Gate:** If the user is not signed into Clerk, `RedirectToSignIn` is rendered, directing them to the Clerk-hosted sign-in flow.
3. **Organization Gate:** If the user is signed in but has no active Clerk Organization, `OrganizationList` is displayed, forcing them to select or create an organization.
4. **Authorization Gate:** If `AuthContext` has no user object, redirect to `/login`. If the user's role is not in the `allowedRoles` array, redirect to `/`.

---

## 8. Cross-Cutting Concerns

### 8.1 Org-ID Propagation

Every endpoint that creates or queries data scoped to an organization follows the same pattern:
- The `current_user` object carries `.current_org_id` (dynamically attached during JWT verification).
- All SQLAlchemy queries include `.filter(Model.org_id == org_id)`.
- All new records have `.org_id = org_id` explicitly assigned before flush.

### 8.2 History Audit Trail

Every mutation to a device's state is recorded in `device_history_log`. The granularity is one log entry per device per operation. This produces a complete, immutable timeline that supports:
- Customer service inquiries ("where is this device?")
- Employee accountability ("who last touched this IMEI?")
- Audit reconciliation ("why was this expected device missing?")

### 8.3 Sequential Numbering

Invoice numbers and transfer order IDs are generated sequentially within each organization. The system queries the latest record, increments the numeric suffix, and padds to four digits. A fallback default of `INV-1000` or `TO-1000` is used if the query fails or no records exist.

### 8.4 Document Generation

PDF generation uses `reportlab` for:
- Wholesale commercial invoices (with company branding, line-item detail, and payment terms).
- Client account statements (with period filtering and running balance totals).

The retail checkout path opens the invoice PDF in a new browser tab, while the wholesale path triggers a file download.
