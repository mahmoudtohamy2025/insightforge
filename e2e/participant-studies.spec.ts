import { test, expect } from '@playwright/test';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

test.describe('Participant Studies Flow', () => {
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

    // Mock study list
    await mockEdgeFunction('study-listing', {
      studies: [
        {
          id: "mock_study_e2e_1",
          title: "New Participant Study Flow Test",
          description: "Detailed description here.",
          study_type: "survey",
          estimated_minutes: 10,
          reward_amount_cents: 1500, // $15.00
          currency: "usd",
          max_participants: 100,
          current_participants: 10,
          requirements: { "age": "18-35" },
          status: "published",
          closes_at: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days
          created_at: new Date().toISOString()
        }
      ]
    });

    // Mock match scores
    await mockEdgeFunction('participant-match-scores', {
      scores: { "mock_study_e2e_1": 90 }
    });

    // Mock study participate endpoint
    await mockEdgeFunction('study-participate', {
      success: true
    });

    // Mock single study detail REST query
    await page.route('**/rest/v1/study_listings?select=*&id=eq.mock_study_e2e_1', async route => {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify({
          id: "mock_study_e2e_1",
          title: "New Participant Study Flow Test",
          description: "Detailed description here.",
          study_type: "survey",
          estimated_minutes: 10,
          reward_amount_cents: 1500,
          currency: "usd",
          max_participants: 100,
          current_participants: 10,
          requirements: { "age": "18-35" },
          status: "published"
        }),
      });
    });

    // Mock "my-accepted-ids" endpoint
    await page.route('**/rest/v1/study_participations?select=study_id**', async route => {
      await route.fulfill({ status: 200, headers: corsHeaders, body: '[]' });
    });

    // Mock "my-studies" hub endpoint
    await page.route('**/rest/v1/study_participations?select=id%2Cstudy_id%2Cstatus%2Ccreated_at%2Ccompleted_at%2Cstudy_listings%28id%2Ctitle%2Cstudy_type%2Cestimated_minutes%2Creward_amount_cents%2Cdescription%29**', async route => {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: "part_1",
          study_id: "mock_study_e2e_1",
          status: "accepted",
          study_listings: {
            id: "mock_study_e2e_1",
            title: "New Participant Study Flow Test",
            study_type: "survey",
            estimated_minutes: 10,
            reward_amount_cents: 1500
          }
        }]),
      });
    });
  });

  test('Validates Study Detail Consent & Accept Flow', async ({ page }) => {
    // 1. Visit Study Feed
    await page.goto('/participate/studies');
    
    // Check elements in StudyFeed
    await expect(page.getByRole('link', { name: /New Participant Study Flow Test/ }).first()).toBeVisible();
    await expect(page.getByText(/90% match/).first()).toBeVisible();

    // 2. Click "View" to go to Study Detail
    await page.getByRole('button', { name: "View" }).first().click();
    await page.waitForURL('**/participate/studies/mock_study_e2e_1');

    // Check detail page elements
    await expect(page.locator('h1', { hasText: 'New Participant Study Flow Test' })).toBeVisible();
    await expect(page.locator('text="Eligibility Requirements"')).toBeVisible();
    await expect(page.locator('text="age:"')).toBeVisible();
    
    // Check Accept button is gated initially
    await expect(page.getByRole('button', { name: /Please agree to the terms above/i })).toBeDisabled();

    // 3. Click Consent Checkboxes
    await page.getByRole('checkbox', { name: /legitimate research study/i }).click();
    await page.getByRole('checkbox', { name: /anonymized data being used/i }).click();

    // Now button should be enabled
    const acceptBtn = page.getByRole('button', { name: /Accept Study/i });
    await expect(acceptBtn).toBeEnabled();

    // 4. Accept Study
    await acceptBtn.click();

    // Expect navigation to My Studies
    await page.waitForURL('**/participate/my-studies');
    await expect(page.locator('h1', { hasText: 'My Studies' })).toBeVisible();
  });

  test('Validates Study Participation Modal Execution', async ({ page }) => {
    // Navigate directly to My Studies
    await page.goto('/participate/my-studies');

    // Look for the study we mocked in the active tab
    await expect(page.locator('text="New Participant Study Flow Test"')).toBeVisible();

    // Start Study
    await page.getByRole('button', { name: /Start Study/i }).click();

    // Verify Modal Appears
    await expect(page.locator('h2', { hasText: 'New Participant Study Flow Test' })).toBeVisible();
    await expect(page.locator('text="Ready to Begin?"')).toBeVisible();

    // Start Question Flow
    await page.getByRole('button', { name: 'Start' }).click();

    // Answer Q1 (textarea)
    await page.fill('textarea', 'This is my test opinion.');
    await page.getByRole('button', { name: 'Next' }).click();

    // Answer Q2 (radio)
    await page.getByText('Satisfied', { exact: true }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    // Answer Q3 (textarea)
    await page.fill('textarea', 'No changes needed.');
    await page.getByRole('button', { name: 'Next' }).click();

    // Answer Q4 (radio)
    await page.getByText('Likely', { exact: true }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    // Answer Q5 (textarea optional, skip)
    await page.getByRole('button', { name: 'Submit Study' }).click();

    // Success Screen
    await expect(page.locator('text="Study Submitted!"')).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();

    // Modal should close (Wait for the modal title to disappear)
    await expect(page.locator('h2', { hasText: 'New Participant Study Flow Test' })).toBeHidden();
  });
});
