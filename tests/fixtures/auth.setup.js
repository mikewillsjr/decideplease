/**
 * Authentication Setup for Tests
 * Creates authenticated browser contexts for testing
 */

import { test as setup, expect } from '@playwright/test';
import { TEST_USER, API_BASE_URL } from './test-helpers.js';

const authFile = 'tests/.auth/user.json';

/**
 * Setup test - creates an authenticated state file
 * This runs before tests that require authentication
 */
setup('authenticate', async ({ page }) => {
  // Try to log in with test user
  await page.goto('/');

  // Check if we're on the landing page (need to log in)
  const signInButton = page.locator('button:has-text("Sign In")');

  if (await signInButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await signInButton.click();

    // Wait for auth modal
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });

    // Fill login form
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);

    // Submit
    await page.click('button[type="submit"]');

    // Wait for successful login (should see the main app)
    await page.waitForSelector('[data-testid="sidebar"], .sidebar, .conversations-list', { timeout: 10000 });
  }

  // Save authentication state
  await page.context().storageState({ path: authFile });
});
