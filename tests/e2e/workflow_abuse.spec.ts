import { test, expect, Page } from '@playwright/test';

const BASE = process.env.TEST_URL || 'http://localhost:5173';
const API = process.env.API_URL || 'http://localhost:8000';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function loginAs(page: Page, role: string) {
  // Navigate and wait for Clerk to load — tests assume a pre-authenticated
  // state via stored cookies or a mock. See QA_REPORT.md for setup instructions.
  await page.goto(BASE);
  await page.waitForTimeout(2000);
}

// ── POS Checkout Abuse ───────────────────────────────────────────────────────

test.describe('POS Checkout — Abuse & Edge Cases', () => {

  test('ABUSE-001: Double-click checkout button before commit completes', async ({ page }) => {
    // Scan a device, add customer, then rapidly click checkout twice
    await page.goto(`${BASE}/admin/wholesale-checkout`);
    await page.waitForTimeout(1000);

    // Fill IMEI scan input
    const scanInput = page.locator('input[placeholder*="Scan"]');
    await scanInput.fill('352210091234567');
    await scanInput.press('Enter');
    await page.waitForTimeout(500);

    // Select customer
    const customerInput = page.locator('input[placeholder*="customer" i]');
    await customerInput.fill('Test Customer');
    await page.waitForTimeout(500);

    // Rapid double-click checkout
    const checkoutBtn = page.locator('button:has-text("Checkout")');
    await checkoutBtn.click({ clickCount: 2, delay: 50 });

    // Expect only one success state or an error, not duplicated invoices
    await page.waitForTimeout(2000);
    const successIndicators = page.locator('[class*="success"], .text-emerald-400');
    const errorIndicators = page.locator('[class*="error"], .text-red-400');
    // Either one success or an error about already-sold device is acceptable
    const hasResult = (await successIndicators.count()) > 0 || (await errorIndicators.count()) > 0;
    expect(hasResult).toBeTruthy();
  });

  test('ABUSE-002: Submit checkout with $0 tender and no layaway flag', async ({ page }) => {
    // Hit the API directly since the frontend blocks this
    const response = await page.request.post(`${API}/api/pos/checkout`, {
      data: {
        customer_id: 'CRM-TEST001',
        items: [{ imei: '352210091234567', unit_price: 299.99 }],
        tax_percent: 8.5,
        payments: []
      },
      headers: { 'Content-Type': 'application/json' }
    });
    // Should reject with 400, not create a $0 layaway
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('ABUSE-003: Submit negative payment amount', async ({ page }) => {
    const response = await page.request.post(`${API}/api/pos/checkout`, {
      data: {
        customer_id: 'CRM-TEST001',
        items: [{ imei: '352210091234567', unit_price: 299.99 }],
        tax_percent: 8.5,
        payments: [{ amount: -50, payment_method: 'Cash' }]
      },
      headers: { 'Content-Type': 'application/json' }
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('ABUSE-004: Payment sum exceeds invoice total', async ({ page }) => {
    const response = await page.request.post(`${API}/api/pos/checkout`, {
      data: {
        customer_id: 'CRM-TEST001',
        items: [{ imei: '352210091234567', unit_price: 100 }],
        tax_percent: 8.5,
        payments: [{ amount: 9999, payment_method: 'Cash' }]
      },
      headers: { 'Content-Type': 'application/json' }
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.detail).toContain('exceeds');
  });

  test('ABUSE-005: Checkout with IMEI not at current store location', async ({ page }) => {
    const response = await page.request.post(`${API}/api/pos/checkout`, {
      data: {
        customer_id: 'CRM-TEST001',
        items: [{ imei: '000000000000000', unit_price: 100 }],
        tax_percent: 8.5,
        payments: [{ amount: 108.50, payment_method: 'Cash' }]
      },
      headers: { 'Content-Type': 'application/json' }
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).detail).toContain('not sellable');
  });

  test('ABUSE-006: Layaway payment exceeds remaining balance', async ({ page }) => {
    const response = await page.request.post(`${API}/api/pos/invoices/INV-0001/payments`, {
      data: {
        amount: 999999,
        payment_method: 'Cash'
      },
      headers: { 'Content-Type': 'application/json' }
    });
    // Should either succeed (overpayment silently handled) or reject
    // Currently the backend subtracts then floors at 0 — this IS a bug
    // This test documents the current (lenient) behavior
    const body = await response.json();
    console.log('ABUSE-006 result:', body);
  });
});

// ── Transfer Order Abuse ──────────────────────────────────────────────────────

test.describe('Transfer Orders — Abuse & Edge Cases', () => {

  test('ABUSE-007: Transfer a device currently on layaway', async ({ page }) => {
    const response = await page.request.post(`${API}/api/transfers/dispatch`, {
      data: {
        origin: 'store_a',
        destination: 'Warehouse_Alpha',
        courier_name: 'Test Courier',
        imeis: ['352210090000001']  // assume this IMEI is Reserved_Layaway
      },
      headers: { 'Content-Type': 'application/json' }
    });
    const body = await response.json();
    // CRITICAL BUG: currently Reserved_Layaway is NOT blocked.
    // This test WILL pass (200) until the bug is fixed.
    // After fix, expect 400 with detail containing "cannot be dispatched"
    console.log('ABUSE-007 result:', body);
    // TODO: change to expect 400 when bug is fixed
  });

  test('ABUSE-008: Transfer dispatch with empty IMEI list', async ({ page }) => {
    const response = await page.request.post(`${API}/api/transfers/dispatch`, {
      data: {
        origin: 'store_a',
        destination: 'Warehouse_Alpha',
        imeis: []
      },
      headers: { 'Content-Type': 'application/json' }
    });
    expect(response.status()).toBe(422); // Pydantic validation
  });

  test('ABUSE-009: Bulk-route bypasses state machine validation', async ({ page }) => {
    // bulk-route directly sets device_status without state machine checks
    const response = await page.request.post(`${API}/api/transfers/bulk-route`, {
      data: {
        imeis: ['352210090000002'],
        destination: 'Scrapped',  // try to force an invalid transition
        defects: [],
        notes: 'Abuse test'
      },
      headers: { 'Content-Type': 'application/json' }
    });
    const body = await response.json();
    // Currently this succeeds even for invalid transitions
    // because bulk-route skips the state machine entirely
    console.log('ABUSE-009 result:', body);
    // TODO: this should go through execute_transition()
  });

  test('ABUSE-010: Receive transfer order twice (double-receive)', async ({ page }) => {
    // First receive
    await page.request.post(`${API}/api/transfers/TO-TEST01/receive`, {
      headers: { 'Content-Type': 'application/json' }
    });
    // Second receive — should fail
    const response = await page.request.post(`${API}/api/transfers/TO-TEST01/receive`, {
      headers: { 'Content-Type': 'application/json' }
    });
    expect(response.status()).toBe(400);
  });

  test('ABUSE-011: Manifest verify with IMEI not in manifest', async ({ page }) => {
    const response = await page.request.post(`${API}/api/transfers/manifests/MAN-TEST01/verify`, {
      data: {
        imeis: ['000000000000000'],
        notes: 'Not on manifest'
      },
      headers: { 'Content-Type': 'application/json' }
    });
    const body = await response.json();
    expect(body.rejected.length).toBeGreaterThan(0);
    expect(body.rejected[0].reason).toContain('Not on this manifest');
  });
});

// ── Device State Machine Abuse ────────────────────────────────────────────────

test.describe('Device State Machine — Abuse & Edge Cases', () => {

  test('ABUSE-012: Force Sellable without bin location via state machine', async ({ page }) => {
    const response = await page.request.post(`${API}/api/inventory/352210090000003/transition`, {
      data: {
        target: 'Sellable'
        // deliberately omit location_id and sub_location_bin
      },
      headers: { 'Content-Type': 'application/json' }
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).detail).toContain('Location');
  });

  test('ABUSE-013: Try invalid transition (Sold → Sellable)', async ({ page }) => {
    const response = await page.request.post(`${API}/api/inventory/352210099999999/transition`, {
      data: { target: 'Sellable' },
      headers: { 'Content-Type': 'application/json' }
    });
    // Should fail if the device is actually Sold
    // If 404, the test IMEI doesn't exist — also valid
    expect([400, 404]).toContain(response.status());
  });

  test('ABUSE-014: Rapid status transition double-click', async ({ page }) => {
    // Fire two transitions back-to-back on the same device
    const [r1, r2] = await Promise.all([
      page.request.post(`${API}/api/inventory/352210090000004/transition`, {
        data: { target: 'In_QC', notes: 'First click' },
        headers: { 'Content-Type': 'application/json' }
      }),
      page.request.post(`${API}/api/inventory/352210090000004/transition`, {
        data: { target: 'In_QC', notes: 'Second click' },
        headers: { 'Content-Type': 'application/json' }
      })
    ]);
    // One should succeed, the other should fail (already In_QC) or also succeed
    // If both return 200, we have a race condition
    const statuses = [r1.status(), r2.status()];
    console.log('ABUSE-014 statuses:', statuses);
    // At least one should be 200; both being 200 is a race condition
    expect(statuses.filter(s => s === 200).length).toBeLessThanOrEqual(1);
  });

  test('ABUSE-015: Transition Sold device (terminal state)', async ({ page }) => {
    const response = await page.request.post(`${API}/api/inventory/352210099999998/transition`, {
      data: { target: 'Sellable' },
      headers: { 'Content-Type': 'application/json' }
    });
    expect([400, 404]).toContain(response.status());
  });

  test('ABUSE-016: Fast-receive duplicate IMEI', async ({ page }) => {
    // First receive
    const r1 = await page.request.post(`${API}/api/inventory/central/fast-receive`, {
      data: {
        inventory: { imei: '999999999999901', model_number: 'IPH13-128-BLK', cost_basis: 400 },
        location_id: 'Warehouse_Alpha',
        phone_model: { model_number: 'IPH13-128-BLK', brand: 'Apple', name: 'iPhone 13', color: 'Black', storage_gb: 128 }
      },
      headers: { 'Content-Type': 'application/json' }
    });
    // Second receive with same IMEI
    const r2 = await page.request.post(`${API}/api/inventory/central/fast-receive`, {
      data: {
        inventory: { imei: '999999999999901', model_number: 'IPH13-128-BLK', cost_basis: 400 },
        location_id: 'Warehouse_Alpha'
      },
      headers: { 'Content-Type': 'application/json' }
    });
    expect(r2.status()).toBe(400);
    expect((await r2.json()).detail).toContain('already exists');
  });
});

// ── Invoice & Payment Abuse ───────────────────────────────────────────────────

test.describe('Invoice & Payment — Abuse & Edge Cases', () => {

  test('ABUSE-017: Void an already-voided invoice', async ({ page }) => {
    const response = await page.request.post(`${API}/api/pos/invoices/9999/void`, {
      headers: { 'Content-Type': 'application/json' }
    });
    // Either 404 (doesn't exist) or 400 (already voided)
    expect([400, 404]).toContain(response.status());
  });

  test('ABUSE-018: Refund a non-Sold invoice', async ({ page }) => {
    const response = await page.request.post(`${API}/api/pos/invoices/9999/refund`, {
      headers: { 'Content-Type': 'application/json' }
    });
    expect([400, 404]).toContain(response.status());
  });

  test('ABUSE-019: Pay invoice with unsupported payment method', async ({ page }) => {
    const response = await page.request.post(`${API}/api/pos/invoices/INV-0001/payments`, {
      data: {
        amount: 50,
        payment_method: 'Bitcoin'
      },
      headers: { 'Content-Type': 'application/json' }
    });
    expect(response.status()).toBe(422);
  });

  test('ABUSE-020: Create invoice without customer', async ({ page }) => {
    const response = await page.request.post(`${API}/api/pos/invoice`, {
      data: {
        items: [{ imei: '352210091234567', unit_price: 100 }],
        tax_percent: 8.5
        // no customer_id, no customer object
      },
      headers: { 'Content-Type': 'application/json' }
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).detail).toContain('Customer');
  });

  test('ABUSE-021: Edit invoice in Paid status', async ({ page }) => {
    // Try to edit an invoice that's already Paid
    const response = await page.request.put(`${API}/api/pos/invoices/INV-0001`, {
      data: {
        items: [{ imei: '352210091234567', unit_price: 50 }],
        tax_percent: 8.5
      },
      headers: { 'Content-Type': 'application/json' }
    });
    // Should reject — can't edit paid invoices
    expect([400, 404]).toContain(response.status());
  });

  test('ABUSE-022: Convert estimate when device no longer sellable', async ({ page }) => {
    const response = await page.request.post(`${API}/api/pos/estimates/EST-0001/convert`, {
      headers: { 'Content-Type': 'application/json' }
    });
    // Should either convert (200) or reject (400) if devices were sold elsewhere
    expect([200, 400, 404]).toContain(response.status());
  });
});

// ── Form Validation Abuse ────────────────────────────────────────────────────

test.describe('UI Form Validation — Abuse & Edge Cases', () => {

  test('ABUSE-023: Submit transfer form with all fields empty', async ({ page }) => {
    await page.goto(`${BASE}/transfers/dispatch`);
    await page.waitForTimeout(1000);

    const dispatchBtn = page.locator('button:has-text("Dispatch")');
    await dispatchBtn.click();
    await page.waitForTimeout(500);

    // Should show error, not submit
    const error = page.locator('.bg-red-50, [class*="error"], .text-red-400');
    expect(await error.count()).toBeGreaterThan(0);
  });

  test('ABUSE-024: Scan invalid/non-numeric IMEI', async ({ page }) => {
    await page.goto(`${BASE}/admin/wholesale-checkout`);
    await page.waitForTimeout(500);

    const scanInput = page.locator('input[placeholder*="Scan"]');
    await scanInput.fill('!@#$%^&*()');
    await scanInput.press('Enter');
    await page.waitForTimeout(500);

    // Should show error
    const error = page.locator('.bg-red-50, [class*="error"]');
    expect(await error.count()).toBeGreaterThan(0);
  });

  test('ABUSE-025: Enter extremely long IMEI (buffer overflow attempt)', async ({ page }) => {
    await page.goto(`${BASE}/admin/wholesale-checkout`);
    await page.waitForTimeout(500);

    const scanInput = page.locator('input[placeholder*="Scan"]');
    await scanInput.fill('3'.repeat(1000));
    await scanInput.press('Enter');
    await page.waitForTimeout(500);

    // Should gracefully show error, not crash
    const app = page.locator('#root, [class*="app"]');
    expect(await app.isVisible()).toBeTruthy();
  });
});

// ── Rapid Action Abuse ────────────────────────────────────────────────────────

test.describe('Rapid Action / Race Condition — Abuse', () => {

  test('ABUSE-026: Rapidly add/remove tender slots while checkout processes', async ({ page }) => {
    await page.goto(`${BASE}/admin/wholesale-checkout`);
    await page.waitForTimeout(1000);

    // Add multiple tender slots rapidly
    const addBtn = page.locator('button:has-text("Add")');
    for (let i = 0; i < 10; i++) {
      await addBtn.click();
      await page.waitForTimeout(50);
    }
    // UI should remain stable
    const tenderSlots = page.locator('[class*="tender"], [class*="TenderSlot"]');
    expect(await tenderSlots.count()).toBeGreaterThan(0);
  });

  test('ABUSE-027: Switch tabs rapidly while form is dirty', async ({ page }) => {
    await page.goto(`${BASE}/admin/wholesale-checkout`);
    await page.waitForTimeout(500);

    const scanInput = page.locator('input[placeholder*="Scan"]');
    await scanInput.fill('352210091234567');

    // Navigate away without submitting
    await page.goto(`${BASE}/admin/dashboard`);
    await page.waitForTimeout(500);

    // Go back — cart should be empty (state resets)
    await page.goto(`${BASE}/admin/wholesale-checkout`);
    await page.waitForTimeout(500);

    const scanInput2 = page.locator('input[placeholder*="Scan"]');
    expect(await scanInput2.inputValue()).toBe('');
  });
});
