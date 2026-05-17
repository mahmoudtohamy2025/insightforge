import { expect, test } from '@playwright/test';
import { installConsoleErrorTrap, mockAuthenticatedUser, mockSupabaseApi } from './support/supabaseMocks';

test.describe('tenant research operations panel', () => {
  test.beforeEach(async ({ page }) => {
    installConsoleErrorTrap(page);
    await mockAuthenticatedUser(page, { role: 'researcher' });
    await mockSupabaseApi(page);
  });

  test('renders the command center and opens Audience CRM from the sidebar', async ({ page }) => {
    await page.goto('/panel');

    await expect(page.getByText('Research Operations')).toBeVisible();
    await expect(page.locator('a[data-sidebar="menu-button"][href="/panel"]').filter({ hasText: 'Panel Overview' })).toBeVisible();
    await expect(page.locator('a[data-sidebar="menu-button"][href="/requirements"]').filter({ hasText: 'Study Pipeline' })).toBeVisible();
    await expect(page.locator('a[data-sidebar="menu-button"][href="/participants"]').filter({ hasText: 'Audience CRM' })).toBeVisible();
    await expect(page.locator('a[data-sidebar="menu-button"][href="/incentives"]').filter({ hasText: 'Incentives' })).toBeVisible();
    await expect(page.getByText('Active Studies')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Audience Supply' })).toBeVisible();

    await page.locator('a[data-sidebar="menu-button"][href="/participants"]').filter({ hasText: 'Audience CRM' }).click();
    await expect(page).toHaveURL(/\/participants$/);
  });
});
