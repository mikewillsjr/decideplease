// @ts-check
import { test, expect } from '@playwright/test';

// Test credentials - using a test account
const TEST_EMAIL = 'test-decideplease@mailinator.com';
const TEST_PASSWORD = 'TestDecide2024!';

test.describe('DecidePlease Decision Flow', () => {
  test.setTimeout(120000); // 2 min timeout for full flow

  test('should sign in and run a decision', async ({ page }) => {
    // Capture console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.log('BROWSER ERROR:', msg.text());
      }
    });
    page.on('pageerror', err => {
      console.log('PAGE ERROR:', err.message);
      consoleErrors.push(err.message);
    });

    // Go to the app
    await page.goto('http://localhost:5173');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Give React time to hydrate

    console.log('Page loaded, looking for auth elements...');
    console.log('Console errors so far:', consoleErrors);

    // Take screenshot of initial state
    await page.screenshot({ path: 'e2e/screenshots/01-landing.png' });

    // Check if we're on landing page (not signed in) or app (signed in)
    const tryFreeButton = page.locator('button:has-text("Try Free")');
    const loginButton = page.locator('button:has-text("Log in")');

    if (await tryFreeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('On landing page, need to sign in...');

      // Click Log in to open auth modal
      await loginButton.click();
      await page.waitForTimeout(1000);

      await page.screenshot({ path: 'e2e/screenshots/02-auth-modal.png' });

      // Clerk auth modal should appear - look for email input
      const emailInput = page.locator('input[name="identifier"]');
      await emailInput.waitFor({ state: 'visible', timeout: 10000 });

      // Enter email
      await emailInput.fill(TEST_EMAIL);
      await page.screenshot({ path: 'e2e/screenshots/03-email-entered.png' });

      // Click continue
      const continueButton = page.locator('button:has-text("Continue")');
      await continueButton.click();

      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'e2e/screenshots/04-after-continue.png' });

      // Enter password
      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
      await passwordInput.fill(TEST_PASSWORD);

      await page.screenshot({ path: 'e2e/screenshots/05-password-entered.png' });

      // Click sign in
      const signInButton = page.locator('button:has-text("Continue")');
      await signInButton.click();

      // Wait for redirect to app
      await page.waitForTimeout(5000);
      await page.screenshot({ path: 'e2e/screenshots/06-after-signin.png' });
    }

    // Now we should be in the app
    console.log('Checking if in app...');

    // Look for the decisions sidebar or credits display
    const creditsDisplay = page.locator('.credits-display');
    const sidebar = page.locator('.sidebar');

    // Wait for app to be ready
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/screenshots/07-app-loaded.png' });

    // Check current URL and page state
    console.log('Current URL:', page.url());

    // Look for the input form
    const messageInput = page.locator('textarea.message-input');
    const runButton = page.locator('button.send-button');

    if (await messageInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Found message input, entering a question...');

      // Enter a test question
      await messageInput.fill('Should I use TypeScript or JavaScript for a new React project?');

      await page.screenshot({ path: 'e2e/screenshots/08-question-entered.png' });

      // Check if Run Decision button is enabled
      const isDisabled = await runButton.isDisabled();
      console.log('Run Decision button disabled:', isDisabled);

      if (!isDisabled) {
        console.log('Clicking Run Decision...');
        await runButton.click();

        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'e2e/screenshots/09-after-click.png' });

        // Check for loading indicator or council debate
        const councilDebate = page.locator('.council-debate');
        const stageLoading = page.locator('.stage-loading');

        if (await councilDebate.isVisible({ timeout: 5000 }).catch(() => false)) {
          console.log('Council debate visualization is showing!');
          await page.screenshot({ path: 'e2e/screenshots/10-council-debate.png' });
        } else if (await stageLoading.isVisible({ timeout: 5000 }).catch(() => false)) {
          console.log('Stage loading indicator is showing');
          await page.screenshot({ path: 'e2e/screenshots/10-stage-loading.png' });
        } else {
          console.log('No loading indicator visible');
          await page.screenshot({ path: 'e2e/screenshots/10-no-loading.png' });
        }

        // Wait for response (up to 60 seconds)
        console.log('Waiting for response...');
        const stage3 = page.locator('.stage-3');
        try {
          await stage3.waitFor({ state: 'visible', timeout: 60000 });
          console.log('Got Stage 3 response!');
          await page.screenshot({ path: 'e2e/screenshots/11-response.png' });
        } catch (e) {
          console.log('Timeout waiting for Stage 3');
          await page.screenshot({ path: 'e2e/screenshots/11-timeout.png' });
        }
      } else {
        console.log('Run Decision button is disabled');
      }
    } else {
      console.log('Message input not found');

      // Log what we can see
      const bodyText = await page.locator('body').innerText();
      console.log('Page content preview:', bodyText.substring(0, 500));
    }

    // Final screenshot
    await page.screenshot({ path: 'e2e/screenshots/final.png', fullPage: true });
  });
});
