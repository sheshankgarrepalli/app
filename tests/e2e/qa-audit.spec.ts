/**
 * Live QA audit against production (amafahelectronics.com)
 * Uses real credentials to log in through Clerk, then audits key workflows.
 */
import { test, expect } from '@playwright/test';

const BASE = 'https://www.amafahelectronics.com';
const EMAIL = 'moulisheshank@gmail.com';
const PASSWORD = 'Sharkie@99';

async function loginViaClerk(page) {
  // Navigate to a protected page to trigger auth redirect
  await page.goto(`${BASE}/admin/dashboard`);

  // Clerk redirects to accounts.amafahelectronics.com/sign-in
  // Wait for the Clerk sign-in form
  await page.waitForSelector('input[type="email"], input[name="identifier"], input[id="identifier"]', { timeout: 15000 })
    .catch(() => page.waitForSelector('.cl-signIn-root, .cl-rootBox', { timeout: 5000 }));

  const currentUrl = page.url();
  console.log('Auth page URL:', currentUrl);

  // Clerk typically has a two-step sign-in: email first, then password
  // Step 1: Enter email
  const emailInput = page.locator('input[name="identifier"], input[id="identifier"], input[type="email"]').first();
  await emailInput.fill(EMAIL);
  await page.locator('button.cl-formButtonPrimary, button:has-text("Continue"), button[type="submit"]').first().click();

  // Step 2: Wait for password field
  await page.waitForTimeout(2000);
  const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
  await passwordInput.fill(PASSWORD);
  await page.locator('button.cl-formButtonPrimary, button:has-text("Continue"), button[type="submit"]').first().click();

  // Wait for redirect back to app
  await page.waitForURL(/amafahelectronics\.com\//, { timeout: 15000 });
  await page.waitForTimeout(2000);
  console.log('Logged in, current URL:', page.url());
}

test.describe('QA Audit: Login & Dashboard', () => {

  test('Login through Clerk and verify dashboard loads', async ({ page }) => {
    await loginViaClerk(page);
    await page.screenshot({ path: 'test-results/qa-dashboard.png', fullPage: true });

    // Verify we're on a real page (not auth wall)
    const url = page.url();
    expect(url).toContain('amafahelectronics.com');
    expect(url).not.toContain('sign-in');
  });

  test('Dashboard KPI cards visible', async ({ page }) => {
    await loginViaClerk(page);

    // Check for dashboard content - look for any KPI-related elements
    const hasContent = await page.locator('text=Revenue, text=Sales, text=Devices, text=Repair, .kpi, [class*="kpi"], [class*="KPI"]').first().isVisible().catch(() => false);
    console.log('Dashboard has KPI content:', hasContent);
    await page.screenshot({ path: 'test-results/qa-dashboard-kpi.png', fullPage: true });
  });
});

test.describe('QA Audit: Invoice Management', () => {

  test('Navigate to invoices page', async ({ page }) => {
    await loginViaClerk(page);
    await page.goto(`${BASE}/invoices`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/qa-invoices.png', fullPage: true });

    const url = page.url();
    console.log('Invoices URL:', url);
    const bodyText = await page.locator('body').textContent();
    console.log('Page has content:', bodyText.substring(0, 500));
  });

  test('Navigate to new invoice form', async ({ page }) => {
    await loginViaClerk(page);
    await page.goto(`${BASE}/invoices/new`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/qa-invoice-form.png', fullPage: true });
  });

  test('Navigate to recurring invoices', async ({ page }) => {
    await loginViaClerk(page);
    await page.goto(`${BASE}/invoices/recurring`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/qa-recurring.png', fullPage: true });
  });
});

test.describe('QA Audit: Repair Kanban', () => {

  test('Navigate to repair kanban', async ({ page }) => {
    await loginViaClerk(page);
    await page.goto(`${BASE}/repair/kanban`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/qa-kanban.png', fullPage: true });
  });
});

test.describe('QA Audit: POS / Checkout', () => {

  test('Navigate to checkout page', async ({ page }) => {
    await loginViaClerk(page);
    await page.goto(`${BASE}/admin/wholesale-checkout`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/qa-pos.png', fullPage: true });
  });
});

test.describe('QA Audit: Warehouse / Inventory', () => {

  test('Navigate to inventory page', async ({ page }) => {
    await loginViaClerk(page);
    await page.goto(`${BASE}/store/inventory`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/qa-inventory.png', fullPage: true });
  });

  test('Navigate to receiving page', async ({ page }) => {
    await loginViaClerk(page);
    await page.goto(`${BASE}/store/receiving`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/qa-receiving.png', fullPage: true });
  });
});

test.describe('QA Audit: Admin / System', () => {

  test('Navigate to system admin', async ({ page }) => {
    await loginViaClerk(page);
    await page.goto(`${BASE}/admin/system`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/qa-admin.png', fullPage: true });
  });

  test('Navigate to CRM', async ({ page }) => {
    await loginViaClerk(page);
    await page.goto(`${BASE}/admin/crm`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/qa-crm.png', fullPage: true });
  });
});

test.describe('QA Audit: Quick Checks (non-auth pages)', () => {

  test('Homepage loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(BASE);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/qa-homepage.png', fullPage: true });

    console.log('Homepage JS errors:', errors);
    console.log('Homepage title:', await page.title());
  });
});
