/**
 * E2E Tests - Authentication Flows
 * Tests for login, registration, logout, and password reset
 */

import { test, expect } from '@playwright/test';
import {
  generateTestEmail,
  generateTestPassword,
  API_BASE_URL,
  API_ENDPOINTS,
  UI,
  ROUTES,
  openAuthModal,
  setupAuthenticatedUser,
  navigateToCouncil,
} from '../fixtures/test-helpers.js';

test.describe('Authentication - Registration Flow', () => {
  test.describe('Happy Path', () => {
    test('user can register with valid email and password', async ({ page }) => {
      console.log('Testing: Successful registration flow');

      const testEmail = generateTestEmail();
      const testPassword = generateTestPassword();

      await openAuthModal(page, 'signup');

      // Fill registration form
      await page.fill(UI.auth.emailInput, testEmail);
      await page.fill(UI.auth.passwordInput, testPassword);

      // Fill confirm password if it exists
      const confirmPasswordInput = page.locator(UI.auth.confirmPasswordInput);
      if (await confirmPasswordInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmPasswordInput.fill(testPassword);
      }

      // Submit registration
      await page.click(UI.auth.submitButton);

      // Should succeed - see sidebar (logged in)
      await expect(page.locator(UI.app.sidebar)).toBeVisible({ timeout: 10000 });

      console.log(`  Registered successfully with ${testEmail}`);
    });
  });

  test.describe('Error Cases', () => {
    test('registration fails with invalid email format', async ({ page }) => {
      console.log('Testing: Registration with invalid email');

      await openAuthModal(page, 'signup');

      // Try invalid email
      await page.fill(UI.auth.emailInput, 'notanemail');
      await page.fill(UI.auth.passwordInput, generateTestPassword());

      const confirmPasswordInput = page.locator(UI.auth.confirmPasswordInput);
      if (await confirmPasswordInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmPasswordInput.fill(generateTestPassword());
      }

      await page.click(UI.auth.submitButton);

      // Should show validation error or prevent submission via HTML5 validation
      const emailInput = page.locator(UI.auth.emailInput);
      const isInvalid = await emailInput.evaluate(el => !el.validity.valid);
      const hasError = await page.locator(UI.auth.errorMessage).isVisible().catch(() => false);

      expect(isInvalid || hasError).toBe(true);
      console.log('  Invalid email rejected correctly');
    });

    test('registration fails with short password', async ({ page }) => {
      console.log('Testing: Registration with short password');

      await openAuthModal(page, 'signup');

      await page.fill(UI.auth.emailInput, generateTestEmail());
      await page.fill(UI.auth.passwordInput, 'short'); // Less than 8 chars

      const confirmPasswordInput = page.locator(UI.auth.confirmPasswordInput);
      if (await confirmPasswordInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmPasswordInput.fill('short');
      }

      await page.click(UI.auth.submitButton);

      // Should show error about password length
      await expect(page.locator(UI.auth.errorMessage)).toBeVisible({ timeout: 5000 });
      console.log('  Short password rejected correctly');
    });

    test('registration fails with mismatched passwords', async ({ page }) => {
      console.log('Testing: Registration with mismatched passwords');

      await openAuthModal(page, 'signup');

      await page.fill(UI.auth.emailInput, generateTestEmail());
      await page.fill(UI.auth.passwordInput, 'Password123!');

      const confirmPasswordInput = page.locator(UI.auth.confirmPasswordInput);
      if (await confirmPasswordInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmPasswordInput.fill('DifferentPassword456!');

        await page.click(UI.auth.submitButton);

        // Should show mismatch error
        await expect(page.locator(UI.auth.errorMessage)).toBeVisible({ timeout: 5000 });
        console.log('  Mismatched passwords rejected correctly');
      } else {
        console.log('  No confirm password field - skipping test');
      }
    });

    test('registration fails with already registered email', async ({ page, request }) => {
      console.log('Testing: Registration with existing email');

      const testEmail = generateTestEmail();
      const testPassword = generateTestPassword();

      // First, register the email via API
      await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
        data: { email: testEmail, password: testPassword },
      });

      // Now try to register again via UI
      await openAuthModal(page, 'signup');

      await page.fill(UI.auth.emailInput, testEmail);
      await page.fill(UI.auth.passwordInput, testPassword);

      const confirmPasswordInput = page.locator(UI.auth.confirmPasswordInput);
      if (await confirmPasswordInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmPasswordInput.fill(testPassword);
      }

      await page.click(UI.auth.submitButton);

      // Should show error about existing email
      await expect(page.locator(UI.auth.errorMessage)).toBeVisible({ timeout: 5000 });
      console.log('  Duplicate email rejected correctly');
    });
  });

  test.describe('Edge Cases', () => {
    test('handles email with special characters', async ({ page }) => {
      console.log('Testing: Email with special characters');

      const specialEmail = `test+special.chars_${Date.now()}@example.com`;

      await openAuthModal(page, 'signup');

      await page.fill(UI.auth.emailInput, specialEmail);

      const testPassword = generateTestPassword();
      await page.fill(UI.auth.passwordInput, testPassword);

      const confirmPasswordInput = page.locator(UI.auth.confirmPasswordInput);
      if (await confirmPasswordInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmPasswordInput.fill(testPassword);
      }

      await page.click(UI.auth.submitButton);

      // Should either succeed or show a proper error (not crash)
      await page.waitForTimeout(2000);
      const hasServerError = await page.locator('text="500", text="server error"').first().isVisible().catch(() => false);
      expect(hasServerError).toBe(false);
      console.log('  Special character email handled correctly');
    });
  });
});

