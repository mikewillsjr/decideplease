/**
 * Console Error Detection Tests
 * Monitor browser console during all tests for JavaScript errors
 */

import { test, expect } from '@playwright/test';
import {
  ROUTES,
  collectConsoleMessages,
  filterExpectedErrors,
  UI,
  openAuthModal,
  setupAuthenticatedUser,
} from '../fixtures/test-helpers.js';

test.describe('Console Tests - Public Pages', () => {
  test('landing page has no JavaScript errors', async ({ page }) => {
    console.log('Checking: Landing page console errors');

    const { errors, warnings } = collectConsoleMessages(page);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for any async errors
    await page.waitForTimeout(1000);

    const filteredErrors = filterExpectedErrors(errors);

    if (filteredErrors.length > 0) {
      console.log('  Errors found:', filteredErrors);
    }
    if (warnings.length > 0) {
      console.log('  Warnings found:', warnings.length);
    }

    expect(filteredErrors).toHaveLength(0);
    console.log(`  No errors, ${warnings.length} warnings`);
  });

  test('privacy page has no JavaScript errors', async ({ page }) => {
    console.log('Checking: Privacy page console errors');

    const { errors, warnings } = collectConsoleMessages(page);

    await page.goto(ROUTES.privacy);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const filteredErrors = filterExpectedErrors(errors);

    if (filteredErrors.length > 0) {
      console.log('  Errors:', filteredErrors);
    }

    expect(filteredErrors).toHaveLength(0);
    console.log(`  No errors, ${warnings.length} warnings`);
  });

  test('terms page has no JavaScript errors', async ({ page }) => {
    console.log('Checking: Terms page console errors');

    const { errors, warnings } = collectConsoleMessages(page);

    await page.goto(ROUTES.terms);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const filteredErrors = filterExpectedErrors(errors);

    if (filteredErrors.length > 0) {
      console.log('  Errors:', filteredErrors);
    }

    expect(filteredErrors).toHaveLength(0);
    console.log(`  No errors, ${warnings.length} warnings`);
  });
});

test.describe('Console Tests - Auth Flow', () => {
  test('login flow has no JavaScript errors', async ({ page }) => {
    console.log('Checking: Login flow console errors');

    const { errors, warnings } = collectConsoleMessages(page);

    await openAuthModal(page, 'signin');

    // Fill form with invalid credentials (will trigger error handling)
    await page.fill(UI.auth.emailInput, 'test@example.com');
    await page.fill(UI.auth.passwordInput, 'wrongpassword');
    await page.click(UI.auth.submitButton);

    // Wait for response
    await page.waitForTimeout(2000);

    // Filter out expected network errors
    const unexpectedErrors = filterExpectedErrors(errors);

    if (unexpectedErrors.length > 0) {
      console.log('  Unexpected errors:', unexpectedErrors);
    }

    expect(unexpectedErrors).toHaveLength(0);
    console.log(`  No unexpected errors during login flow`);
  });

  test('registration flow has no JavaScript errors', async ({ page }) => {
    console.log('Checking: Registration flow console errors');

    const { errors, warnings } = collectConsoleMessages(page);

    await openAuthModal(page, 'signup');
    await page.waitForTimeout(1000);

    const filteredErrors = filterExpectedErrors(errors);

    if (filteredErrors.length > 0) {
      console.log('  Errors:', filteredErrors);
    }

    expect(filteredErrors).toHaveLength(0);
    console.log(`  No errors during registration flow`);
  });
});

