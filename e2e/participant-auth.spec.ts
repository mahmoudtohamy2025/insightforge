import { test, expect } from '@playwright/test';

// Shared CORS headers for mocked Edge Functions
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

test.describe('Participant Auth Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Suppress console errors from mocked unhandled things in E2E
    page.on('console', msg => {
      if (msg.type() === 'error') console.error(`PAGE LOG ERROR: ${msg.text()}`);
    });

    // Catch-all to prevent unhandled Supabase requests from returning 401 and signing the user out
    await page.route('**/rest/v1/**', async route => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      await route.fulfill({ status: 200, headers: corsHeaders, body: '[]' });
    });

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
          body: JSON.stringify(responseData),
        });
      });
    };

    // Mock initial dashboard profile load so successful login redirects smoothly
    await mockEdgeFunction('participant-profile', {
      profile: { display_name: "Auth Tester" },
      reputation: { total_studies: 0 },
      earnings: { total_earned_cents: 0, pending_cents: 0, available_cents: 0 },
    });
  });

  test('Validates complete 4-step signup wizard with consents', async ({ page }) => {
    const timestamp = Date.now();
    const testEmail = `new_participant_${timestamp}@e2e.test`;

    // Intercept specific signup endpoint
    await page.route('**/functions/v1/participant-signup', async route => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    // Mock Supabase Auth to prevent real requests
    await page.route(/\/auth\/v1\/token\?grant_type=password/, async route => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      const user = {
        id: 'test-user-id',
        aud: 'authenticated',
        role: 'authenticated',
        email: testEmail,
        app_metadata: { provider: 'email' },
        user_metadata: { role: 'participant' },
        created_at: new Date().toISOString(),
      };
      await route.fulfill({ 
        status: 200, 
        headers: corsHeaders,
        contentType: 'application/json', 
        body: JSON.stringify({
          access_token: 'fake-jwt',
          refresh_token: 'fake-refresh',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user,
        })
      });
    });

    await page.route('**/auth/v1/user', async route => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user-id',
          aud: 'authenticated',
          role: 'authenticated',
          email: testEmail,
          app_metadata: { provider: 'email' },
          user_metadata: { role: 'participant' },
          created_at: new Date().toISOString(),
        })
      });
    });

    await page.goto('/participate/signup');
    await expect(page.locator('h1', { hasText: 'Join InsightForge' })).toBeVisible();

    // Step 1: Account
    await page.fill('#displayName', 'Auth Tester');
    await page.fill('#signupEmail', testEmail);
    await page.fill('#signupPw', 'Testing123!');
    
    // Check required consent checkboxes
    const termsCheckbox = page.locator('button#terms');
    const privacyCheckbox = page.locator('button#privacy');
    await termsCheckbox.click();
    await privacyCheckbox.click();
    
    await expect(page.getByRole('button', { name: "Next" })).toBeEnabled();
    await page.getByRole('button', { name: "Next" }).click();

    // Step 2: Demographics
    await expect(page.locator('text="Demographics"')).toBeVisible();
    
    // Open country dropdown
    await page.locator('button:has-text("Select country")').click();
    await page.locator('div[role="option"]', { hasText: 'United Kingdom' }).click();
    await page.getByRole('button', { name: "Next" }).click();

    // Step 3: Professional
    await expect(page.locator('text="Professional"')).toBeVisible();
    await page.getByRole('button', { name: "Next" }).click();

    // Step 4: Interests
    await expect(page.locator('text="Interests"')).toBeVisible();
    await page.getByRole('button', { name: "Technology", exact: true }).click();
    await page.getByRole('button', { name: "Create Account" }).click();

    // Verify redirect to dashboard
    await page.waitForURL('**/participate/dashboard');
    await expect(page.locator('text="Let\'s get you set up and earning!"')).toBeVisible({ timeout: 15000 });
  });

  test('Validates Forgot Password flow', async ({ page }) => {
    await page.goto('/participate/login');
    
    // Toggle forgot password mode
    await page.locator('button', { hasText: 'Forgot password?' }).click();
    await expect(page.locator('h3', { hasText: 'Reset Password' })).toBeVisible();
    
    // Fill email
    await page.fill('#reset-email', 'forgot@example.com');
    
    // Note: We don't intercept Supabase Auth natively here easily, but we can check if the button goes to loading state
    // Playwright can intercept Supabase GoTrue calls:
    await page.route('**/auth/v1/recover*', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });
    
    await page.getByRole('button', { name: 'Send Reset Link' }).click();
    
    // Verify success message
    await expect(page.locator('text="Check your inbox for a reset link."')).toBeVisible({ timeout: 10000 });
    
    // Toggle back
    await page.locator('button', { hasText: 'Back to sign in' }).click();
    await expect(page.locator('h3', { hasText: 'Sign In' })).toBeVisible();
  });
});
