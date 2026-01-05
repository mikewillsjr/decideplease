/**
 * Visual Regression Tests
 * Screenshot every major page and component for comparison
 */

import { test, expect } from '@playwright/test';
import {
  ROUTES,
  VIEWPORTS,
  UI,
  openAuthModal,
  setupAuthenticatedUser,
} from '../fixtures/test-helpers.js';

test.describe('Visual Tests - Public Pages', () => {
  test.describe('Desktop Viewport (1920x1080)', () => {
    test.use({ viewport: VIEWPORTS.desktop });

    test('landing page visual', async ({ page }) => {
      console.log('Capturing: Landing page (desktop)');

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('landing-desktop.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.1,
      });
      console.log('  Landing page screenshot captured');
    });

    test('privacy page visual', async ({ page }) => {
      console.log('Capturing: Privacy page (desktop)');

      await page.goto(ROUTES.privacy);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('privacy-desktop.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.1,
      });
      console.log('  Privacy page screenshot captured');
    });

    test('terms page visual', async ({ page }) => {
      console.log('Capturing: Terms page (desktop)');

      await page.goto(ROUTES.terms);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('terms-desktop.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.1,
      });
      console.log('  Terms page screenshot captured');
    });
  });

  test.describe('Tablet Viewport (768x1024)', () => {
    test.use({ viewport: VIEWPORTS.tablet });

    test('landing page visual (tablet)', async ({ page }) => {
      console.log('Capturing: Landing page (tablet)');

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('landing-tablet.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.1,
      });
      console.log('  Landing page tablet screenshot captured');
    });
  });

  test.describe('Mobile Viewport (375x667)', () => {
    test.use({ viewport: VIEWPORTS.mobile });

    test('landing page visual (mobile)', async ({ page }) => {
      console.log('Capturing: Landing page (mobile)');

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('landing-mobile.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.1,
      });
      console.log('  Landing page mobile screenshot captured');
    });
  });
});

test.describe('Visual Tests - Components', () => {
  test.describe('Header Component', () => {
    test('header visual', async ({ page }) => {
      console.log('Capturing: Header component');

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const header = page.locator(UI.header.container).first();

      if (await header.isVisible()) {
        await expect(header).toHaveScreenshot('header-component.png', {
          maxDiffPixelRatio: 0.1,
        });
        console.log('  Header screenshot captured');
      } else {
        console.log('  Header not found');
      }
    });
  });

  test.describe('Footer Component', () => {
    test('footer visual', async ({ page }) => {
      console.log('Capturing: Footer component');

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const footer = page.locator(UI.footer.container).first();

      if (await footer.isVisible().catch(() => false)) {
        await expect(footer).toHaveScreenshot('footer-component.png', {
          maxDiffPixelRatio: 0.1,
        });
        console.log('  Footer screenshot captured');
      } else {
        console.log('  Footer not found');
      }
    });
  });

  test.describe('Auth Modal', () => {
    test('login modal visual', async ({ page }) => {
      console.log('Capturing: Login modal');

      await openAuthModal(page, 'signin');

      const modal = page.locator(UI.auth.modal);
      if (await modal.isVisible()) {
        await expect(modal).toHaveScreenshot('login-modal.png', {
          maxDiffPixelRatio: 0.1,
        });
        console.log('  Login modal screenshot captured');
      } else {
        console.log('  Login modal not visible');
      }
    });
  });
});

test.describe('Visual Tests - Authenticated Pages', () => {
  test.describe('Desktop Viewport', () => {
    test.use({ viewport: VIEWPORTS.desktop });

    test('main app visual', async ({ page, request }) => {
      console.log('Capturing: Main app (authenticated)');

      await setupAuthenticatedUser(page, request);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('app-main-desktop.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.1,
      });
      console.log('  Main app screenshot captured');
    });

    test('sidebar visual', async ({ page, request }) => {
      console.log('Capturing: Sidebar component');

      await setupAuthenticatedUser(page, request);

      const sidebar = page.locator(UI.app.sidebar);

      await expect(sidebar).toHaveScreenshot('sidebar-component.png', {
        maxDiffPixelRatio: 0.1,
      });
      console.log('  Sidebar screenshot captured');
    });

    test('settings page visual', async ({ page, request }) => {
      console.log('Capturing: Settings page');

      await setupAuthenticatedUser(page, request);
      await page.goto(ROUTES.settings);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('settings-desktop.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.1,
      });
      console.log('  Settings page screenshot captured');
    });
  });

  test.describe('Mobile Viewport', () => {
    test.use({ viewport: VIEWPORTS.mobile });

    test('main app visual (mobile)', async ({ page, request }) => {
      console.log('Capturing: Main app (mobile)');

      await setupAuthenticatedUser(page, request);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('app-main-mobile.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.1,
      });
      console.log('  Main app mobile screenshot captured');
    });
  });
});

test.describe('Visual Tests - Interactive States', () => {
  test('button hover states', async ({ page }) => {
    console.log('Capturing: Button hover states');

    await page.goto('/');

    const button = page.locator(UI.landing.loginButton).or(page.locator(UI.landing.heroButton)).first();

    if (await button.isVisible()) {
      // Normal state
      await expect(button).toHaveScreenshot('button-normal.png', {
        maxDiffPixelRatio: 0.1,
      });

      // Hover state
      await button.hover();
      await page.waitForTimeout(200);

      await expect(button).toHaveScreenshot('button-hover.png', {
        maxDiffPixelRatio: 0.15, // More tolerance for hover animations
      });

      console.log('  Button states captured');
    } else {
      console.log('  Button not found');
    }
  });

  test('input focus states', async ({ page }) => {
    console.log('Capturing: Input focus states');

    await openAuthModal(page, 'signin');

    const emailInput = page.locator(UI.auth.emailInput);

    if (await emailInput.isVisible()) {
      // Normal state
      await expect(emailInput).toHaveScreenshot('input-normal.png', {
        maxDiffPixelRatio: 0.1,
      });

      // Focus state
      await emailInput.focus();
      await page.waitForTimeout(200);

      await expect(emailInput).toHaveScreenshot('input-focus.png', {
        maxDiffPixelRatio: 0.15,
      });

      console.log('  Input states captured');
    }
  });
});