test.describe('Console Tests - Authenticated Pages', () => {
  test('main app has no JavaScript errors', async ({ page, request }) => {
    console.log('Checking: Main app console errors');

    const { errors, warnings } = collectConsoleMessages(page);

    await setupAuthenticatedUser(page, request);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const filteredErrors = filterExpectedErrors(errors);

    if (filteredErrors.length > 0) {
      console.log('  Errors:', filteredErrors);
    }

    expect(filteredErrors).toHaveLength(0);
    console.log(`  No errors, ${warnings.length} warnings`);
  });

  test('settings page has no JavaScript errors', async ({ page, request }) => {
    console.log('Checking: Settings page console errors');

    const { errors, warnings } = collectConsoleMessages(page);

    await setupAuthenticatedUser(page, request);
    await page.goto(ROUTES.settings);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const filteredErrors = filterExpectedErrors(errors);

    if (filteredErrors.length > 0) {
      console.log('  Errors:', filteredErrors);
    }

    expect(filteredErrors).toHaveLength(0);
    console.log(`  No errors, ${warnings.length} warnings`);
  });

  test('message input interaction has no errors', async ({ page, request }) => {
    console.log('Checking: Message input console errors');

    const { errors, warnings } = collectConsoleMessages(page);

    await setupAuthenticatedUser(page, request);

    // Type in message input
    const messageInput = page.locator(UI.chat.messageInput);
    if (await messageInput.isVisible()) {
      await messageInput.fill('Test message for console error checking');
      await messageInput.fill(''); // Clear
    }

    await page.waitForTimeout(1000);

    const filteredErrors = filterExpectedErrors(errors);

    if (filteredErrors.length > 0) {
      console.log('  Errors:', filteredErrors);
    }

    expect(filteredErrors).toHaveLength(0);
    console.log(`  No errors during interaction`);
  });
});

test.describe('Console Tests - Navigation', () => {
  test('navigation between pages has no errors', async ({ page }) => {
    console.log('Checking: Navigation console errors');

    const { errors, warnings } = collectConsoleMessages(page);

    // Navigate through multiple pages
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.goto(ROUTES.privacy);
    await page.waitForLoadState('networkidle');

    await page.goto(ROUTES.terms);
    await page.waitForLoadState('networkidle');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(1000);

    const filteredErrors = filterExpectedErrors(errors);

    if (filteredErrors.length > 0) {
      console.log('  Errors during navigation:', filteredErrors);
    }

    expect(filteredErrors).toHaveLength(0);
    console.log(`  No errors during navigation`);
  });
});

test.describe('Console Tests - Error Boundary', () => {
  test('page handles missing route gracefully', async ({ page }) => {
    console.log('Checking: 404 route handling');

    const { errors, warnings } = collectConsoleMessages(page);

    await page.goto('/this-route-does-not-exist');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Filter out expected 404 errors
    const unexpectedErrors = errors.filter(e =>
      !e.includes('404') &&
      !e.includes('Not Found')
    );
    const filteredErrors = filterExpectedErrors(unexpectedErrors);

    if (filteredErrors.length > 0) {
      console.log('  Unexpected errors:', filteredErrors);
    }

    expect(filteredErrors).toHaveLength(0);
    console.log(`  404 handled gracefully`);
  });
});

test.describe('Console Tests - Warning Summary', () => {
  test('collect all warnings across pages', async ({ page }) => {
    console.log('Collecting: All warnings across pages');

    const allWarnings = [];

    page.on('console', msg => {
      if (msg.type() === 'warning') {
        allWarnings.push({
          page: page.url(),
          message: msg.text().substring(0, 100),
        });
      }
    });

    // Visit all pages
    const pages = ['/', ROUTES.privacy, ROUTES.terms];

    for (const route of pages) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
    }

    console.log(`  Total warnings collected: ${allWarnings.length}`);

    if (allWarnings.length > 0) {
      // Group by message type
      const warningTypes = {};
      allWarnings.forEach(w => {
        const key = w.message.substring(0, 50);
        warningTypes[key] = (warningTypes[key] || 0) + 1;
      });

      console.log('  Warning types:');
      Object.entries(warningTypes).forEach(([msg, count]) => {
        console.log(`    ${count}x: ${msg}`);
      });
    }

    // This is informational - don't fail on warnings
    console.log('  Warning summary complete');
  });
});

test.describe('Console Tests - Network Errors', () => {
  test('handles network failures gracefully', async ({ page }) => {
    console.log('Checking: Network error handling');

    const { errors, warnings } = collectConsoleMessages(page);

    // Block API requests to simulate network failure
    await page.route('**/api/**', route => route.abort('failed'));

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // We expect some network errors, but no unhandled exceptions
    const uncaughtExceptions = errors.filter(e =>
      e.includes('Uncaught') ||
      e.includes('unhandled') ||
      e.includes('TypeError')
    );

    if (uncaughtExceptions.length > 0) {
      console.log('  Uncaught exceptions:', uncaughtExceptions);
    }

    expect(uncaughtExceptions).toHaveLength(0);
    console.log('  Network failures handled gracefully');
  });
});
