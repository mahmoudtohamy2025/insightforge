import { test, expect } from '@playwright/test';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

test.describe('Participant Dashboard States', () => {
  const setupMocks = async (page: any, totalStudies: number, lastActivityDaysAgo: number | null = null) => {
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

    // Shared Edge Function Mocks
    await page.route(`**/functions/v1/participant-profile`, async route => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      
      const lastActivity = lastActivityDaysAgo 
        ? new Date(Date.now() - (lastActivityDaysAgo * 24 * 60 * 60 * 1000)).toISOString() 
        : new Date().toISOString();

      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: { display_name: "Dashboard Tester" },
          reputation: { total_studies: totalStudies, tier: totalStudies >= 3 ? "regular" : "newcomer" },
          earnings: { total_earned_cents: totalStudies * 500, pending_cents: 0, available_cents: totalStudies * 500 },
        }),
      });
    });

    // Mock active studies count for the dashboard call
    await page.route('**/rest/v1/study_listings?select=*&status=eq.active', async route => {
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders, 'Content-Range': '0-0/5' },
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Mock "my-active-studies" endpoint
    await page.route('**/rest/v1/study_participations?select=id%2C+status%2C+study_listings%28title%2C+reward_amount_cents%2C+estimated_minutes%29&participant_id=eq.*&status=in.%28accepted%2Cin_progress%29&limit=1', async route => {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify(totalStudies > 0 ? [{
          id: "active_part_1",
          status: "in_progress",
          study_listings: { title: "Mock In-Progress Study" }
        }] : []),
      });
    });

    // Mock top recommended study
    await page.route('**/rest/v1/study_listings?select=id%2C+title%2C+reward_amount_cents%2C+estimated_minutes%2C+study_type&status=eq.active&current_participants=gt.-1&limit=1', async route => {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: "top_study_1",
          title: "Highly Recommended Study",
          reward_amount_cents: 1000,
          estimated_minutes: 10,
        }]),
      });
    });
  };

  test('Renders Newcomer State (0 studies)', async ({ page }) => {
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

    await setupMocks(page, 0);
    await page.goto('/participate/dashboard');

    await expect(page.locator('text="Let\'s get you set up and earning!"')).toBeVisible();
    await expect(page.locator('text="Getting Started"')).toBeVisible(); // Onboarding checklist
    await expect(page.getByText(/Newcomer/).first()).toBeVisible(); // Tier Badge
    await expect(page.locator('text="Complete 3 studies to unlock Regular"')).toBeVisible();
    
    // Top recommended study should NOT show for new users (as per logic)
    await expect(page.locator('text="Highly Recommended Study"')).not.toBeVisible();
  });

  test('Renders Active State with Continue Study', async ({ page }) => {
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

    await setupMocks(page, 4); // 4 studies -> Active state
    await page.goto('/participate/dashboard');

    await expect(page.locator('text="Here\'s your research participation overview."')).toBeVisible();
    await expect(page.getByText(/Regular/).first()).toBeVisible(); // Tier Badge
    
    // Recommended study card
    await expect(page.locator('text="Recommended For You"')).toBeVisible();

    // Community Feed Widget
    await expect(page.locator('text="Community Activity"')).toBeVisible();
  });
});
