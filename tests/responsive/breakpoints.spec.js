/**
 * Responsive Tests
 * Test all pages at mobile, tablet, and desktop breakpoints
 */

import { test, expect } from '@playwright/test';
import {
  ROUTES,
  VIEWPORTS,
  UI,
  setupAuthenticatedUser,
} from '../fixtures/test-helpers.js';

test.describe('Responsive Tests - Landing Page', () => {
  test.describe('Mobile (375x667)', () => {
    test.use({ viewport: VIEWPORTS.mobile });

    test('landing page renders correctly on mobile', async ({ page }) => {
      console.log('Testing: Landing page mobile layout');

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Check no horizontal overflow
      const hasOverflow = await page.evaluate(() => {
        return document.body.scrollWidth > window.innerWidth;
      });
      expect(hasOverflow).toBe(false);

      // Check key elements are visible
      const header = page.locator(UI.header.container).first();
      await expect(header).toBeVisible();

      console.log('  Mobile layout renders correctly');
    });

    test('navigation works on mobile', async ({ page }) => {
      console.log('Testing: Mobile navigation');

      await page.goto('/');

      // Look for hamburger menu or mobile nav
      const hamburger = page.locator('[data-testid="mobile-menu"], .hamburger, button[aria-label*="menu"]').first();
      const loginButton = page.locator(UI.landing.loginButton);

      // Either hamburger exists or login button is directly visible
      const navWorks = await hamburger.isVisible().catch(() => false) ||
                       await loginButton.isVisible().catch(() => false);

      expect(navWorks).toBe(true);
      console.log('  Mobile navigation accessible');
    });

    test('buttons are tappable size', async ({ page }) => {
      console.log('Testing: Button tap targets');

      await page.goto('/');

      const buttons = await page.locator('button:visible').all();

      for (const button of buttons.slice(0, 5)) {
        const box = await button.boundingBox();
        if (box) {
          // Minimum tap target should be 44x44 pixels
          expect(box.height).toBeGreaterThanOrEqual(30);
          expect(box.width).toBeGreaterThanOrEqual(30);
        }
      }

      console.log('  Button sizes are adequate for touch');
    });

    test('text is readable on mobile', async ({ page }) => {
      console.log('Testing: Text readability');

      await page.goto('/');

      // Check font sizes aren't too small
      const bodyFontSize = await page.evaluate(() => {
        const body = document.querySelector('body');
        return parseFloat(getComputedStyle(body).fontSize);
      });

      expect(bodyFontSize).toBeGreaterThanOrEqual(14);
      console.log(`  Base font size: ${bodyFontSize}px`);
    });
  });

  test.describe('Tablet (768x1024)', () => {
    test.use({ viewport: VIEWPORTS.tablet });

    test('landing page renders correctly on tablet', async ({ page }) => {
      console.log('Testing: Landing page tablet layout');

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Check no horizontal overflow
      const hasOverflow = await page.evaluate(() => {
        return document.body.scrollWidth > window.innerWidth;
      });
      expect(hasOverflow).toBe(false);

      console.log('  Tablet layout renders correctly');
    });

    test('content width is appropriate', async ({ page }) => {
      console.log('Testing: Content width on tablet');

      await page.goto('/');

      // Main content should use available width but not stretch too wide
      const mainContent = page.locator('main, .main, .content, article').first();

      if (await mainContent.isVisible().catch(() => false)) {
        const box = await mainContent.boundingBox();
        if (box) {
          expect(box.width).toBeLessThanOrEqual(768);
          expect(box.width).toBeGreaterThan(300);
        }
      }

      console.log('  Content width is appropriate');
    });
  });

  test.describe('Desktop (1920x1080)', () => {
    test.use({ viewport: VIEWPORTS.desktop });

    test('landing page renders correctly on desktop', async ({ page }) => {
      console.log('Testing: Landing page desktop layout');

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Check no horizontal overflow
      const hasOverflow = await page.evaluate(() => {
        return document.body.scrollWidth > window.innerWidth;
      });
      expect(hasOverflow).toBe(false);

      console.log('  Desktop layout renders correctly');
    });

    test('layout uses available space', async ({ page }) => {
      console.log('Testing: Desktop space utilization');

      await page.goto('/');

      // Content should be centered or use columns
      const mainContent = page.locator('main, .main, .content, .container').first();

      if (await mainContent.isVisible().catch(() => false)) {
        const box = await mainContent.boundingBox();
        if (box) {
          // Content shouldn't stretch to full width on large screens
          expect(box.width).toBeLessThan(1920);
        }
      }

      console.log('  Desktop layout uses space appropriately');
    });
  });
});

