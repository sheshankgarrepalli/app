/**
 * tech_workflow.spec.ts
 * Persona: Repair Technician at AMAFAH Electronics
 *
 * Full repair lifecycle: triage device to Kanban, move through columns,
 * consume parts, complete repair with checklist, scrap device flow.
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Repair Tech: Full Repair Workflow', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(`${BASE}/repair/kanban`);
        await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 10000 });
    });

    test('Create new repair ticket via IMEI scan', async ({ page }) => {
        // 1. Click "New Ticket" button
        await page.locator('[data-testid="new-ticket-btn"]').click();

        // 2. Modal opens - scan IMEI
        await page.locator('[data-testid="ticket-imei-input"]').fill('352956789012345');
        await page.locator('[data-testid="ticket-imei-input"]').press('Enter');

        // 3. Select symptoms
        await page.locator('[data-testid="symptom-battery"]').click();
        await page.locator('[data-testid="symptom-screen"]').click();

        // 4. Create ticket
        await page.locator('[data-testid="create-ticket-btn"]').click();

        // 5. Verify card appears in Pending_Triage column
        await expect(page.locator('[data-testid="column-Pending_Triage"] [data-testid="kanban-card"]')
            .filter({ hasText: '352956789012345' })).toBeVisible({ timeout: 5000 });
    });

    test('Move ticket through full kanban pipeline: Triage → In Progress → Complete', async ({ page }) => {
        // 1. Find card in Pending_Triage
        const card = page.locator('[data-testid="column-Pending_Triage"] [data-testid="kanban-card"]').first();
        await expect(card).toBeVisible();

        // 2. Click "Start" to move to In_Repair
        await card.locator('[data-testid="action-start"]').click();
        // Card should now be in In_Repair column
        await expect(page.locator('[data-testid="column-In_Repair"] [data-testid="kanban-card"]').first())
            .toBeVisible({ timeout: 5000 });

        // 3. Click card to open workspace slideout
        const inProgressCard = page.locator('[data-testid="column-In_Repair"] [data-testid="kanban-card"]').first();
        await inProgressCard.click();
        await expect(page.locator('[data-testid="repair-workspace"]')).toBeVisible({ timeout: 3000 });

        // 4. Complete a work checklist item
        await page.locator('[data-testid="work-item-screen-replacement"]').click();
        await expect(page.locator('[data-testid="work-item-screen-replacement"]'))
            .toHaveClass(/completed/);

        // 5. Click "Done" to move to Completed
        await inProgressCard.locator('[data-testid="action-done"]').click();
        await expect(page.locator('[data-testid="column-Completed"] [data-testid="kanban-card"]').first())
            .toBeVisible({ timeout: 5000 });
    });

    test('Consume part during repair', async ({ page }) => {
        // 1. Open a ticket in In_Repair
        const card = page.locator('[data-testid="column-In_Repair"] [data-testid="kanban-card"]').first();
        await card.click();
        await expect(page.locator('[data-testid="repair-workspace"]')).toBeVisible();

        // 2. In workspace: select part from dropdown
        await page.locator('[data-testid="part-select"]').selectOption({ index: 0 });
        // 3. Enter quantity
        await page.locator('[data-testid="part-qty-input"]').fill('1');
        // 4. Click "Use" to consume part
        await page.locator('[data-testid="consume-part-btn"]').click();

        // 5. Verify part consumed (should appear in consumed list)
        await expect(page.locator('[data-testid="consumed-parts-list"] [data-testid="consumed-part"]'))
            .toHaveCount(1);
    });

    test('Move ticket to Awaiting_Parts and back', async ({ page }) => {
        // 1. Find card in In_Repair
        const card = page.locator('[data-testid="column-In_Repair"] [data-testid="kanban-card"]').first();

        // 2. Click "Need Parts"
        await card.locator('[data-testid="action-need-parts"]').click();

        // 3. Verify card moved to Awaiting_Parts
        await expect(page.locator('[data-testid="column-Awaiting_Parts"] [data-testid="kanban-card"]').first())
            .toBeVisible({ timeout: 5000 });

        // 4. Click "Parts Arrived" to move back
        const awaitingCard = page.locator('[data-testid="column-Awaiting_Parts"] [data-testid="kanban-card"]').first();
        await awaitingCard.locator('[data-testid="action-parts-arrived"]').click();

        // 5. Verify card back in In_Repair
        await expect(page.locator('[data-testid="column-In_Repair"] [data-testid="kanban-card"]').first())
            .toBeVisible({ timeout: 5000 });
    });

    test('Scrap device flow', async ({ page }) => {
        // 1. Open ticket in In_Repair
        const card = page.locator('[data-testid="column-In_Repair"] [data-testid="kanban-card"]').first();
        await card.click();
        await expect(page.locator('[data-testid="repair-workspace"]')).toBeVisible();

        // 2. Click "Scrap Device" in workspace
        await page.locator('[data-testid="scrap-device-btn"]').click();

        // 3. Confirm scrap dialog appears
        await expect(page.locator('[data-testid="scrap-confirm-dialog"]')).toBeVisible();

        // 4. Enter scrap reason
        await page.locator('[data-testid="scrap-reason-input"]').fill('Beyond economical repair - water damage');

        // 5. Confirm scrap
        await page.locator('[data-testid="confirm-scrap-btn"]').click();

        // 6. Verify card moved to Cancelled column
        await expect(page.locator('[data-testid="column-Cancelled"] [data-testid="kanban-card"]').first())
            .toBeVisible({ timeout: 5000 });
    });

    test('QC Triage: assess device and route to repair', async ({ page }) => {
        // 1. Navigate to QC Triage
        await page.goto(`${BASE}/qc/triage`);
        await page.waitForSelector('[data-testid="qc-scanner-input"]', { timeout: 10000 });

        // 2. Scan IMEI for assessment
        await page.locator('[data-testid="qc-scanner-input"]').fill('352956789012346');
        await page.locator('[data-testid="qc-scanner-input"]').press('Enter');

        // 3. Verify device details shown
        await expect(page.locator('[data-testid="device-detail-card"]')).toBeVisible({ timeout: 5000 });

        // 4. Select symptoms
        await page.locator('[data-testid="symptom-camera"]').click();
        await page.locator('[data-testid="symptom-faceid"]').click();

        // 5. Add triage notes
        await page.locator('[data-testid="triage-notes"]').fill('Front camera module needs replacement');

        // 6. Route to repair kanban
        await page.locator('[data-testid="route-to-repair-btn"]').click();

        // 7. Verify success
        await expect(page.locator('text=Routed to Repair')).toBeVisible({ timeout: 10000 });
    });

    test('Error state: scan non-existent IMEI in kanban ticket creation', async ({ page }) => {
        // 1. Open new ticket modal
        await page.locator('[data-testid="new-ticket-btn"]').click();

        // 2. Enter non-existent IMEI
        await page.locator('[data-testid="ticket-imei-input"]').fill('999999999999999');
        await page.locator('[data-testid="ticket-imei-input"]').press('Enter');

        // 3. Verify error displayed (not alert())
        await expect(page.locator('[data-testid="ticket-error"]')).toBeVisible({ timeout: 5000 });
    });

    test('Error state: attempt invalid status transition', async ({ page }) => {
        // 1. Find a completed ticket - should have NO action buttons
        const completedCard = page.locator('[data-testid="column-Completed"] [data-testid="kanban-card"]').first();
        // 2. Verify no action buttons exist on completed card
        await expect(completedCard.locator('[data-testid^="action-"]')).toHaveCount(0);
    });
});
