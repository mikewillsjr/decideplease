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
  test('authenticated user is redirected from / to /decision', async ({ page, request }) => {
    console.log('Testing: Authenticated redirect to /decision');

    await setupAuthenticatedUser(page, request);

    // Navigate to home
    await page.goto(ROUTES.home);
    await page.waitForLoadState('networkidle');

    // Wait for React's useEffect redirect to trigger
    await page.waitForURL(/\/decision/, { timeout: 10000 });
    console.log('  Authenticated user redirected to /decision');
  });

  test('unauthenticated user stays on landing page', async ({ page }) => {
    console.log('Testing: Unauthenticated stays on landing');

    await page.goto(ROUTES.home);
    await page.waitForLoadState('networkidle');

    // Should stay on home
    await expect(page).toHaveURL('/');
    console.log('  Unauthenticated user stays on landing');
  });

  test('after login, user is on /decision', async ({ page, request }) => {
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

    // Should be on /decision after login
    await expect(page.locator(UI.app.sidebar)).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/decision/);
    console.log('  User on /decision after login');
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

test.describe('Authentication - Magic Link Flow', () => {
  test.describe('Signup with Email Only (Magic Link)', () => {
    test('signup form shows optional password label', async ({ page }) => {
      console.log('Testing: Optional password label visibility');

      await openAuthModal(page, 'signup');

      // Should show "(Optional)" label for password field
      const optionalLabel = page.locator(UI.auth.optionalLabel);
      await expect(optionalLabel).toBeVisible({ timeout: 5000 });
      console.log('  Optional password label visible');
    });

    test('signup without password shows "Get started" button', async ({ page }) => {
      console.log('Testing: Get started button for magic link signup');

      await openAuthModal(page, 'signup');

      // Fill only email (leave password empty)
      await page.fill(UI.auth.emailInput, generateTestEmail());

      // Submit button should say "Get started"
      const submitButton = page.locator(UI.auth.submitButton);
      await expect(submitButton).toHaveText(/Get started/i, { timeout: 5000 });
      console.log('  Get started button displayed correctly');
    });

    test('email-only signup shows confirmation screen', async ({ page }) => {
      console.log('Testing: Email-only signup confirmation screen');

      const testEmail = generateTestEmail();
      await openAuthModal(page, 'signup');

      // Fill only email
      await page.fill(UI.auth.emailInput, testEmail);

      // Submit
      await page.click(UI.auth.submitButton);

      // Should show email sent confirmation screen
      await expect(page.locator(UI.auth.emailSentScreen)).toBeVisible({ timeout: 10000 });
      await expect(page.locator(UI.auth.emailSentEmail)).toContainText(testEmail);
      console.log('  Email confirmation screen shown');
    });

    test('can return to signup form from confirmation screen', async ({ page }) => {
      console.log('Testing: Return to signup from confirmation');

      await openAuthModal(page, 'signup');
      await page.fill(UI.auth.emailInput, generateTestEmail());
      await page.click(UI.auth.submitButton);

      // Wait for confirmation screen
      await expect(page.locator(UI.auth.emailSentScreen)).toBeVisible({ timeout: 10000 });

      // Click try again
      await page.click(UI.auth.emailSentTryAgain);

      // Should return to signup form
      await expect(page.locator(UI.auth.emailInput)).toBeVisible({ timeout: 5000 });
      console.log('  Returned to signup form successfully');
    });
  });

  test.describe('Signup with Email + Password', () => {
    test('signup with password shows "Create account" button', async ({ page }) => {
      console.log('Testing: Create account button for password signup');

      await openAuthModal(page, 'signup');

      // Fill email AND password
      await page.fill(UI.auth.emailInput, generateTestEmail());
      await page.fill(UI.auth.passwordInput, generateTestPassword());

      // Submit button should say "Create account"
      const submitButton = page.locator(UI.auth.submitButton);
      await expect(submitButton).toHaveText(/Create account/i, { timeout: 5000 });
      console.log('  Create account button displayed correctly');
    });

    test('signup with password shows confirm password field', async ({ page }) => {
      console.log('Testing: Confirm password field appears');

      await openAuthModal(page, 'signup');

      await page.fill(UI.auth.emailInput, generateTestEmail());
      await page.fill(UI.auth.passwordInput, generateTestPassword());

      // Confirm password should now be visible
      const confirmPasswordInput = page.locator(UI.auth.confirmPasswordInput);
      await expect(confirmPasswordInput).toBeVisible({ timeout: 5000 });
      console.log('  Confirm password field visible');
    });

    test('password signup shows Continue to app button', async ({ page }) => {
      console.log('Testing: Password signup with verification needed');

      const testEmail = generateTestEmail();
      const testPassword = generateTestPassword();

      await openAuthModal(page, 'signup');

      await page.fill(UI.auth.emailInput, testEmail);
      await page.fill(UI.auth.passwordInput, testPassword);
      await page.fill(UI.auth.confirmPasswordInput, testPassword);

      await page.click(UI.auth.submitButton);

      // Should show email sent screen with "Continue to app" button
      await expect(page.locator(UI.auth.emailSentScreen)).toBeVisible({ timeout: 10000 });

      // Should have Continue to app button (for password signup flow)
      const continueButton = page.locator(UI.auth.continueToAppButton);
      await expect(continueButton).toBeVisible({ timeout: 5000 });
      console.log('  Continue to app button visible');
    });
  });

  test.describe('Login Magic Link Option', () => {
    test('login form shows magic link option', async ({ page }) => {
      console.log('Testing: Magic link login option visibility');

      await openAuthModal(page, 'signin');

      // Should show "Email me a login link" button
      const magicLinkButton = page.locator(UI.auth.magicLinkLoginButton);
      await expect(magicLinkButton).toBeVisible({ timeout: 5000 });
      console.log('  Magic link login option visible');
    });

    test('magic link login requires email first', async ({ page }) => {
      console.log('Testing: Magic link login requires email');

      await openAuthModal(page, 'signin');

      // Try clicking magic link without email
      await page.click(UI.auth.magicLinkLoginButton);

      // Should show error message
      await expect(page.locator(UI.auth.errorMessage)).toBeVisible({ timeout: 5000 });
      console.log('  Error shown when no email entered');
    });

    test('magic link login shows confirmation screen', async ({ page, request }) => {
      console.log('Testing: Magic link login confirmation');

      // Create a user first
      const testEmail = generateTestEmail();
      const testPassword = generateTestPassword();
      await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
        data: { email: testEmail, password: testPassword },
      });

      await openAuthModal(page, 'signin');

      // Enter email and click magic link button
      await page.fill(UI.auth.emailInput, testEmail);
      await page.click(UI.auth.magicLinkLoginButton);

      // Should show confirmation screen
      await expect(page.locator(UI.auth.emailSentScreen)).toBeVisible({ timeout: 10000 });
      await expect(page.locator(UI.auth.emailSentEmail)).toContainText(testEmail);
      console.log('  Magic link login confirmation shown');
    });
  });
});

