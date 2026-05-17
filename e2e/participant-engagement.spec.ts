import { test, expect } from '@playwright/test';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

test.describe('Participant Engagement & Retention Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Provide a valid fake JWT so we bypass auth guard locally
    await page.addInitScript(() => {
      const session = {
        access_token: 'fake-jwt',
        refresh_token: 'fake-refresh',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'test-user-id', role: 'authenticated', email: 'test@example.com', user_metadata: { role: 'participant' } }
      };
      ['sb-xwjvsmwefbukaswkwpbf-auth-token', 'sb-localhost-auth-token', 'sb-127-auth-token']
        .forEach(key => window.localStorage.setItem(key, JSON.stringify(session)));
    });

    // Catch-all to prevent unhandled Supabase requests from returning 401 and signing the user out
    await page.route('**/rest/v1/**', async route => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      await route.fulfill({ status: 200, headers: corsHeaders, body: '[]' });
    });

    // Mock Auth User to prevent redirect to login
    await page.route('**/auth/v1/*', async route => {
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
          email: 'test@example.com',
          app_metadata: { provider: 'email' },
          user_metadata: { role: 'participant' },
          created_at: new Date().toISOString(),
        })
      });
    });

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

    // Mock Profile
    await mockEdgeFunction('participant-profile', {
      profile: { display_name: "Engagement Tester", paypal_email: null },
      reputation: { total_studies: 12, tier: "trusted", avg_rating: 4.8 },
      earnings: { total_earned_cents: 12500, pending_cents: 0, available_cents: 12500, history: [] },
      payout_requests: [],
    });

    // Mock Impact
    await mockEdgeFunction('participant-impact', {
      stats: { total_studies: 12, twin_contributions: 5, completion_rate: 100, avg_rating: 4.8 },
      badges: [{ id: "b1", name: "Early Adopter", icon: "🚀", earned: true, description: "Joined early" }],
      impactFeed: [{ type: "twin", message: "Your twin was used in a focus group", timestamp: new Date().toISOString() }],
      tierProgress: { current: "trusted", next: "expert", progress: 60, studiesNeeded: 20, studiesCompleted: 12 }
    });

    // Mock Twin
    await mockEdgeFunction('participant-twin-preview', {
      twin: {
        archetype: "Analytical Pragmatist",
        archetype_description: "You focus on logical solutions.",
        traits: [{ name: "Analytical", score: 88, description: "Highly data-driven" }],
        calibration_score: 85,
        last_updated: new Date().toISOString(),
        insights: ["Tends to prefer practical features over aesthetics."]
      }
    });

    // Mock Referral
    await mockEdgeFunction('participant-referral', {
      referral_code: "TEST-E2E-REF",
      referral_url: "https://insightforge.app/participate/signup?ref=TEST-E2E-REF",
      stats: { total_referrals: 5, successful_referrals: 4, total_earned_cents: 2000 },
      referrals: [{ id: "r1", status: "completed", joined_at: new Date().toISOString(), bonus_paid: true, bonus_amount_cents: 500, referred_display_name: "Friend 1" }]
    });

    await mockEdgeFunction('participant-privacy', {
      privacy_request: { id: "privacy-e2e", request_type: "export", status: "completed" },
      export: { exported_at: new Date().toISOString(), profile: { display_name: "Engagement Tester" } },
    });
  });

  test('Validates Profile Settings & Data Erasure Warning', async ({ page }) => {
    await page.goto('/participate/profile');
    
    await expect(page.locator('h1', { hasText: 'My Profile' })).toBeVisible();
    
    // Check PayPal Saving
    await page.fill('#paypal-email', 'test@paypal.com');
    await page.getByRole('button', { name: "Save", exact: true }).click();
    await expect(page.locator('text="Saved"')).toBeVisible();

    // Check Data Erasure Modal
    await page.getByRole('button', { name: "Request Data Erasure" }).click();
    await expect(page.locator('text="Are you absolutely sure?"')).toBeVisible();
    await page.getByRole('button', { name: "Cancel" }).click();
  });

  test('Validates Impact & Achievement Tracking', async ({ page }) => {
    await page.goto('/participate/impact');
    
    await expect(page.locator('h1', { hasText: 'Your Impact' })).toBeVisible();
    
    // Stats rendered
    await expect(page.locator('p:has-text("12")')).toBeVisible();
    await expect(page.locator('text="trusted"')).toBeVisible();

    // Badges & Achievements
    await expect(page.locator('text="Early Adopter"')).toBeVisible();
    await expect(page.locator('text="First Earner"')).toBeVisible(); // Due to 12500 cents

    // Feed
    await expect(page.getByText(/Your twin was used/)).toBeVisible();
  });

  test('Validates My Twin Interactive Experience', async ({ page }) => {
    await page.goto('/participate/my-twin');
    
    await expect(page.locator('h1', { hasText: 'My AI Twin' })).toBeVisible();
    await expect(page.locator('text="Analytical Pragmatist"')).toBeVisible();
    await expect(page.locator('text="85%"')).toBeVisible();

    // Test Ask Your Twin
    await page.fill('textarea', 'Do you like AI?');
    await page.getByRole('button', { name: /Ask My Twin/i }).click();

    // Wait for the simulated response to appear (1.5s timeout built into the UI)
    await expect(page.locator('text="Your Twin says:"')).toBeVisible({ timeout: 5000 });
  });

  test('Validates Tiered Referral System', async ({ page }) => {
    await page.goto('/participate/referrals');
    
    await expect(page.locator('h1', { hasText: 'Refer & Earn' })).toBeVisible();
    
    // Ensure the 4 referrals puts them in the $5 Tier (Tier 2)
    await expect(page.locator('text="$5 each"')).toBeVisible();
    
    // Ensure history renders
    await expect(page.locator('text="Friend 1"')).toBeVisible();
    await expect(page.locator('text="$5.00 earned ✓"')).toBeVisible();
  });
});
