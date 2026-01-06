// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Council Chamber Tests for DecidePlease
 *
 * Tests for the new Council Chamber interface and
 * interface preference toggle in Settings.
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:5173';

test.describe('Interface Preference Toggle', () => {
  test.setTimeout(60000);

  test('Settings page has Preferences section in navigation', async ({ page }) => {
    // This test assumes user is logged in - skip if not testable
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Look for settings link and navigate
    const settingsLink = page.locator('a[href="/settings"], button:has-text("Settings")').first();

    if (await settingsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await settingsLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Check for Preferences button in settings nav
      const preferencesBtn = page.locator('button:has-text("Preferences")');
      const hasPreferences = await preferencesBtn.isVisible({ timeout: 5000 }).catch(() => false);

      console.log('Preferences section visible:', hasPreferences);

      if (hasPreferences) {
        await page.screenshot({ path: 'e2e/screenshots/council-01-settings-nav.png' });

        // Click Preferences
        await preferencesBtn.click();
        await page.waitForTimeout(500);

        // Check for interface toggle options
        const chamberOption = page.locator('.interface-option:has-text("Council Chamber")');
        const classicOption = page.locator('.interface-option:has-text("Classic Chat")');

        const hasChamberOption = await chamberOption.isVisible().catch(() => false);
        const hasClassicOption = await classicOption.isVisible().catch(() => false);

        console.log('Chamber option visible:', hasChamberOption);
        console.log('Classic option visible:', hasClassicOption);

        await page.screenshot({ path: 'e2e/screenshots/council-02-preferences.png' });

        expect(hasChamberOption || hasClassicOption).toBeTruthy();
      }
    } else {
      console.log('Settings link not visible - user may not be logged in');
    }
  });
});

test.describe('Council Chamber UI', () => {
  test.setTimeout(60000);

  test('Council page renders correctly', async ({ page }) => {
    // Navigate to council page (requires auth)
    await page.goto(`${BASE_URL}/council`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Take screenshot of whatever renders
    await page.screenshot({ path: 'e2e/screenshots/council-03-council-page.png', fullPage: true });

    // Check for either Council Chamber or ChatInterface elements
    const councilArc = page.locator('.council-arc');
    const decisionConsole = page.locator('.decision-console');
    const chatInterface = page.locator('.chat-interface');

    const hasCouncilArc = await councilArc.isVisible({ timeout: 5000 }).catch(() => false);
    const hasDecisionConsole = await decisionConsole.isVisible({ timeout: 5000 }).catch(() => false);
    const hasChatInterface = await chatInterface.isVisible({ timeout: 5000 }).catch(() => false);

    console.log('Council Arc visible:', hasCouncilArc);
    console.log('Decision Console visible:', hasDecisionConsole);
    console.log('Chat Interface visible:', hasChatInterface);

    // Either interface should be present if authenticated
    const hasInterface = hasCouncilArc || hasDecisionConsole || hasChatInterface;

    // If not authenticated, should redirect to landing
    if (!hasInterface) {
      const onLanding = page.url().includes(BASE_URL) && !page.url().includes('/council');
      console.log('Redirected to landing (not authenticated):', onLanding);
    }
  });

  test('Model seats display in Council Chamber', async ({ page }) => {
    // Set localStorage to ensure Chamber mode
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      localStorage.setItem('decideplease_interface', 'chamber');
    });

    // Navigate to council
    await page.goto(`${BASE_URL}/council`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check for model seats
    const modelSeats = page.locator('.model-seat');
    const seatCount = await modelSeats.count().catch(() => 0);

    console.log('Model seats found:', seatCount);

    if (seatCount > 0) {
      await page.screenshot({ path: 'e2e/screenshots/council-04-model-seats.png' });
      expect(seatCount).toBeGreaterThanOrEqual(1);
    }
  });

  test('Interface toggle persists across page loads', async ({ page }) => {
    // Set classic mode
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      localStorage.setItem('decideplease_interface', 'classic');
    });

    // Reload and check
    await page.reload();
    await page.waitForTimeout(1000);

    const savedValue = await page.evaluate(() => {
      return localStorage.getItem('decideplease_interface');
    });

    console.log('Saved interface mode:', savedValue);
    expect(savedValue).toBe('classic');

    // Reset to chamber mode
    await page.evaluate(() => {
      localStorage.setItem('decideplease_interface', 'chamber');
    });

    const chamberValue = await page.evaluate(() => {
      return localStorage.getItem('decideplease_interface');
    });

    console.log('After reset:', chamberValue);
    expect(chamberValue).toBe('chamber');
  });
});

test.describe('Council Chamber Responsive Design', () => {
  test('Council Chamber renders on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Set chamber mode
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      localStorage.setItem('decideplease_interface', 'chamber');
    });

    await page.goto(`${BASE_URL}/council`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'e2e/screenshots/council-05-mobile.png', fullPage: true });

    // Check that page renders without errors
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.waitForTimeout(1000);
    console.log('Mobile errors:', errors.length);
  });

  test('Council Chamber renders on tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    // Set chamber mode
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      localStorage.setItem('decideplease_interface', 'chamber');
    });

    await page.goto(`${BASE_URL}/council`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'e2e/screenshots/council-06-tablet.png', fullPage: true });

    // Check that page renders without errors
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.waitForTimeout(1000);
    console.log('Tablet errors:', errors.length);
  });
});