test.describe('Authentication - Login Flow', () => {
  test.describe('Happy Path', () => {
    test('user can login with valid credentials', async ({ page, request }) => {
      console.log('Testing: Successful login flow');

      // Create a test user first
      const testEmail = generateTestEmail();
      const testPassword = generateTestPassword();

      await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
        data: { email: testEmail, password: testPassword },
      });

      await openAuthModal(page, 'signin');

      // Fill login form
      await page.fill(UI.auth.emailInput, testEmail);
      await page.fill(UI.auth.passwordInput, testPassword);

      // Submit
      await page.click(UI.auth.submitButton);

      // Should be logged in - see sidebar
      await expect(page.locator(UI.app.sidebar)).toBeVisible({ timeout: 10000 });
      console.log('  Login successful');
    });
  });

  test.describe('Error Cases', () => {
    test('login fails with wrong password', async ({ page, request }) => {
      console.log('Testing: Login with wrong password');

      const testEmail = generateTestEmail();
      const testPassword = generateTestPassword();

      await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
        data: { email: testEmail, password: testPassword },
      });

      await openAuthModal(page, 'signin');

      await page.fill(UI.auth.emailInput, testEmail);
      await page.fill(UI.auth.passwordInput, 'WrongPassword123!');

      await page.click(UI.auth.submitButton);

      // Should show error
      await expect(page.locator(UI.auth.errorMessage)).toBeVisible({ timeout: 5000 });
      console.log('  Wrong password rejected correctly');
    });

    test('login fails with non-existent email', async ({ page }) => {
      console.log('Testing: Login with non-existent email');

      await openAuthModal(page, 'signin');

      await page.fill(UI.auth.emailInput, `nonexistent_${Date.now()}@example.com`);
      await page.fill(UI.auth.passwordInput, 'SomePassword123!');

      await page.click(UI.auth.submitButton);

      // Should show error
      await expect(page.locator(UI.auth.errorMessage)).toBeVisible({ timeout: 5000 });
      console.log('  Non-existent email rejected correctly');
    });

    test('login fails with empty fields', async ({ page }) => {
      console.log('Testing: Login with empty fields');

      await openAuthModal(page, 'signin');

      // Try to submit without filling fields
      await page.click(UI.auth.submitButton);

      // Should show validation error or be disabled
      const emailInput = page.locator(UI.auth.emailInput);
      const isRequired = await emailInput.evaluate(el => el.hasAttribute('required'));
      const isInvalid = await emailInput.evaluate(el => !el.validity.valid);

      expect(isRequired || isInvalid).toBe(true);
      console.log('  Empty fields validation working');
    });
  });
});

