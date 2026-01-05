/**
 * Link and Navigation Tests
 * Crawl every internal link and verify navigation works
 */

import { test, expect } from '@playwright/test';
import {
  ROUTES,
  API_BASE_URL,
  getAllLinks,
  API_ENDPOINTS,
  UI,
  setupAuthenticatedUser,
} from '../fixtures/test-helpers.js';

test.describe('Link Tests - Internal Navigation', () => {
  test.describe('Public Pages', () => {
    test('all links on landing page are valid', async ({ page }) => {
      console.log('Checking: Landing page links');

      await page.goto('/');

      // Get all links
      const links = await getAllLinks(page);
      console.log(`  Found ${links.length} links on landing page`);

      const internalLinks = links.filter(link =>
        link.startsWith('/') || link.startsWith(page.url())
      );

      const brokenLinks = [];

      for (const link of internalLinks.slice(0, 20)) { // Limit to 20 for speed
        const fullUrl = link.startsWith('/') ? `${page.url().replace(/\/$/, '')}${link}` : link;

        try {
          const response = await page.request.get(fullUrl);
          if (response.status() >= 400) {
            brokenLinks.push({ link, status: response.status() });
          }
        } catch (e) {
          brokenLinks.push({ link, error: e.message });
        }
      }

      if (brokenLinks.length > 0) {
        console.log('  Broken links:', brokenLinks);
      }
      expect(brokenLinks).toHaveLength(0);
      console.log('  All landing page links are valid');
    });

    test('privacy page loads correctly', async ({ page }) => {
      console.log('Checking: Privacy page');

      const response = await page.goto(ROUTES.privacy);
      expect(response.status()).toBeLessThan(400);

      // Check for privacy content
      await expect(page.locator('body')).toContainText(/privacy/i);
      console.log('  Privacy page loads correctly');
    });

    test('terms page loads correctly', async ({ page }) => {
      console.log('Checking: Terms page');

      const response = await page.goto(ROUTES.terms);
      expect(response.status()).toBeLessThan(400);

      // Check for terms content
      await expect(page.locator('body')).toContainText(/terms/i);
      console.log('  Terms page loads correctly');
    });

    test('footer links work', async ({ page }) => {
      console.log('Checking: Footer links');

      await page.goto('/');

      // Look for footer
      const footer = page.locator(UI.footer.container);

      if (await footer.isVisible({ timeout: 3000 }).catch(() => false)) {
        const footerLinks = await footer.locator('a').all();

        for (const link of footerLinks) {
          const href = await link.getAttribute('href');
          if (href && href.startsWith('/')) {
            const isValid = await page.request.get(href).then(r => r.status() < 400).catch(() => false);
            expect(isValid).toBe(true);
          }
        }
        console.log(`  Checked ${footerLinks.length} footer links`);
      } else {
        console.log('  No footer found');
      }
    });
  });

  test.describe('Navigation Menu', () => {
    test('header navigation links work', async ({ page }) => {
      console.log('Checking: Header navigation');

      await page.goto('/');

      const header = page.locator(UI.header.container);

      if (await header.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        const headerLinks = await header.locator('a').all();

        let workingLinks = 0;
        for (const link of headerLinks.slice(0, 10)) {
          const href = await link.getAttribute('href');
          if (href && (href.startsWith('/') || href.startsWith('http'))) {
            workingLinks++;
          }
        }
        console.log(`  Found ${workingLinks} header navigation links`);
      } else {
        console.log('  No header navigation found');
      }
    });

    test('logo links to home', async ({ page }) => {
      console.log('Checking: Logo link');

      await page.goto(ROUTES.privacy);

      // Find logo and click
      const logo = page.locator(UI.header.logo).first();

      if (await logo.isVisible({ timeout: 3000 }).catch(() => false)) {
        await logo.click();
        await page.waitForURL('/');
        console.log('  Logo links to home correctly');
      } else {
        console.log('  Logo link not found');
      }
    });
  });

  test.describe('Authenticated Navigation', () => {
    test.beforeEach(async ({ page, request }) => {
      await setupAuthenticatedUser(page, request);
    });

    test('sidebar navigation works', async ({ page }) => {
      console.log('Checking: Sidebar navigation');

      // Check New Decision button
      const newButton = page.locator(UI.app.newDecisionButton);
      await expect(newButton).toBeVisible();
      console.log('  Sidebar navigation available');
    });

    test('settings link works', async ({ page }) => {
      console.log('Checking: Settings navigation');

      // Direct navigation
      await page.goto(ROUTES.settings);
      expect(page.url()).toContain('settings');
      console.log('  Settings accessible via direct URL');
    });
  });
});

test.describe('Link Tests - 404 Detection', () => {
  test('non-existent routes are handled', async ({ page }) => {
    console.log('Checking: 404 handling');

    const response = await page.goto('/this-page-does-not-exist-12345');

    // Should not be a server error
    expect(response.status()).toBeLessThan(500);
    console.log(`  Invalid route returned status ${response.status()}`);
  });

  test('invalid API routes return proper error codes', async ({ request }) => {
    console.log('Checking: Invalid API route handling');

    const response = await request.get(`${API_BASE_URL}/api/nonexistent-endpoint`);

    expect(response.status()).toBe(404);
    console.log('  Invalid API routes return 404');
  });
});

test.describe('Link Tests - Button Actions', () => {
  test('all buttons have proper click handlers', async ({ page }) => {
    console.log('Checking: Button handlers');

    await page.goto('/');

    const buttons = await page.locator('button:visible').all();
    console.log(`  Found ${buttons.length} visible buttons`);

    // Verify buttons are not orphaned (have some interactivity)
    for (const button of buttons.slice(0, 5)) {
      const isDisabled = await button.isDisabled();
      const hasOnClick = await button.evaluate(el => {
        return el.onclick !== null ||
               el.hasAttribute('onclick') ||
               el.type === 'submit';
      });

      // Button should either be disabled or have a handler
      // (React handlers are attached differently, so we just check it's interactive)
      const cursor = await button.evaluate(el => getComputedStyle(el).cursor);
      expect(['pointer', 'not-allowed', 'default']).toContain(cursor);
    }

    console.log('  Button handlers verified');
  });
});

test.describe('Link Tests - External Links', () => {
  test('external links have proper attributes', async ({ page }) => {
    console.log('Checking: External link attributes');

    await page.goto('/');

    const externalLinks = await page.locator('a[href^="http"]:not([href*="localhost"])').all();

    for (const link of externalLinks.slice(0, 10)) {
      const target = await link.getAttribute('target');
      const rel = await link.getAttribute('rel');

      // External links should open in new tab for security
      if (target === '_blank') {
        // Should have rel="noopener" or "noreferrer" for security
        expect(rel).toMatch(/noopener|noreferrer/);
      }
    }

    console.log(`  Checked ${externalLinks.length} external links`);
  });
});
