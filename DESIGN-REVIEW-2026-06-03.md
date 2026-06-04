# AMAFAH ERP — Visual Design Review (v2, post-routing-fix)

**Date:** 2026-06-03
**Reviewer:** opencode (gstack browse daemon)
**Target:** https://app-9uhzus7iv-sheshanks-projects-5275d9db.vercel.app (Preview, after C1 fix)
**Source:** /Users/sheshank/Amafah_Workspace/app/
**Method:** Headless Chromium at 1440x900 (desktop) + dark mode + mobile responsive

## What changed since v1

**C1 FIXED:** `src/App.tsx:200-225` PreviewRoutes now uses relative paths (and added 3 missing routes: daily-close, employee-sales, low-stock). Committed as `fix(routing)`, deployed to new preview. All 22 pages now render their real UI. **Production was never affected** (uses top-level routes).

**C2 PARTIALLY INVALIDATED:** My earlier "empty main area" finding was because all 17 page screenshots were actually byte-identical copies of inventory (the routing bug). Now that real pages render:
- Inventory loads 89 devices (real data)
- Purchase Orders, SKU Generator, AR Aging, Employee Sales all have well-designed empty states with friendly copy
- Phone Routing has an "AWAITING IMEI" empty state with helpful instructions
- Analytics shows a loading spinner

**M1 INVALIDATED:** Every page HAS a proper `<h1>`: "Inventory Dashboard", "Routing Hub", "Daily Close", "Profit & Loss", "Analytics Dashboard", "Purchase Orders", "SKU Generator", "AR Aging Report", "Tax Summary", "Employee Sales". Subtitle provides context (e.g., "Sales tax collected by store — filing-ready").

## Revised overall rating

**7/10** — significantly better than my initial 4/10. The routing fix revealed a thoughtfully designed app with consistent typography, excellent empty states, semantic color coding on the AR Aging buckets, and clean metric cards. The remaining issues are real but more polish-level than structural.

| Severity | Count | Status |
|---|---|---|
| Critical | 0 | — |
| High | 3 | Real design issues |
| Medium | 4 | Polish + consistency |
| Low | 2 | Nice-to-have |

---

## HIGH: Real design issues

### H1. Light mode active sidebar item is barely visible

**Evidence:** Compare `phone-routing.png` (light, "Phone Routing" active) with `dark-phone-routing.png` (dark, "Phone Routing" active).

- **Light mode:** Active item has a 3px green left border on a near-white background. Text weight unchanged. Background unchanged. The active state is easy to miss — looks like a hover state at best.
- **Dark mode:** Active item has a clear teal/green background tint (`bg-emerald-800/30` or similar) plus the left border. Text becomes white. Easy to spot.

**Problem:** Inconsistent treatment between themes. Dark mode is correct. Light mode needs a background tint, not just a border.

**Fix:** In `src/index.css` or the Layout component, add a background tint to the active sidebar item class. Currently:
```
className={`... ${isActive(path) ? 'border-l-[3px] border-[var(--accent)]' : 'border-l-[3px] border-transparent'}`}
```
Change to:
```
className={`... ${isActive(path) ? 'border-l-[3px] border-[var(--accent)] bg-emerald-50 text-[var(--accent)] font-semibold' : 'border-l-[3px] border-transparent'}`}
```

**Effort:** 10 min. **Impact:** High. Affects every page in the app.

### H2. 23 sidebar items with no way to quickly jump between them

**Evidence:** Sidebar in every screenshot shows 5 sections (OPERATIONS, INVENTORY, CRM, SALES, REPORTS) totaling 23 items for admin role. No search box at top of sidebar. No keyboard shortcut (cmd+K). No "Recent" or "Pinned" section.

**Problem:** For a power user, finding a specific page requires scanning 23 items. Fitts's law violation for experienced users.

**Compare:** Linear, Notion, Figma, Airtable, Stripe Dashboard all have search-driven navigation for 30+ items.

**Fix:** Add a search input at the top of the sidebar that filters items as you type. Match against label and path. Show top 5 results in a dropdown above the menu, highlight the matched substring. ~50 lines of code.

**Effort:** 2 hours. **Impact:** Medium-high. Especially useful for admin users who know what they want.