test.describe('Authentication - Logout Flow', () => {
  test('user can logout successfully', async ({ page, request }) => {
    console.log('Testing: Logout flow');

    // Setup authenticated user
    await setupAuthenticatedUser(page, request);

    // Should be logged in now - sidebar visible
    await expect(page.locator(UI.app.sidebar)).toBeVisible({ timeout: 10000 });

    // First, click the user menu trigger (avatar button)
    const userMenuTrigger = page.locator('.user-menu-trigger, .user-avatar').first();
    if (await userMenuTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await userMenuTrigger.click();
      await page.waitForTimeout(300); // Wait for dropdown to open
    }

    // Look for sign out button in the dropdown
    const logoutButton = page.locator('button:has-text("Sign Out"), button.user-menu-item.danger').first();

    if (await logoutButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await logoutButton.click();
    }

    // Should be logged out - check localStorage
    await page.waitForTimeout(1000);

    const isLoggedOut = await page.evaluate(() => !localStorage.getItem('decideplease_access_token'));
    expect(isLoggedOut).toBe(true);
    console.log('  Logout successful');
  });
});

test.describe('Authentication - Redirect Behavior', () => {
  test('authenticated user is redirected from / to /council', async ({ page, request }) => {
    console.log('Testing: Authenticated redirect to /council');

    await setupAuthenticatedUser(page, request);

    // Navigate to home
    await page.goto(ROUTES.home);
    await page.waitForLoadState('networkidle');

    // Wait for React's useEffect redirect to trigger
    await page.waitForURL(/\/council/, { timeout: 10000 });
    console.log('  Authenticated user redirected to /council');
  });

  test('unauthenticated user stays on landing page', async ({ page }) => {
    console.log('Testing: Unauthenticated stays on landing');

    await page.goto(ROUTES.home);
    await page.waitForLoadState('networkidle');

    // Should stay on home
    await expect(page).toHaveURL('/');
    console.log('  Unauthenticated user stays on landing');
  });

  test('after login, user is on /council', async ({ page, request }) => {
    console.log('Testing: Post-login redirect');

    const testEmail = generateTestEmail();
    const testPassword = generateTestPassword();

    await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
      data: { email: testEmail, password: testPassword },
    });

    await openAuthModal(page, 'signin');

    await page.fill(UI.auth.emailInput, testEmail);
    await page.fill(UI.auth.passwordInput, testPassword);
    await page.click(UI.auth.submitButton);

    // Should be on /council after login
    await expect(page.locator(UI.app.sidebar)).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/council/);
    console.log('  User on /council after login');
  });
});

test.describe('Authentication - Password Reset Flow', () => {
  test('forgot password form is accessible', async ({ page }) => {
    console.log('Testing: Forgot password form accessibility');

    await openAuthModal(page, 'signin');

    // Look for forgot password link
    const forgotLink = page.locator(UI.auth.forgotPasswordLink);

    if (await forgotLink.isVisible({ timeout: 5000 })) {
      await forgotLink.click();

      // Should show email input for password reset
      await expect(page.locator(UI.auth.emailInput)).toBeVisible({ timeout: 5000 });
      console.log('  Forgot password form accessible');
    } else {
      console.log('  Forgot password link not found');
    }
  });

  test('password reset request with valid email', async ({ page, request }) => {
    console.log('Testing: Password reset request');

    const testEmail = generateTestEmail();
    const testPassword = generateTestPassword();

    // Create a user first
    await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
      data: { email: testEmail, password: testPassword },
    });

    await openAuthModal(page, 'signin');

    const forgotLink = page.locator(UI.auth.forgotPasswordLink);

    if (await forgotLink.isVisible({ timeout: 3000 })) {
      await forgotLink.click();

      await page.fill(UI.auth.emailInput, testEmail);
      await page.click(UI.auth.submitButton);

      // Should show success message
      await expect(page.locator(UI.auth.successMessage)).toBeVisible({ timeout: 5000 });
      console.log('  Password reset email sent');
    } else {
      console.log('  Forgot password link not visible');
    }
  });

  test('password reset request with non-existent email', async ({ page }) => {
    console.log('Testing: Password reset with non-existent email');

    await openAuthModal(page, 'signin');

    const forgotLink = page.locator(UI.auth.forgotPasswordLink);

    if (await forgotLink.isVisible({ timeout: 3000 })) {
      await forgotLink.click();

      await page.fill(UI.auth.emailInput, `nonexistent_${Date.now()}@example.com`);
      await page.click(UI.auth.submitButton);

      // For security, might still show success or might show error
      // Just verify no server error
      await page.waitForTimeout(2000);
      const hasServerError = await page.locator('text="500", text="server error"').first().isVisible().catch(() => false);
      expect(hasServerError).toBe(false);
      console.log('  Non-existent email handled gracefully');
    } else {
      console.log('  Forgot password link not visible');
    }
  });
});