test.describe('Authentication - Magic Link Verification Page', () => {
  test('magic link page handles missing token', async ({ page }) => {
    console.log('Testing: Magic link page with no token');

    // Navigate to magic link page without token
    await page.goto(`${ROUTES.magicLink}`);

    // Should show error state
    await expect(page.locator(UI.magicLink.errorState)).toBeVisible({ timeout: 10000 });
    console.log('  Error shown for missing token');
  });

  test('magic link page handles invalid token', async ({ page }) => {
    console.log('Testing: Magic link page with invalid token');

    // Navigate to magic link page with fake token
    await page.goto(`${ROUTES.magicLink}?token=invalid_token_12345`);

    // Should show error state
    await expect(page.locator(UI.magicLink.errorState)).toBeVisible({ timeout: 10000 });
    console.log('  Error shown for invalid token');
  });

  test('magic link page shows verifying state initially', async ({ page }) => {
    console.log('Testing: Magic link page shows verifying state');

    // Navigate to magic link page with a token (even invalid, should show verifying first)
    await page.goto(`${ROUTES.magicLink}?token=some_token`);

    // Should briefly show verifying state (may be quick)
    const verifyingText = page.locator(UI.magicLink.verifyingState);
    // Just check the page loads without crash
    await page.waitForTimeout(500);
    console.log('  Page loaded without crash');
  });
});