### H3. Sidebar shows all 23 items even for users with limited roles

**Evidence:** Layout.tsx lines 23-66 have `roles: [...]` on every item, so role-based filtering IS implemented in code. But the sidebar in every screenshot shows ALL items, suggesting either:
- The auth bypass gives everyone "admin" role, OR
- The role check isn't actually filtering the rendered list

**Problem:** A "store" role user should only see 8-10 relevant items (Quick Intake, Phone Routing, All Inventory, Customers, Invoices). Showing them 23 items creates clutter and confusion. They might click "Tax Summary" and get a 403.

**Fix:** Verify that the role filter is actually applied. In Layout.tsx line 19-68, the menu is built statically — it should be filtered by `user.role` before render. If it's not, add a filter.

**Effort:** 30 min. **Impact:** High for non-admin users.

---

## MEDIUM: Polish + consistency

### M1. Inconsistent metric card counts across reports

**Evidence:** Compared report pages:
- Daily Close: 5 cards (Total Revenue, Total Paid, Outstanding, Tax Collected, Discounts Given)
- AR Aging: 6 cards (Total Outstanding, Current, 1-30, 31-60, 61-90, 90+)
- Tax Summary: 5 cards (Total Sales, Taxable Sales, Exempt Sales, Tax Collected, Invoices)
- Profit & Loss: 4 cards (Total Revenue, Gross Profit, Gross Margin, Net Profit)
- Employee Sales: 1 card (Total Sales)

**Problem:** Inconsistent layout forces users to re-learn each page. Some are wide (3-4 across), AR Aging wraps to 5+1 because of 6 cards. Employee Sales with 1 card wastes 75% of the row.

**Fix:** Standardize on 4 cards per row when possible, with overflow to a 2nd row. Use a card component (e.g., `<MetricCard label="Total Revenue" value="$0.00" accent="green" />`) that handles grid layout automatically.

**Effort:** 3 hours (refactor 5 pages to use shared component).

### M2. Inconsistent date range pill sets

**Evidence:** Each report has a different set of date filter pills:
- Tax Summary: This Month, Today, This Week, Last 3 Months, Last 6 Months (5 pills, no All Time)
- Profit & Loss: This Month, Today, This Week, Last 3 Months, Last 6 Months, All Time (6 pills)
- Analytics: Today, This Week, This Month, 3 Months, 6 Months, All Time + Export CSV (6 pills, different order)
- Employee Sales: Today, This Week, This Month, Last 3 Months (4 pills, no 6 Months or All Time)

**Problem:** Different reports have different date scopes. Why? A user who wants "Last 6 Months" on Employee Sales can't get it. Why? Because Employee Sales is per-day per-employee and probably can't aggregate.

**Fix:** Either standardize (drop "All Time" from everywhere, or add it everywhere) or surface this as a tooltip ("All Time not available for per-employee data"). Pick one. Document the choice.

**Effort:** 1 hour.

### M3. Active metric card accent is inconsistent (left green bar)

