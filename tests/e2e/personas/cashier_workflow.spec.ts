/**
 * cashier_workflow.spec.ts
 * Persona: Retail Cashier at AMAFAH Electronics
 *
 * Full checkout flow: scan IMEI, add customer, split payment, verify invoice.
 * Covers: walk-in sale, customer-attached sale, split tender, layaway deposit.
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Cashier: Full Checkout Flow', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(`${BASE}/admin/wholesale-checkout`);
        // Wait for checkout page to render
        await page.waitForSelector('[data-testid="scanner-input"]', { timeout: 10000 });
    });

    test('Walk-in sale: scan single IMEI, full cash payment, verify invoice', async ({ page }) => {
        // 1. Scan an IMEI
        const scanner = page.locator('[data-testid="scanner-input"]');
        await scanner.fill('352956789012345');
        await scanner.press('Enter');
        // Device should appear in cart
        await expect(page.locator('[data-testid="cart-item"]')).toHaveCount(1);

        // 2. Set Walk-in customer (default, no customer selection needed)
        // Verify "Walk-in Customer" text visible
        await expect(page.locator('text=Walk-in Customer')).toBeVisible();

        // 3. Enter full payment
        const tenderInput = page.locator('[data-testid="tender-amount-0"]');
        await tenderInput.fill('450.00'); // adjust based on scanned device price

        // 4. Complete sale
        await page.locator('[data-testid="complete-sale-btn"]').click();

        // 5. Verify success state
        await expect(page.locator('text=Sale Complete')).toBeVisible({ timeout: 10000 });
    });

    test('Customer-attached sale: search CRM, select customer, complete sale', async ({ page }) => {
        // 1. Scan an IMEI
        const scanner = page.locator('[data-testid="scanner-input"]');
        await scanner.fill('352956789012346');
        await scanner.press('Enter');
        await expect(page.locator('[data-testid="cart-item"]')).toHaveCount(1);

        // 2. Search for customer
        const customerSearch = page.locator('[data-testid="customer-search"]');
        await customerSearch.fill('Acme');
        // Wait for dropdown results
        await expect(page.locator('[data-testid="customer-result"]').first()).toBeVisible({ timeout: 5000 });
        await page.locator('[data-testid="customer-result"]').first().click();

        // 3. Verify customer attached
        await expect(page.locator('[data-testid="selected-customer-name"]')).toContainText('Acme');

        // 4. Fill payment and complete
        await page.locator('[data-testid="tender-amount-0"]').fill('500.00');
        await page.locator('[data-testid="complete-sale-btn"]').click();
        await expect(page.locator('text=Sale Complete')).toBeVisible({ timeout: 10000 });
    });

    test('Split tender: cash + card payment', async ({ page }) => {
        // 1. Scan IMEI
        const scanner = page.locator('[data-testid="scanner-input"]');
        await scanner.fill('352956789012347');
        await scanner.press('Enter');
        await expect(page.locator('[data-testid="cart-item"]')).toHaveCount(1);

        // 2. Set first tender (Cash)
        await page.locator('[data-testid="tender-amount-0"]').fill('200.00');
        await page.locator('[data-testid="tender-method-0"]').selectOption('Cash');

        // 3. Add second tender slot (Card)
        await page.locator('[data-testid="split-tender-btn"]').click();
        await expect(page.locator('[data-testid="tender-slot-1"]')).toBeVisible();
        await page.locator('[data-testid="tender-method-1"]').selectOption('Credit_Card');
        await page.locator('[data-testid="tender-amount-1"]').fill('250.00');

        // 4. Verify total tendered matches balance
        const remaining = await page.locator('[data-testid="balance-due"]').textContent();
        expect(remaining).toContain('0.00');

        // 5. Complete sale
        await page.locator('[data-testid="complete-sale-btn"]').click();
        await expect(page.locator('text=Sale Complete')).toBeVisible({ timeout: 10000 });
    });

    test('Layaway: minimum deposit, verify Reserved_Layaway status', async ({ page }) => {
        // 1. Scan IMEI
        const scanner = page.locator('[data-testid="scanner-input"]');
        await scanner.fill('352956789012348');
        await scanner.press('Enter');
        await expect(page.locator('[data-testid="cart-item"]')).toHaveCount(1);

        // 2. Enter partial payment (10% minimum enforced by backend)
        const tenderInput = page.locator('[data-testid="tender-amount-0"]');
        await tenderInput.fill('45.00'); // partial payment

        // 3. Button should now show "Start Layaway"
        const checkoutBtn = page.locator('[data-testid="complete-sale-btn"]');
        await expect(checkoutBtn).toContainText('Layaway');

        // 4. Start layaway
        await checkoutBtn.click();

        // 5. Verify layaway success
        await expect(page.locator('text=Layaway Reserved')).toBeVisible({ timeout: 10000 });

        // 6. Verify balance due shown
        await expect(page.locator('[data-testid="balance-due"]')).toBeVisible();
    });

    test('Layaway payment completion: search existing layaway, make payment', async ({ page }) => {
        // 1. Switch to Layaway Payment mode
        await page.locator('[data-testid="mode-layaway"]').click();

        // 2. Search for existing layaway invoice
        const invoiceSearch = page.locator('[data-testid="layaway-search"]');
        await invoiceSearch.fill('INV-00100');
        await page.locator('[data-testid="layaway-search-btn"]').click();

        // 3. Select the layaway invoice
        await expect(page.locator('[data-testid="layaway-result"]').first()).toBeVisible({ timeout: 5000 });
        await page.locator('[data-testid="layaway-result"]').first().click();

        // 4. Verify invoice details loaded
        await expect(page.locator('[data-testid="layaway-detail-total"]')).toBeVisible();

        // 5. Enter additional payment
        await page.locator('[data-testid="layaway-payment-amount"]').fill('100.00');
        await page.locator('[data-testid="layaway-payment-method"]').selectOption('Cash');

        // 6. Apply payment
        await page.locator('[data-testid="apply-payment-btn"]').click();

        // 7. Verify payment applied
        await expect(page.locator('[data-testid="payment-success"]')).toBeVisible({ timeout: 10000 });
    });

    test('Error state: scan non-sellable device', async ({ page }) => {
        // 1. Scan an IMEI that is already Sold or In_Repair
        const scanner = page.locator('[data-testid="scanner-input"]');
        await scanner.fill('000000000000000');
        await scanner.press('Enter');

        // 2. Verify error message appears (not an alert())
        await expect(page.locator('[data-testid="scan-error"]')).toBeVisible({ timeout: 5000 });
        // Device should NOT appear in cart
        await expect(page.locator('[data-testid="cart-item"]')).toHaveCount(0);
    });

    test('Error state: attempt checkout with no payment', async ({ page }) => {
        // 1. Scan IMEI
        const scanner = page.locator('[data-testid="scanner-input"]');
        await scanner.fill('352956789012349');
        await scanner.press('Enter');

        // 2. Verify checkout button is disabled (no payment entered)
        const checkoutBtn = page.locator('[data-testid="complete-sale-btn"]');
        await expect(checkoutBtn).toBeDisabled();
    });

    test('Error state: overpayment rejection', async ({ page }) => {
        // 1. Scan IMEI
        const scanner = page.locator('[data-testid="scanner-input"]');
        await scanner.fill('352956789012350');
        await scanner.press('Enter');

        // 2. Enter payment exceeding total
        await page.locator('[data-testid="tender-amount-0"]').fill('99999.00');
        await page.locator('[data-testid="complete-sale-btn"]').click();

        // 3. Verify error rejection from backend
        await expect(page.locator('[data-testid="checkout-error"]')).toBeVisible({ timeout: 10000 });
    });
});