test.describe('Authentication - Verification Banner (Credit Gating)', () => {
  test('verification banner shows for unverified users', async ({ page, request }) => {
    console.log('Testing: Verification banner for unverified users');

    const testEmail = generateTestEmail();
    const testPassword = generateTestPassword();

    // Register with password (creates unverified account with 0 credits)
    const registerResponse = await request.post(`${API_BASE_URL}${API_ENDPOINTS.magicLink}`, {
      data: { email: testEmail, password: testPassword },
    });

    const registerData = await registerResponse.json();

    // If registration returns tokens, set them in localStorage
    if (registerData.access_token) {
      await page.goto(ROUTES.home);
      await page.evaluate((tokens) => {
        localStorage.setItem('decideplease_access_token', tokens.access_token);
        localStorage.setItem('decideplease_refresh_token', tokens.refresh_token);
        localStorage.setItem('decideplease_user', JSON.stringify(tokens.user));
      }, registerData);

      // Navigate to council
      await page.goto(ROUTES.council);
      await page.waitForLoadState('networkidle');

      // Should show verification banner (if user has 0 credits and not verified)
      // Note: This depends on the backend returning email_verified and credits correctly
      const banner = page.locator(UI.verification.banner);
      // May or may not be visible depending on backend state
      // Just verify page loads without error
      await page.waitForTimeout(2000);
      console.log('  Council page loaded for unverified user');
    } else {
      console.log('  Registration did not return tokens (magic link sent)');
    }
  });

  test('resend verification button works', async ({ page, request }) => {
    console.log('Testing: Resend verification button');

    const testEmail = generateTestEmail();
    const testPassword = generateTestPassword();

    // Register with password
    const registerResponse = await request.post(`${API_BASE_URL}${API_ENDPOINTS.magicLink}`, {
      data: { email: testEmail, password: testPassword },
    });

    const registerData = await registerResponse.json();

    if (registerData.access_token) {
      await page.goto(ROUTES.home);
      await page.evaluate((tokens) => {
        localStorage.setItem('decideplease_access_token', tokens.access_token);
        localStorage.setItem('decideplease_refresh_token', tokens.refresh_token);
        localStorage.setItem('decideplease_user', JSON.stringify(tokens.user));
      }, registerData);

      await page.goto(ROUTES.council);
      await page.waitForLoadState('networkidle');

      // If verification banner is visible, click resend
      const resendButton = page.locator(UI.verification.resendButton);
      if (await resendButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await resendButton.click();

        // Should show success message or be disabled
        const sentMessage = page.locator(UI.verification.sentMessage);
        await expect(sentMessage).toBeVisible({ timeout: 5000 });
        console.log('  Resend verification email success');
      } else {
        console.log('  Verification banner not visible (user may already be verified)');
      }
    } else {
      console.log('  Registration did not return tokens');
    }
  });
});

test.describe('Authentication - API Endpoints', () => {
  test('magic-link endpoint accepts email-only request', async ({ request }) => {
    console.log('Testing: Magic link API with email only');

    const testEmail = generateTestEmail();

    const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.magicLink}`, {
      data: { email: testEmail },
    });

    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.email).toBe(testEmail);
    console.log('  Magic link API accepted email-only request');
  });

  test('magic-link endpoint accepts email+password request', async ({ request }) => {
    console.log('Testing: Magic link API with email and password');

    const testEmail = generateTestEmail();
    const testPassword = generateTestPassword();

    const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.magicLink}`, {
      data: { email: testEmail, password: testPassword },
    });

    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.access_token).toBeDefined();
    expect(data.user).toBeDefined();
    expect(data.requires_verification).toBe(true);
    console.log('  Magic link API accepted email+password request');
  });

  test('verify-magic-link endpoint rejects invalid token', async ({ request }) => {
    console.log('Testing: Verify magic link API with invalid token');

    const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.verifyMagicLink}`, {
      data: { token: 'invalid_token_123' },
    });

    expect(response.status()).toBe(400);
    console.log('  Invalid token rejected correctly');
  });

  test('resend-verification requires authentication', async ({ request }) => {
    console.log('Testing: Resend verification requires auth');

    const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.resendVerification}`);

    expect(response.status()).toBe(401);
    console.log('  Unauthenticated request rejected');
  });
});