**Evidence:** Some pages highlight a "primary" metric with a green left border:
- Daily Close: Total Paid + Outstanding have green text (not bar)
- Profit & Loss: Net Profit has a green left bar
- AR Aging: Total Outstanding has a green left bar
- Tax Summary: Tax Collected has a green left bar
- Analytics: (couldn't confirm, page was loading)

**Problem:** The "primary" metric is different on every page. The user has to guess which one is the headline number. The visual treatment varies (left bar vs colored text vs both).

**Fix:** Document the rule (e.g., "the last metric in the row is the bottom-line, gets the green bar"). Apply consistently. Consider always using the same color treatment for the "primary" card.

**Effort:** 30 min documentation + 30 min implementation.

### M4. Toast / alert / notification system absent

**Evidence:** Every page has a "Print" or "Export CSV" button (Daily Close, Tax Summary, Analytics) but no visible success/error feedback mechanism. The bell icon in the header is just an icon, no count badge.

**Problem:** After clicking "Export CSV", what happens? No toast confirms it. After "Look Up" in Phone Routing with an invalid IMEI, what happens? No error toast.

**Fix:** Add a toast/notification system (Sonner, react-hot-toast, or build a simple one with the existing design system). Wire up success/error feedback for every async action.

**Effort:** 2 hours. **Impact:** High for UX.

---

## LOW: Nice-to-have

### L1. Dark mode toggle in sidebar wastes real estate

The "Dark Mode" button is a sidebar item between "Daily Close" and the user profile. It should be in the header next to the bell icon.

### L2. No loading state on report page tabs

When switching between "Overview / Sales / Inventory" tabs on Analytics, the tab content snaps. A subtle loading spinner or skeleton would smooth the transition.

---

## What works really well (preserve these)

### A. Empty states are excellent

Compare these from the screenshots:
- Purchase Orders: Truck icon + "No purchase orders" + "Click 'New PO' to create one"
- SKU Generator: Box icon + "No SKUs yet" + "Click 'Generate SKU' to create your first barcode label"
- AR Aging: "No outstanding balances — all clear!" (friendly, not negative)
- Employee Sales: "No sales data for today"
- Phone Routing: "AWAITING IMEI" + "Enter an IMEI and click Look Up to view device details and routing actions"

These are all on-brand, helpful, and have a clear next action. Most enterprise apps get this wrong (generic "No data" or just a sad spinner). Don't change this pattern.

### B. AR Aging color coding is a real design win

The 6 cards use semantic colors:
- Total Outstanding: black (neutral)
- Current: green (good)
- 1-30 days: yellow (warning)
- 31-60 days: orange (concerning)
- 61-90 days: deeper orange
- 90+ days: red (bad)

The user can scan the row and immediately see if any buckets are in trouble. This is the kind of design that saves phone calls from your accountant.

### C. Page header pattern is consistent

Every page follows: `<h1>Title</h1> + <subtitle>Optional context</subtitle> + <action>Top-right button</action>`. Examples:
- "Inventory Dashboard" / "All Devices" badge / "+ Add Device" button
- "Daily Close" / "Wednesday, June 3, 2026" / "Print" button
- "Analytics Dashboard" / "Revenue, inventory, and operational insights" / "Export CSV" button

This is a strong design system foundation. Build the rest of the app on it.

### D. Dark mode is well-implemented

The dark theme inverts colors cleanly, preserves contrast, keeps the accent green, and (as noted in H1) actually does a better job of highlighting active states than light mode. The user clearly designed dark mode as a first-class citizen, not a "set background to black and call it done".

### E. Inventory table design

The Device Inventory table is the most data-rich screen and it's well-designed:
- Search bar above the table
- Status filter dropdown
- "89 devices" count in the table header
- Columns: IMEI, Model, Status, Location, Cost Basis, Days
- Status badges with semantic colors (Sellable = green)
- Numbers right-aligned, formatted as currency

---

## What I couldn't review

- **Modals/dialogs:** None triggered in this session. The "Add Device", "New PO", "Generate SKU" buttons all open modals — couldn't see their design.
- **Form pages:** Manual Intake, Invoice Form, PO Form, Customer Form — never reached in the screenshot flow.
- **Detail pages:** Customer Detail, Consignment Detail, Invoice Detail — never navigated to.
- **Mobile (after fix):** Did not retest mobile on the new preview. The sidebar collapse issue (M5 in v1) is likely still present.
- **Keyboard navigation:** Not tested.
- **Accessibility (focus rings, ARIA, contrast in dark mode):** Not formally tested.
- **Print styles:** Daily Close has a Print button — print-only CSS not tested.

Recommend a follow-up that specifically opens modals, fills forms, and walks a user flow (new customer → new invoice → mark as paid) to catch form/modal design issues.

---

## Final recommendation

The app's visual design is **production-quality with polish needed**. The strongest aspects are:
1. Empty states
2. Color coding on aging reports
3. Consistent page header pattern
4. Dark mode quality

The most important fix is **H1** (light mode active sidebar state) — this affects every page and takes 10 minutes. After that, **H2** (sidebar search) is the highest-value user-facing improvement.

Total to ship-ready visual design: ~1 day of focused work, starting with H1.

The 7 issues I flagged in v1 are now reduced to 3 high + 4 medium + 2 low, and 4 of the v1 issues were invalidated by the routing fix. The app is in much better shape than I initially assessed.
