import { test, expect } from '@playwright/test';

test.describe('Workspace Admin & Researcher Backbone Tests', () => {
  test('Validates global admin platform controls: workspace branding, participant payouts, and dashboards', async ({ page }) => {
    // Add debugging log
    page.on('console', msg => {
      if (msg.type() === 'error') console.error(`PAGE LOG ERROR: ${msg.text()}`);
    });

    const timestamp = Date.now();
    const testEmail = `admin_e2e_${timestamp}@test.com`;
    const password = 'TestadminPassword123!';

    // Inject localStorage BEFORE navigation to organically bypass FirstSimulationWizard
    await page.addInitScript(() => {
      localStorage.setItem("has_seen_first_sim", "true");
    });

    // --- MOCKING STRATEGY ---
    // We mock expensive administrative edge-cases (disbursement updates, table lookups)
    // while executing native PostgreSQL operations for basic User/Auth bindings.

    await page.route('**/rest/v1/incentive_programs*', async route => {
      const url = route.request().url();
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
      if (route.request().method() === 'GET') {
        const item = {
          id: '1234',
          workspace_id: 'test-ws-id',
          name: 'Alpha Phase Insights',
          description: 'Testing payout approval pipeline completely.',
          status: 'active',
          incentive_type: 'cash',
          currency: 'USD',
          total_budget_cents: 10000, 
          spent_cents: 2000,
          default_amount_cents: 2000
        };
        // Supabase select single (.single()) expects object, array expects array payload mapped.
        // Usually PostgREST returns array `[item]`, BUT `.single()` requests send `Accept: application/vnd.pgrst.object+json`.
        if (route.request().headers()['accept']?.includes('vnd.pgrst.object')) {
           return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(item) });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([item]) });
      }
      return route.continue();
    });

    await page.route('**/rest/v1/incentive_disbursements*', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
      if (route.request().method() === 'GET') {
         return route.fulfill({ 
            status: 200, 
            contentType: 'application/json', 
            body: JSON.stringify([{
              id: 'disb-1',
              program_id: '1234',
              status: 'awaiting_approval',
              amount_cents: 2000,
              currency: 'USD',
              reason: 'compensation',
              created_at: new Date().toISOString(),
              participants: { full_name: 'E2E Worker', email: 'worker@test.com' }
            }])
         });
      }
      if (route.request().method() === 'PATCH') {
         // Successfully intercept the Administrator 'Approve' click
         return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{}]) });
      }
      return route.continue();
    });

    // 1. Sign up brand new Researcher (acting as Global Workspace Owner/Admin)
    await page.goto('/signup');
    await page.fill('#fullName', 'Master Admin User');
    await page.fill('#email', testEmail);
    await page.fill('#password', password);
    await page.fill('#workspace', `Global Corp ${timestamp}`);
    await page.click('button:has-text("Create Account")');
    
    // Wait for native auth redirection
    await page.waitForURL('**/dashboard');
    
    // Bypass wizard if it somehow mounts despite localStorage
    const skipOnboarding = page.locator('button:has-text("Let\'s Go"), button:has-text("Skip")');
    if (await skipOnboarding.count() > 0) {
      await skipOnboarding.first().click();
    }

    // 2. Test Platform Settings Architecture / Branding Management
    await page.goto('/settings');
    await page.getByRole('tab', { name: /Workspace/i }).click();
    
    // We allow normal GET requests but we mock PATCH requests so it registers a save cleanly.
    await page.route('**/rest/v1/workspaces*', async (route) => {
      if (route.request().method() === 'PATCH') {
         return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{}]) });
      }
      return route.continue();
    });

    // Target the primary color input logic (it's hardcoded as placeholder="#6366f1")
    const primaryInput = page.locator('input[placeholder="#6366f1"]');
    await primaryInput.fill('#ff0033', { force: true }); // New bold color!
    await page.getByRole('button', { name: "Save", exact: true }).click({ force: true });

    // 3. Test global Participant Routing Overview Dashboard
    await page.goto('/participants');
    await expect(page.locator('h1')).toBeVisible();
    
    // 4. Test Native Payout Approvals (The Core of Admin duties)
    await page.goto('/incentives');
    await expect(page.locator('h1:has-text("Incentives")')).toBeVisible();
    
    // We mocked incentive_programs, so 'Alpha Phase Insights' should render perfectly!
    const programCard = page.locator('h3', { hasText: 'Alpha Phase Insights' });
    await expect(programCard).toBeVisible();
    
    // Click explicitly onto the Program to open the Approval Portal
    await programCard.click();
    await page.waitForURL('**/incentives/1234');

    // Inside IncentiveDetail, wait for Disburseent data to hydrate
    await expect(page.locator('text="Disbursement History"')).toBeVisible();
    
    // Identify the 'E2E Worker' payout row with amount and awaiting_approval status badge
    await expect(page.locator('text="E2E Worker"')).toBeVisible();
    // Scope the status badge check to the table to avoid the summary card duplicate
    await expect(page.locator('table').locator('text="awaiting_approval"')).toBeVisible();
    await expect(page.locator('text="$20.00"').first()).toBeVisible(); // 2000 cents validation

    // Locate the Approve Payout Button — it's the only <button> inside the Actions <td> of the awaiting row
    // We scope to the table row containing 'E2E Worker' and grab its action button
    const workerRow = page.locator('tr', { hasText: 'E2E Worker' });
    const approveBtn = workerRow.locator('button').first();
    await approveBtn.click();

    // Expect the approval Toast Success validation!
    await expect(page.locator('text=/Disbursement approved/i').first()).toBeVisible();

    // End gracefully
  });
});
