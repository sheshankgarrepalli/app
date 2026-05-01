/**
 * warehouse_workflow.spec.ts
 * Persona: Warehouse Manager at AMAFAH Electronics
 *
 * Full logistics flow: receive shipment via manifest verification,
 * transfer devices between locations, bulk intake, inventory audit.
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Warehouse: Receiving Flow', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(`${BASE}/store/receiving`);
        await page.waitForSelector('[data-testid="manifest-list"]', { timeout: 10000 });
    });

    test('View incoming manifests and verify shipment IMEIs', async ({ page }) => {
        // 1. Manifest list should be visible on load
        await expect(page.locator('[data-testid="manifest-card"]').first()).toBeVisible();

        // 2. Click a manifest to open detail
        await page.locator('[data-testid="manifest-card"]').first().click();
        await expect(page.locator('[data-testid="manifest-detail"]')).toBeVisible({ timeout: 5000 });

        // 3. Scanner auto-focuses. Scan IMEI from manifest
        const scanner = page.locator('[data-testid="manifest-scanner"]');
        await scanner.fill('352956789012345');
        await scanner.press('Enter');

        // 4. Verify IMEI marked as verified (green check)
        const verifiedItem = page.locator('[data-testid="verified-imei-352956789012345"]');
        await expect(verifiedItem).toBeVisible({ timeout: 3000 });
        await expect(verifiedItem).toHaveClass(/verified/);

        // 5. Verify progress bar updates
        await expect(page.locator('[data-testid="verification-progress"]')).toBeVisible();
    });

    test('Error state: scan IMEI not in manifest', async ({ page }) => {
        // 1. Select a manifest
        await page.locator('[data-testid="manifest-card"]').first().click();
        await expect(page.locator('[data-testid="manifest-detail"]')).toBeVisible({ timeout: 5000 });

        // 2. Scan unexpected IMEI
        const scanner = page.locator('[data-testid="manifest-scanner"]');
        await scanner.fill('000000000000000');
        await scanner.press('Enter');

        // 3. Verify error feedback (red highlight, not alert())
        await expect(page.locator('[data-testid="scan-error"]')).toBeVisible({ timeout: 3000 });
    });

    test('Error state: scan duplicate IMEI in manifest', async ({ page }) => {
        // 1. Select a manifest
        await page.locator('[data-testid="manifest-card"]').first().click();
        await expect(page.locator('[data-testid="manifest-detail"]')).toBeVisible({ timeout: 5000 });

        // 2. Scan same IMEI twice
        const scanner = page.locator('[data-testid="manifest-scanner"]');
        await scanner.fill('352956789012345');
        await scanner.press('Enter');
        // Wait for first scan to register
        await page.waitForTimeout(500);

        await scanner.fill('352956789012345');
        await scanner.press('Enter');

        // 3. Verify duplicate warning
        await expect(page.locator('[data-testid="duplicate-warning"]')).toBeVisible({ timeout: 3000 });
    });
});

test.describe('Warehouse: Transfer Dispatch Flow', () => {

    test('Scan IMEIs, select destination, dispatch transfer batch', async ({ page }) => {
        // 1. Go to transfer dispatch page
        await page.goto(`${BASE}/transfers/dispatch`);
        await page.waitForSelector('[data-testid="transfer-scanner"]', { timeout: 10000 });

        // 2. Scan IMEIs to build batch
        const scanner = page.locator('[data-testid="transfer-scanner"]');
        await scanner.fill('352956789012345');
        await scanner.press('Enter');
        await expect(page.locator('[data-testid="batch-item"]')).toHaveCount(1);

        await scanner.fill('352956789012346');
        await scanner.press('Enter');
        await expect(page.locator('[data-testid="batch-item"]')).toHaveCount(2);

        // 3. Set destination
        await page.locator('[data-testid="destination-select"]').selectOption('store_b');

        // 4. Set courier (optional)
        await page.locator('[data-testid="courier-input"]').fill('DHL Express');

        // 5. Dispatch & Print Manifest
        await page.locator('[data-testid="dispatch-btn"]').click();

        // 6. Verify transfer animation plays, manifest renders
        await expect(page.locator('[data-testid="transfer-animation"]')).toBeVisible({ timeout: 3000 });
        // Manifest printable view appears (hidden in normal view, visible in print)
        await expect(page.locator('[data-testid="printable-manifest"]')).toBeVisible({ timeout: 5000 });
    });

    test('Error state: scan device already In_Transit', async ({ page }) => {
        await page.goto(`${BASE}/transfers/dispatch`);
        await page.waitForSelector('[data-testid="transfer-scanner"]', { timeout: 10000 });

        // 1. Scan IMEI already in transit
        const scanner = page.locator('[data-testid="transfer-scanner"]');
        await scanner.fill('352956789012399'); // device that's In_Transit
        await scanner.press('Enter');

        // 2. Verify error message
        await expect(page.locator('[data-testid="scan-error"]')).toBeVisible({ timeout: 5000 });
    });
});

test.describe('Warehouse: Manual Intake Flow', () => {

    test('Quick Intake: scan IMEIs and register as raw devices', async ({ page }) => {
        // 1. Navigate to manual intake
        await page.goto(`${BASE}/admin/manual-intake`);
        await page.waitForSelector('[data-testid="intake-scanner"]', { timeout: 10000 });

        // 2. Default mode is Quick Intake - scan IMEIs
        const scanner = page.locator('[data-testid="intake-scanner"]');
        await scanner.fill('352956789012400');
        await scanner.press('Enter');
        await scanner.fill('352956789012401');
        await scanner.press('Enter');
        await scanner.fill('352956789012402');
        await scanner.press('Enter');

        // 3. Verify items appear in buffer
        await expect(page.locator('[data-testid="intake-buffer-item"]')).toHaveCount(3);

        // 4. Click Register
        await page.locator('[data-testid="register-btn"]').click();

        // 5. Verify success
        await expect(page.locator('text=Batch Saved')).toBeVisible({ timeout: 10000 });
    });

    test('Batch Model Intake: set header, scan IMEIs with inherited metadata', async ({ page }) => {
        await page.goto(`${BASE}/admin/manual-intake`);
        await page.waitForSelector('[data-testid="intake-scanner"]', { timeout: 10000 });

        // 1. Switch to Batch Model mode
        await page.locator('[data-testid="mode-batch"]').click();

        // 2. Set batch header
        await page.locator('[data-testid="batch-model-select"]').selectOption({ index: 1 });
        await page.locator('[data-testid="batch-condition-select"]').selectOption('B');
        await page.locator('[data-testid="batch-cost-input"]').fill('150.00');

        // 3. Scan IMEIs
        const scanner = page.locator('[data-testid="intake-scanner"]');
        await scanner.fill('352956789012403');
        await scanner.press('Enter');
        await scanner.fill('352956789012404');
        await scanner.press('Enter');

        // 4. Items should show as hydrated with model info
        await expect(page.locator('[data-testid="hydrated-item"]')).toHaveCount(2);

        // 5. Register
        await page.locator('[data-testid="register-btn"]').click();
        await expect(page.locator('text=Batch Saved')).toBeVisible({ timeout: 10000 });
    });

    test('Error state: scan duplicate IMEI in intake', async ({ page }) => {
        await page.goto(`${BASE}/admin/manual-intake`);
        await page.waitForSelector('[data-testid="intake-scanner"]', { timeout: 10000 });

        const scanner = page.locator('[data-testid="intake-scanner"]');
        // First scan
        await scanner.fill('352956789012400');
        await scanner.press('Enter');
        // Duplicate scan
        await scanner.fill('352956789012400');
        await scanner.press('Enter');

        // Verify duplicate error
        await expect(page.locator('[data-testid="duplicate-error"]')).toBeVisible({ timeout: 3000 });
    });
});

test.describe('Warehouse: Rapid Audit Flow', () => {

    test('Scan IMEIs and run variance audit', async ({ page }) => {
        // 1. Navigate to rapid audit
        await page.goto(`${BASE}/admin/rapid-audit`);
        await page.waitForSelector('[data-testid="audit-scanner"]', { timeout: 10000 });

        // 2. Scan IMEIs from physical shelf
        const scanner = page.locator('[data-testid="audit-scanner"]');
        await scanner.fill('352956789012345');
        await scanner.press('Enter');
        await scanner.fill('352956789012346');
        await scanner.press('Enter');

        // 3. Click "Run Audit"
        await page.locator('[data-testid="run-audit-btn"]').click();

        // 4. Verify results: matched, missing, unexpected sections
        await expect(page.locator('[data-testid="audit-results"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="matched-count"]')).toBeVisible();
    });

    test('Error state: no IMEIs scanned before audit', async ({ page }) => {
        await page.goto(`${BASE}/admin/rapid-audit`);
        await page.waitForSelector('[data-testid="audit-scanner"]', { timeout: 10000 });

        // 1. Click "Run Audit" with no scans
        const runBtn = page.locator('[data-testid="run-audit-btn"]');

        // 2. Verify button is disabled or shows error
        const isDisabled = await runBtn.isDisabled();
        if (!isDisabled) {
            await runBtn.click();
            await expect(page.locator('[data-testid="audit-error"]')).toBeVisible({ timeout: 5000 });
        }
    });
});

test.describe('Warehouse: Central Inventory View', () => {

    test('Filter and search inventory', async ({ page }) => {
        await page.goto(`${BASE}/store/inventory`);
        await page.waitForSelector('[data-testid="inventory-table"]', { timeout: 10000 });

        // 1. Verify table loads with data
        await expect(page.locator('[data-testid="inventory-row"]').first()).toBeVisible();

        // 2. Search by IMEI
        await page.locator('[data-testid="inventory-search"]').fill('352956789012345');
        await page.locator('[data-testid="search-btn"]').click();

        // 3. Verify filter applied (row count should be 1 or fewer)
        await expect(page.locator('[data-testid="inventory-row"]')).toHaveCount(1);

        // 4. Filter by status
        await page.locator('[data-testid="status-filter"]').selectOption('Sellable');
        // Table should update
        await expect(page.locator('[data-testid="inventory-table"]')).toBeVisible();
    });
});