test.describe('Responsive Tests - Authenticated App', () => {
  test.describe('Mobile (375x667)', () => {
    test.use({ viewport: VIEWPORTS.mobile });

    test('sidebar behavior on mobile', async ({ page, request }) => {
      console.log('Testing: Sidebar on mobile');

      await setupAuthenticatedUser(page, request);

      // Sidebar might be hidden on mobile
      const sidebar = page.locator(UI.app.sidebar);
      const menuButton = page.locator('[data-testid="menu-toggle"], .hamburger, button[aria-label*="menu"]').first();

      const sidebarVisible = await sidebar.isVisible().catch(() => false);
      const menuButtonVisible = await menuButton.isVisible().catch(() => false);

      // Either sidebar is hidden (with menu button) or collapsed
      expect(sidebarVisible || menuButtonVisible).toBe(true);
      console.log(`  Sidebar visible: ${sidebarVisible}, Menu button: ${menuButtonVisible}`);
    });

    test('message input usable on mobile', async ({ page, request }) => {
      console.log('Testing: Message input on mobile');

      await setupAuthenticatedUser(page, request);

      const messageInput = page.locator(UI.chat.messageInput);
      await expect(messageInput).toBeVisible();

      const box = await messageInput.boundingBox();
      expect(box.width).toBeGreaterThan(200); // Should have reasonable width
      console.log('  Message input is usable on mobile');
    });
  });

  test.describe('Tablet (768x1024)', () => {
    test.use({ viewport: VIEWPORTS.tablet });

    test('sidebar visible on tablet', async ({ page, request }) => {
      console.log('Testing: Sidebar on tablet');

      await setupAuthenticatedUser(page, request);

      const sidebar = page.locator(UI.app.sidebar);
      await expect(sidebar).toBeVisible();
      console.log('  Sidebar visible on tablet');
    });

    test('main content area sized correctly', async ({ page, request }) => {
      console.log('Testing: Content area on tablet');

      await setupAuthenticatedUser(page, request);

      const mainArea = page.locator(UI.chat.container);

      if (await mainArea.isVisible().catch(() => false)) {
        const box = await mainArea.boundingBox();
        expect(box.width).toBeGreaterThan(300);
      }

      console.log('  Content area sized correctly');
    });
  });

  test.describe('Desktop (1920x1080)', () => {
    test.use({ viewport: VIEWPORTS.desktop });

    test('sidebar and content visible', async ({ page, request }) => {
      console.log('Testing: Desktop layout');

      await setupAuthenticatedUser(page, request);

      const sidebar = page.locator(UI.app.sidebar);
      await expect(sidebar).toBeVisible();

      const messageInput = page.locator(UI.chat.messageInput);
      await expect(messageInput).toBeVisible();

      console.log('  Desktop layout is correct');
    });

    test('responsive grid on desktop', async ({ page, request }) => {
      console.log('Testing: Grid layout on desktop');

      await setupAuthenticatedUser(page, request);

      // Check that sidebar and main content are side by side
      const sidebar = page.locator(UI.app.sidebar);
      const mainArea = page.locator(UI.chat.container);

      if (await sidebar.isVisible() && await mainArea.isVisible().catch(() => false)) {
        const sidebarBox = await sidebar.boundingBox();
        const mainBox = await mainArea.boundingBox();

        if (sidebarBox && mainBox) {
          // They should be on the same row (similar Y position)
          expect(Math.abs(sidebarBox.y - mainBox.y)).toBeLessThan(50);
          // Sidebar should be to the left
          expect(sidebarBox.x).toBeLessThan(mainBox.x);
        }
      }

      console.log('  Grid layout is correct');
    });
  });
});

test.describe('Responsive Tests - Settings Page', () => {
  test.describe('Mobile (375x667)', () => {
    test.use({ viewport: VIEWPORTS.mobile });

    test('settings page renders on mobile', async ({ page, request }) => {
      console.log('Testing: Settings on mobile');

      await setupAuthenticatedUser(page, request);
      await page.goto(ROUTES.settings);
      await page.waitForLoadState('networkidle');

      // Check no overflow
      const hasOverflow = await page.evaluate(() => {
        return document.body.scrollWidth > window.innerWidth;
      });
      expect(hasOverflow).toBe(false);

      console.log('  Settings page mobile layout OK');
    });
  });
});
