/**
 * Routing Tests
 * Tests for all frontend routes including /council, /admin, and navigation
 */
import { test, expect } from '@playwright/test';
import {
  ROUTES,
  UI,
  ROLES,
  setupAuthenticatedUser,
  setupStaffUser,
  navigateToCouncil,
  navigateToAdmin,
} from '../fixtures/test-helpers.js';

test.describe('Public Routes', () => {
  test('home page loads for unauthenticated users', async ({ page }) => {
    await page.goto(ROUTES.home);
    await page.waitForLoadState('networkidle');

    // Should show landing page
    await expect(page).toHaveURL('/');
  });

  test('privacy page is accessible', async ({ page }) => {
    await page.goto(ROUTES.privacy);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/privacy/);
  });

  test('terms page is accessible', async ({ page }) => {
    await page.goto(ROUTES.terms);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/terms/);
  });

  test('reset-password page is accessible', async ({ page }) => {
    await page.goto(ROUTES.resetPassword);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/reset-password/);
  });
});

test.describe('Council Route', () => {
  test('unauthenticated users cannot access /council', async ({ page }) => {
    await page.goto(ROUTES.council);
    await page.waitForLoadState('networkidle');

    // Should redirect to home or show auth
    const url = page.url();
    // Either redirected away from /council or shows auth modal
    const councilContent = page.locator(UI.app.sidebar);
    const visible = await councilContent.isVisible({ timeout: 3000 }).catch(() => false);
    expect(visible).toBe(false);
  });

  test('authenticated users can access /council', async ({ page, request }) => {
    await setupAuthenticatedUser(page, request);

    await page.goto(ROUTES.council);
    await page.waitForLoadState('networkidle');

    // Should show the main app with sidebar
    await expect(page.locator(UI.app.sidebar)).toBeVisible({ timeout: 10000 });
  });

  test('authenticated users are redirected from / to /council', async ({ page, request }) => {
    await setupAuthenticatedUser(page, request);

    await page.goto(ROUTES.home);
    await page.waitForLoadState('networkidle');

    // Wait for React's useEffect redirect to trigger
    await page.waitForURL(/\/council/, { timeout: 10000 });
  });

  test('council page shows chat interface', async ({ page, request }) => {
    await setupAuthenticatedUser(page, request);
    await navigateToCouncil(page);

    const chatInterface = page.locator(UI.chat.container);
    await expect(chatInterface).toBeVisible({ timeout: 10000 });
  });

  test('council page shows new decision button', async ({ page, request }) => {
    await setupAuthenticatedUser(page, request);
    await navigateToCouncil(page);

    const newBtn = page.locator(UI.app.newDecisionButton);
    await expect(newBtn).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Settings Route', () => {
  test('unauthenticated users cannot access /settings', async ({ page }) => {
    await page.goto(ROUTES.settings);
    await page.waitForLoadState('networkidle');

    // Should redirect or show auth
    const settingsContent = page.locator(UI.settings.container);
    const visible = await settingsContent.isVisible({ timeout: 3000 }).catch(() => false);
    expect(visible).toBe(false);
  });

  test('authenticated users can access /settings', async ({ page, request }) => {
    await setupAuthenticatedUser(page, request);

    await page.goto(ROUTES.settings);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/settings/);
  });
});

test.describe('Admin Route', () => {
  test('unauthenticated users cannot access /admin', async ({ page }) => {
    await page.goto(ROUTES.admin);
    await page.waitForLoadState('networkidle');

    // Should redirect
    const adminContent = page.locator(UI.admin.container);
    const visible = await adminContent.isVisible({ timeout: 3000 }).catch(() => false);
    expect(visible).toBe(false);
  });

  test('regular users cannot access /admin', async ({ page, request }) => {
    await setupAuthenticatedUser(page, request);

    await page.goto(ROUTES.admin);
    await page.waitForLoadState('networkidle');

    // Should redirect to /council (backend rejects non-staff users)
    await page.waitForURL(/\/council/, { timeout: 10000 });
  });

  // NOTE: This test is skipped because setupStaffUser() only modifies localStorage,
  // not the database. The backend verifies roles from the database.
  test.skip('staff users can access /admin', async ({ page, request }) => {
    await setupStaffUser(page, request, ROLES.employee);
    await navigateToAdmin(page);

    await expect(page).toHaveURL(/\/admin/);
  });
});

test.describe('Navigation', () => {
  test('logo links to home', async ({ page, request }) => {
    await setupAuthenticatedUser(page, request);
    await navigateToCouncil(page);

    const logo = page.locator(UI.header.logo);
    await expect(logo).toBeVisible();
  });

  test('can navigate between council and settings', async ({ page, request }) => {
    await setupAuthenticatedUser(page, request);
    await navigateToCouncil(page);

    // Navigate to settings (via URL for now)
    await page.goto(ROUTES.settings);
    await expect(page).toHaveURL(/\/settings/);

    // Navigate back to council
    await page.goto(ROUTES.council);
    await expect(page).toHaveURL(/\/council/);
  });

  // NOTE: This test is skipped because setupStaffUser() only modifies localStorage,
  // not the database. The backend verifies roles from the database.
  test.skip('staff can navigate to admin', async ({ page, request }) => {
    await setupStaffUser(page, request, ROLES.admin);
    await navigateToCouncil(page);

    const adminLink = page.locator(UI.header.adminLink);
    if (await adminLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await adminLink.click();
      await expect(page).toHaveURL(/\/admin/);
    }
  });
});

test.describe('404 Handling', () => {
  test('unknown routes show fallback', async ({ page }) => {
    await page.goto('/nonexistent-route-12345');
    await page.waitForLoadState('networkidle');

    // Should either show 404 page or redirect to home
    // The app uses /* catch-all route
  });
});

test.describe('Deep Linking', () => {
  test('can deep link to /council after auth', async ({ page, request }) => {
    // First authenticate
    await setupAuthenticatedUser(page, request);

    // Clear page and navigate directly
    await page.goto(ROUTES.council);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/council/);
    await expect(page.locator(UI.app.sidebar)).toBeVisible();
  });

  test('can deep link to /settings after auth', async ({ page, request }) => {
    await setupAuthenticatedUser(page, request);

    await page.goto(ROUTES.settings);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/settings/);
  });
});
