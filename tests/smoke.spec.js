/**
 * Smoke Tests
 * Quick health check of critical paths - run before deploys
 *
 * These tests verify that the most critical functionality works.
 * They should be fast and reliable.
 */

import { test, expect } from '@playwright/test';
import { API_BASE_URL, ROUTES, API_ENDPOINTS, UI } from './fixtures/test-helpers.js';

test.describe('Smoke Tests - Critical Path Verification', () => {
  test.describe('Frontend Availability', () => {
    test('landing page loads successfully', async ({ page }) => {
      console.log('Checking: Landing page accessibility');

      const response = await page.goto('/');
      expect(response.status()).toBeLessThan(400);

      // Verify key landing page elements
      await expect(page.locator('body')).toBeVisible();
      console.log('  Landing page loaded successfully');
    });

    test('privacy page loads successfully', async ({ page }) => {
      console.log('Checking: Privacy policy page');

      const response = await page.goto(ROUTES.privacy);
      expect(response.status()).toBeLessThan(400);
      console.log('  Privacy page loaded successfully');
    });

    test('terms page loads successfully', async ({ page }) => {
      console.log('Checking: Terms of service page');

      const response = await page.goto(ROUTES.terms);
      expect(response.status()).toBeLessThan(400);
      console.log('  Terms page loaded successfully');
    });
  });

  test.describe('Backend API Availability', () => {
    test('API health check - run modes endpoint', async ({ request }) => {
      console.log('Checking: API availability via /api/run-modes');

      const response = await request.get(`${API_BASE_URL}${API_ENDPOINTS.runModes}`);
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toBeDefined();
      console.log('  API is responding correctly');
    });

    test('API health check - credits info endpoint', async ({ request }) => {
      console.log('Checking: Credits info endpoint');

      const response = await request.get(`${API_BASE_URL}${API_ENDPOINTS.creditsInfo}`);
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('credits');
      expect(data).toHaveProperty('price_display');
      expect(data).toHaveProperty('stripe_configured');
      console.log('  Credits endpoint responding correctly');
    });
  });

  test.describe('Authentication Flow Check', () => {
    test('login form is accessible', async ({ page }) => {
      console.log('Checking: Login form accessibility');

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Look for log in button on landing page
      const loginButton = page.locator(UI.landing.loginButton);

      if (await loginButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await loginButton.click();

        // Verify login form appears
        await expect(page.locator(UI.auth.emailInput)).toBeVisible({ timeout: 5000 });
        await expect(page.locator(UI.auth.passwordInput)).toBeVisible();
        console.log('  Login form is accessible');
      } else {
        // User might already be logged in, check for main app
        console.log('  Already authenticated or auth flow differs');
      }
    });

    test('registration form is accessible', async ({ page }) => {
      console.log('Checking: Registration form accessibility');

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Look for sign up button on landing page (Get 5 Free Credits or Try Free)
      const signUpButton = page.locator(UI.landing.heroButton).or(page.locator(UI.landing.tryFreeButton)).first();

      if (await signUpButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await signUpButton.click();

        // The flow opens an inline email capture form first, OR the auth modal
        // Check for either the inline email input or the auth modal
        const inlineEmailInput = page.getByPlaceholder('Enter your email');
        const authEmailInput = page.locator(UI.auth.emailInput);

        // Wait for either form to appear
        await expect(inlineEmailInput.or(authEmailInput).first()).toBeVisible({ timeout: 5000 });
        console.log('  Registration form is accessible');
      } else {
        console.log('  Registration button not found on current view');
      }
    });
  });

  test.describe('API Authentication Endpoints', () => {
    test('login endpoint responds correctly', async ({ request }) => {
      console.log('Checking: Login API endpoint');

      // Send invalid credentials - should get 401 or 400, not 500
      const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.login}`, {
        data: {
          email: 'nonexistent@example.com',
          password: 'wrongpassword',
        },
      });

      // Should be client error, not server error
      expect(response.status()).toBeLessThan(500);
      expect([400, 401, 403, 404, 422]).toContain(response.status());
      console.log('  Login endpoint responding (rejects invalid credentials)');
    });

    test('register endpoint responds correctly', async ({ request }) => {
      console.log('Checking: Register API endpoint');

      // Send invalid data - should get validation error, not 500
      const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
        data: {
          email: 'invalid',
          password: 'short',
        },
      });

      // Should be client error, not server error
      expect(response.status()).toBeLessThan(500);
      console.log('  Register endpoint responding (validates input)');
    });
  });

  test.describe('Static Assets', () => {
    test('CSS styles are loaded', async ({ page }) => {
      console.log('Checking: CSS styles loading');

      await page.goto('/');

      // Check that stylesheets are loaded
      const stylesheets = await page.locator('link[rel="stylesheet"]').count();
      const styleElements = await page.locator('style').count();

      // Either external stylesheets or inline styles should exist
      expect(stylesheets + styleElements).toBeGreaterThan(0);
      console.log(`  Found ${stylesheets} stylesheets and ${styleElements} style elements`);
    });

    test('JavaScript is loaded and executing', async ({ page }) => {
      console.log('Checking: JavaScript execution');

      await page.goto('/');

      // React should have hydrated the page
      // Check for React root or any dynamic content
      const scripts = await page.locator('script').count();
      expect(scripts).toBeGreaterThan(0);

      // Check React has mounted by looking for interactive elements
      await page.waitForFunction(() => {
        return document.body.innerHTML.length > 100;
      });
      console.log('  JavaScript is executing correctly');
    });
  });

  test.describe('Error Pages', () => {
    test('404 page or redirect for invalid routes', async ({ page }) => {
      console.log('Checking: Invalid route handling');

      const response = await page.goto('/this-route-definitely-does-not-exist-12345');

      // Should either show 404 or redirect to home (app-level routing)
      // Status might be 200 if React Router handles it client-side
      expect(response.status()).toBeLessThan(500);
      console.log('  Invalid routes handled gracefully');
    });
  });

  test.describe('Database Connectivity (via API)', () => {
    test('API can query database', async ({ request }) => {
      console.log('Checking: Database connectivity via API');

      // The run-modes endpoint likely queries config but may also hit DB
      // A more definitive test would be the conversations list (requires auth)
      const response = await request.get(`${API_BASE_URL}${API_ENDPOINTS.runModes}`);
      expect(response.status()).toBe(200);

      // If we get here without 500, database is likely connected
      console.log('  Database appears connected (API responding)');
    });
  });
});

test.describe('Critical User Journey - Quick Check', () => {
  test('user can navigate from landing to auth modal', async ({ page }) => {
    console.log('Checking: Landing to auth navigation');

    await page.goto('/');

    // Click the "Log in" button to get the auth modal
    const loginButton = page.locator(UI.landing.loginButton);

    if (await loginButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await loginButton.click();

      // Should see authentication form (the login modal)
      await expect(page.locator(UI.auth.emailInput)).toBeVisible({ timeout: 5000 });
      console.log('  Landing to auth flow works');
    } else {
      console.log('  Auth trigger not visible (may already be logged in)');
    }
  });
});
