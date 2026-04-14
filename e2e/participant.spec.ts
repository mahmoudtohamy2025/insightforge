import { test, expect } from '@playwright/test';

test.describe('Participant Module Pipeline Tests', () => {
  test('Validates participant signing up, matching, applying, and cashing out', async ({ page }) => {
    // Add debugging log
    page.on('console', msg => {
      if (msg.type() === 'error') console.error(`PAGE LOG ERROR: ${msg.text()}`);
    });

    const timestamp = Date.now();
    const testEmail = `participant_${timestamp}@e2e.test`;

    // Shared CORS headers for mocked Edge Functions
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    };

    // Helper to mock Edge Functions simply
    const mockEdgeFunction = async (urlSuffix: string, responseData: any) => {
      await page.route(`**/functions/v1/${urlSuffix}`, async route => {
        if (route.request().method() === 'OPTIONS') {
          await route.fulfill({ status: 204, headers: corsHeaders });
          return;
        }
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify(responseData) // The frontend checks `data` wrapped or strictly JSON based on Edge Function return conventions! 
        });
      });
    };

    // 1. Set up mocks for the entire flow!
    await mockEdgeFunction('study-listing', {
      studies: [{
        id: "mock_study_1",
        title: "Mock E2E Usability Test",
        description: "A high-paying test for testing the testing framework.",
        study_type: "usability_test",
        estimated_minutes: 15,
        reward_amount_cents: 5500, // $55.00
        currency: "usd",
        max_participants: 10,
        current_participants: 2,
        requirements: {},
        status: "published",
        closes_at: null,
        created_at: new Date().toISOString()
      }]
    });

    await mockEdgeFunction('participant-match-scores', {
      scores: { "mock_study_1": 95 } // Triggers the 95% match badge
    });

    await mockEdgeFunction('study-participate', {
      success: true, // Acceptance success payload
    });

    await mockEdgeFunction('participant-profile', {
      earnings: {
        total_earned_cents: 5500,
        pending_cents: 0,
        available_cents: 5500,
        history: [{ 
          id: "hist_1", 
          amount_cents: 5500, 
          status: "available", 
          description: "Mock E2E Usability Test completion", 
          created_at: new Date().toISOString() 
        }]
      },
      reputation: { streak_weeks: 2, total_studies: 1 }
    });

    await mockEdgeFunction('participant-cashout', {
      success: true,
      method: "tremendous"
    });

    // 2. Execute flow: Sign up
    await page.goto('/participate/signup');
    await expect(page.locator('text="Join InsightForge"')).toBeVisible();

    // Step 1: Account
    await page.fill('#displayName', 'E2E Participant');
    await page.fill('#signupEmail', testEmail);
    await page.fill('#signupPw', 'Testing123!');
    await page.getByRole('button', { name: "Next" }).click();

    // Step 2: Demographics 
    // It's optional, so let's just assert we moved and click Next
    await expect(page.locator('text="Demographics"')).toBeVisible();
    await page.getByRole('button', { name: "Next" }).click();

    // Step 3: Professional (skip optionally)
    await expect(page.locator('text="Professional"')).toBeVisible();
    await page.getByRole('button', { name: "Next" }).click();

    // Step 4: Interests
    await expect(page.locator('text="Interests"')).toBeVisible();
    await page.getByRole('button', { name: "Technology", exact: true }).click(); // Select a chip
    await page.getByRole('button', { name: "Create Account" }).click();

    // 3. Dashbaord & Redirect
    // Wait for the successful welcome toast or dashboard navigation
    await page.waitForURL('**/participate/dashboard');
    await expect(page.locator('text="Welcome! 🎉"')).toBeVisible({ timeout: 15000 });

    // 4. Navigate to Studies
    await page.goto('/participate/studies');
    
    // Validate mocked rendering
    await expect(page.locator('h3:has-text("Mock E2E Usability Test")').first()).toBeVisible();
    await expect(page.locator('text="95% match"').first()).toBeVisible();
    await expect(page.locator('text="$55.00"').first()).toBeVisible();

    // 5. Explicitly Accept the Study!
    const acceptBtn = page.getByRole('button', { name: "Accept" }).first();
    await expect(acceptBtn).toBeEnabled();
    await acceptBtn.click();
    await expect(page.locator('text=/Study Accepted/i').first()).toBeVisible();

    // 6. Navigate to Earnings and Cash out
    await page.goto('/participate/earnings');
    await expect(page.locator('h1:has-text("Earnings")')).toBeVisible();
    
    // Validate Earnings Mock Payload Rendered!
    await expect(page.locator('p:has-text("$55.00")').first()).toBeVisible();

    // Validate we can click Cash Out because $55.00 > $5.00 threshold
    const cashOutBtn = page.getByRole('button', { name: /Cash Out \$55.00/i });
    await expect(cashOutBtn).toBeEnabled();
    await cashOutBtn.click();

    // Validate Confetti hook + toast
    await expect(page.locator('text=/is on its way/i').first()).toBeVisible();
    
  });
});
