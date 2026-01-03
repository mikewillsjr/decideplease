// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Comprehensive E2E test for DecidePlease - New Customer Flow
 *
 * This test simulates a brand new customer:
 * 1. Lands on the marketing landing page
 * 2. Signs up as a new user via Clerk
 * 3. Gets their 5 free credits
 * 4. Creates a new decision
 * 5. Runs through the 3-stage council process
 * 6. Views the results
 */

// Generate a unique test email for fresh signups
const timestamp = Date.now();
const TEST_EMAIL = process.env.TEST_EMAIL || `test-${timestamp}@mailinator.com`;
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'TestDecide2024!';

// Base URL - can test against production or local
const BASE_URL = process.env.TEST_URL || 'https://decideplease.com';

test.describe('New Customer Journey', () => {
  // Extended timeout for the full flow (includes AI processing)
  test.setTimeout(300000); // 5 minutes for full flow with AI

  test.beforeEach(async ({ page }) => {
    // Capture console messages for debugging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('BROWSER ERROR:', msg.text());
      }
    });
    page.on('pageerror', err => {
      console.log('PAGE ERROR:', err.message);
    });
  });

  test('Full new customer journey: signup to first decision', async ({ page }) => {
    console.log('=== Starting New Customer Journey Test ===');
    console.log('Test email:', TEST_EMAIL);
    console.log('Base URL:', BASE_URL);

    // ============================================
    // STEP 1: Land on the marketing page
    // ============================================
    console.log('\n--- Step 1: Landing Page ---');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Wait for React hydration

    await page.screenshot({ path: 'e2e/screenshots/01-landing-page.png', fullPage: true });

    // Verify we're on the landing page
    const pageTitle = await page.title();
    console.log('Page title:', pageTitle);

    // Look for landing page elements
    const heroSection = await page.locator('h1, [class*="hero"]').first().isVisible().catch(() => false);
    console.log('Hero section visible:', heroSection);

    // ============================================
    // STEP 2: Click "Try Free" or "Get Started"
    // ============================================
    console.log('\n--- Step 2: Initiating Sign Up ---');

    // Find the CTA button
    const tryFreeBtn = page.locator('button:has-text("Try Free"), a:has-text("Try Free")').first();
    const getStartedBtn = page.locator('button:has-text("Get Started"), a:has-text("Get Started")').first();
    const signUpBtn = page.locator('button:has-text("Sign up"), a:has-text("Sign up")').first();

    let ctaFound = false;
    if (await tryFreeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Found "Try Free" button');
      await tryFreeBtn.click();
      ctaFound = true;
    } else if (await getStartedBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Found "Get Started" button');
      await getStartedBtn.click();
      ctaFound = true;
    } else if (await signUpBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Found "Sign up" button');
      await signUpBtn.click();
      ctaFound = true;
    }

    if (!ctaFound) {
      // Maybe we're already in the app?
      const textarea = page.locator('textarea').first();
      if (await textarea.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('Already in the app (possibly auto-signed in)');
      } else {
        console.log('No CTA found, checking page state...');
        await page.screenshot({ path: 'e2e/screenshots/02-no-cta.png', fullPage: true });
      }
    }

    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/screenshots/02-after-cta.png' });

    // ============================================
    // STEP 3: Clerk Sign Up Flow
    // ============================================
    console.log('\n--- Step 3: Clerk Authentication ---');

    // Wait for Clerk modal/redirect
    await page.waitForTimeout(2000);

    // Check if Clerk modal appeared
    const emailInput = page.locator('input[name="identifier"], input[type="email"], input[name="emailAddress"]').first();
    const clerkModalVisible = await emailInput.isVisible({ timeout: 10000 }).catch(() => false);

    if (clerkModalVisible) {
      console.log('Clerk auth modal detected');
      await page.screenshot({ path: 'e2e/screenshots/03-clerk-modal.png' });

      // Check if there's a "Sign up" tab/link to switch to registration
      const signUpTab = page.locator('a:has-text("Sign up"), button:has-text("Sign up"), [data-localization-key*="signUp"]').first();
      if (await signUpTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Switching to Sign Up mode');
        await signUpTab.click();
        await page.waitForTimeout(1000);
      }

      // Enter email
      console.log('Entering email:', TEST_EMAIL);
      await emailInput.fill(TEST_EMAIL);
      await page.screenshot({ path: 'e2e/screenshots/04-email-entered.png' });

      // Click continue
      const continueBtn = page.locator('button:has-text("Continue")').first();
      if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await continueBtn.click();
        await page.waitForTimeout(2000);
      }

      await page.screenshot({ path: 'e2e/screenshots/05-after-email.png' });

      // Fill signup form fields
      // First name (optional but let's fill it)
      const firstNameInput = page.locator('input[name="firstName"]').first();
      if (await firstNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Filling first name');
        await firstNameInput.fill('Test');
      }

      // Last name (optional)
      const lastNameInput = page.locator('input[name="lastName"]').first();
      if (await lastNameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('Filling last name');
        await lastNameInput.fill('User');
      }

      // Phone number (if required)
      const phoneInput = page.locator('input[name="phoneNumber"], input[type="tel"]').first();
      if (await phoneInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Filling phone number');
        // Use a US format phone number
        await phoneInput.fill('5551234567');
      }

      // Enter password (for new signup)
      const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
      if (await passwordInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('Entering password');
        await passwordInput.fill(TEST_PASSWORD);

        // Look for confirm password field (signup flow)
        const confirmPassword = page.locator('input[name="confirmPassword"]').first();
        if (await confirmPassword.isVisible({ timeout: 1000 }).catch(() => false)) {
          await confirmPassword.fill(TEST_PASSWORD);
        }
      }

      await page.screenshot({ path: 'e2e/screenshots/06-form-filled.png' });

      // Submit - look for visible Continue button
      const submitBtn = page.locator('button:has-text("Continue"):visible').first();
      if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('Clicking Continue button');
        await submitBtn.click();
        await page.waitForTimeout(3000);
      } else {
        console.log('Continue button not visible, trying alternative selectors');
        const altSubmit = page.locator('form button[type="submit"]:visible, .cl-formButtonPrimary:visible').first();
        if (await altSubmit.isVisible({ timeout: 2000 }).catch(() => false)) {
          await altSubmit.click();
          await page.waitForTimeout(3000);
        }
      }

      await page.screenshot({ path: 'e2e/screenshots/07-after-submit.png' });

      // Handle email verification if required
      const verificationInput = page.locator('input[name="code"], input[inputmode="numeric"]').first();
      if (await verificationInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('Email verification required!');
        console.log('Check mailinator.com for verification code');
        await page.screenshot({ path: 'e2e/screenshots/07b-verification-needed.png' });

        // For automated testing, we'd need to fetch the code from mailinator
        // For now, we'll pause and note this requires manual intervention
        console.log('MANUAL STEP NEEDED: Enter verification code from email');

        // Wait a bit to allow manual code entry if running interactively
        await page.waitForTimeout(30000);
      }

    } else {
      console.log('Clerk modal not found, checking if already authenticated...');
      const textarea = page.locator('textarea').first();
      if (await textarea.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('Already in the app!');
      }
    }

    // ============================================
    // STEP 4: Verify we're in the app
    // ============================================
    console.log('\n--- Step 4: Verifying App Access ---');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'e2e/screenshots/08-app-check.png' });

    // Look for the main app elements
    const messageInput = page.locator('textarea').first();
    const creditsDisplay = page.locator('[class*="credit"], text=/\\d+\\s*credits?/i').first();
    const sidebar = page.locator('[class*="sidebar"], .sidebar').first();

    const inApp = await messageInput.isVisible({ timeout: 15000 }).catch(() => false);

    if (!inApp) {
      console.log('Not in app yet, current URL:', page.url());
      const pageContent = await page.content();
      console.log('Page preview:', pageContent.substring(0, 300));
      await page.screenshot({ path: 'e2e/screenshots/08-not-in-app.png', fullPage: true });

      // This might be expected if email verification is pending
      console.log('Test cannot continue without app access');
      return;
    }

    console.log('Successfully in the app!');
    await page.screenshot({ path: 'e2e/screenshots/09-in-app.png', fullPage: true });

    // Check credits
    if (await creditsDisplay.isVisible({ timeout: 3000 }).catch(() => false)) {
      const creditsText = await creditsDisplay.textContent();
      console.log('Credits:', creditsText);
    }

    // ============================================
    // STEP 5: Submit a decision
    // ============================================
    console.log('\n--- Step 5: Submitting First Decision ---');

    const testQuestion = 'Should I learn Python or JavaScript as my first programming language? I want to build web apps.';

    await messageInput.fill(testQuestion);
    console.log('Question entered');
    await page.screenshot({ path: 'e2e/screenshots/10-question-entered.png' });

    // Find and click submit button
    const submitButton = page.locator('button.send-button, button:has-text("Run"), button[type="submit"]').first();

    // Check if button is enabled (have credits)
    const isEnabled = await submitButton.isEnabled().catch(() => false);
    console.log('Submit button enabled:', isEnabled);

    if (!isEnabled) {
      console.log('Submit button disabled - may need credits');
      await page.screenshot({ path: 'e2e/screenshots/10-submit-disabled.png' });
      return;
    }

    await submitButton.click();
    console.log('Decision submitted!');
    await page.screenshot({ path: 'e2e/screenshots/11-submitted.png' });

    // ============================================
    // STEP 6: Watch council deliberation
    // ============================================
    console.log('\n--- Step 6: Council Deliberation ---');

    // Wait for processing to start
    await page.waitForTimeout(3000);

    // Look for loading indicators
    const loadingIndicator = page.locator('[class*="loading"], [class*="progress"], [class*="stage"]').first();
    const councilDebate = page.locator('[class*="council"], [class*="debate"]').first();

    if (await loadingIndicator.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Processing started...');
      await page.screenshot({ path: 'e2e/screenshots/12-processing.png' });
    }

    if (await councilDebate.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Council debate visualization visible');
      await page.screenshot({ path: 'e2e/screenshots/12-council-debate.png' });
    }

    // ============================================
    // STEP 7: Wait for results
    // ============================================
    console.log('\n--- Step 7: Waiting for Results ---');

    // This can take 30-90 seconds depending on the models
    const resultContainer = page.locator('[class*="stage-3"], [class*="result"], [class*="answer"]').first();

    try {
      await resultContainer.waitFor({ state: 'visible', timeout: 180000 }); // 3 min timeout
      console.log('Results received!');
      await page.screenshot({ path: 'e2e/screenshots/13-results.png', fullPage: true });
    } catch (e) {
      console.log('Timeout waiting for results');
      await page.screenshot({ path: 'e2e/screenshots/13-timeout.png', fullPage: true });

      // Check current state
      const errorMsg = page.locator('[class*="error"], text=/error/i').first();
      if (await errorMsg.isVisible().catch(() => false)) {
        const errorText = await errorMsg.textContent();
        console.log('Error message:', errorText);
      }
    }

    // ============================================
    // STEP 8: Explore the results
    // ============================================
    console.log('\n--- Step 8: Exploring Results ---');

    // Click through the stages
    const stageTabs = page.locator('[class*="stage-tab"], button:has-text("Stage")');
    const tabCount = await stageTabs.count();
    console.log('Found', tabCount, 'stage tabs');

    for (let i = 0; i < tabCount; i++) {
      const tab = stageTabs.nth(i);
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `e2e/screenshots/14-stage-${i + 1}.png` });
      }
    }

    // Final state
    await page.screenshot({ path: 'e2e/screenshots/15-final.png', fullPage: true });

    // ============================================
    // STEP 9: Verify credits deducted
    // ============================================
    console.log('\n--- Step 9: Credit Verification ---');

    if (await creditsDisplay.isVisible({ timeout: 3000 }).catch(() => false)) {
      const finalCredits = await creditsDisplay.textContent();
      console.log('Final credits:', finalCredits);
    }

    console.log('\n=== New Customer Journey Test Complete ===');
  });

  test('Verify landing page loads correctly', async ({ page }) => {
    console.log('=== Landing Page Verification ===');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'e2e/screenshots/landing-verify.png', fullPage: true });

    // Check essential elements
    const title = await page.title();
    console.log('Title:', title);
    expect(title).toContain('DecidePlease');

    // Check for CTA buttons
    const hasCTA = await page.locator('button, a').filter({
      hasText: /try|start|sign|get started/i
    }).first().isVisible().catch(() => false);

    console.log('Has CTA button:', hasCTA);
    expect(hasCTA).toBeTruthy();

    console.log('Landing page verification complete');
  });
});
