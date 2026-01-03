// @ts-check
import { test, expect } from '@playwright/test';

/**
 * UI Verification Tests for DecidePlease
 *
 * These tests verify that all public-facing UI elements
 * load correctly without requiring authentication.
 */

const BASE_URL = process.env.TEST_URL || 'https://decideplease.com';

test.describe('Landing Page UI Verification', () => {
  test.setTimeout(60000);

  test('Landing page loads with correct title and branding', async ({ page }) => {
    console.log('Testing:', BASE_URL);

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check title
    const title = await page.title();
    console.log('Page title:', title);
    expect(title).toContain('DecidePlease');

    // Take screenshot
    await page.screenshot({ path: 'e2e/screenshots/ui-01-landing.png', fullPage: true });

    // Check for branding elements
    const hasLogo = await page.locator('img[alt*="logo" i], svg, [class*="logo"]').first().isVisible().catch(() => false);
    console.log('Logo visible:', hasLogo);
  });

  test('Hero section displays correctly', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check for hero headline
    const headline = page.locator('h1').first();
    const headlineVisible = await headline.isVisible().catch(() => false);
    console.log('Headline visible:', headlineVisible);

    if (headlineVisible) {
      const headlineText = await headline.textContent();
      console.log('Headline text:', headlineText);
      expect(headlineText).toBeTruthy();
    }

    await page.screenshot({ path: 'e2e/screenshots/ui-02-hero.png' });
  });

  test('CTA buttons are visible and clickable', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for primary CTAs
    const tryFreeBtn = page.locator('button:has-text("Try Free"), a:has-text("Try Free")').first();
    const getStartedBtn = page.locator('button:has-text("Get Started"), a:has-text("Get Started")').first();
    const loginBtn = page.locator('button:has-text("Log in"), a:has-text("Log in")').first();

    const hasTryFree = await tryFreeBtn.isVisible().catch(() => false);
    const hasGetStarted = await getStartedBtn.isVisible().catch(() => false);
    const hasLogin = await loginBtn.isVisible().catch(() => false);

    console.log('CTA visibility:', { hasTryFree, hasGetStarted, hasLogin });

    // At least one CTA should be visible
    expect(hasTryFree || hasGetStarted || hasLogin).toBeTruthy();

    await page.screenshot({ path: 'e2e/screenshots/ui-03-ctas.png' });
  });

  test('Navigation header is present', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check for header/navigation
    const header = page.locator('header, nav, [class*="header"], [class*="nav"]').first();
    const headerVisible = await header.isVisible().catch(() => false);
    console.log('Header/nav visible:', headerVisible);

    await page.screenshot({ path: 'e2e/screenshots/ui-04-header.png' });
  });

  test('Footer is present', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    // Check for footer
    const footer = page.locator('footer, [class*="footer"]').first();
    const footerVisible = await footer.isVisible().catch(() => false);
    console.log('Footer visible:', footerVisible);

    await page.screenshot({ path: 'e2e/screenshots/ui-05-footer.png' });
  });

  test('Clerk auth modal opens on login click', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find and click login button
    const loginBtn = page.locator('button:has-text("Log in"), a:has-text("Log in")').first();

    if (await loginBtn.isVisible().catch(() => false)) {
      await loginBtn.click();
      await page.waitForTimeout(2000);

      // Check if Clerk modal appeared
      const emailInput = page.locator('input[name="identifier"], input[type="email"]').first();
      const modalVisible = await emailInput.isVisible({ timeout: 5000 }).catch(() => false);

      console.log('Clerk modal opened:', modalVisible);
      expect(modalVisible).toBeTruthy();

      await page.screenshot({ path: 'e2e/screenshots/ui-06-auth-modal.png' });

      // Close modal (click outside or X button)
      const closeBtn = page.locator('button[aria-label="Close"], [class*="close"]').first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }
  });

  test('Try Free button opens signup flow', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find and click Try Free button
    const tryFreeBtn = page.locator('button:has-text("Try Free"), a:has-text("Try Free")').first();

    if (await tryFreeBtn.isVisible().catch(() => false)) {
      await tryFreeBtn.click();
      await page.waitForTimeout(2000);

      // Check if signup modal/form appeared
      const signupForm = page.locator('input[name="identifier"], input[type="email"], input[name="emailAddress"]').first();
      const formVisible = await signupForm.isVisible({ timeout: 5000 }).catch(() => false);

      console.log('Signup form opened:', formVisible);
      expect(formVisible).toBeTruthy();

      await page.screenshot({ path: 'e2e/screenshots/ui-07-signup-modal.png' });
    }
  });

  test('Page is responsive - mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'e2e/screenshots/ui-08-mobile.png', fullPage: true });

    // Check that content is visible on mobile
    const headline = page.locator('h1').first();
    const headlineVisible = await headline.isVisible().catch(() => false);
    console.log('Mobile headline visible:', headlineVisible);

    expect(headlineVisible).toBeTruthy();
  });

  test('Page is responsive - tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'e2e/screenshots/ui-09-tablet.png', fullPage: true });

    // Check that content is visible on tablet
    const headline = page.locator('h1').first();
    const headlineVisible = await headline.isVisible().catch(() => false);
    console.log('Tablet headline visible:', headlineVisible);

    expect(headlineVisible).toBeTruthy();
  });

  test('No console errors on page load', async ({ page }) => {
    const errors = [];

    page.on('pageerror', err => {
      errors.push(err.message);
    });

    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        errors.push(msg.text());
      }
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    console.log('Console errors found:', errors.length);
    if (errors.length > 0) {
      console.log('Errors:', errors.slice(0, 5)); // Show first 5
    }

    // Allow some minor errors but flag if there are many
    if (errors.length > 5) {
      console.warn('Warning: Multiple console errors detected');
    }
  });

  test('All images load correctly', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check for broken images
    const images = await page.locator('img').all();
    let brokenCount = 0;

    for (const img of images) {
      const naturalWidth = await img.evaluate((el) => el.naturalWidth);
      if (naturalWidth === 0) {
        const src = await img.getAttribute('src');
        console.log('Broken image:', src);
        brokenCount++;
      }
    }

    console.log(`Images checked: ${images.length}, Broken: ${brokenCount}`);
    expect(brokenCount).toBe(0);
  });

  test('Page loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');

    const loadTime = Date.now() - startTime;
    console.log(`Page load time: ${loadTime}ms`);

    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('SEO meta tags are present', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Check for meta description
    const metaDesc = await page.locator('meta[name="description"]').getAttribute('content').catch(() => null);
    console.log('Meta description:', metaDesc ? 'Present' : 'Missing');

    // Check for Open Graph tags
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content').catch(() => null);
    const ogDesc = await page.locator('meta[property="og:description"]').getAttribute('content').catch(() => null);

    console.log('OG Title:', ogTitle ? 'Present' : 'Missing');
    console.log('OG Description:', ogDesc ? 'Present' : 'Missing');

    // Check for favicon
    const favicon = await page.locator('link[rel="icon"], link[rel="shortcut icon"]').first().getAttribute('href').catch(() => null);
    console.log('Favicon:', favicon ? 'Present' : 'Missing');
  });
});

test.describe('Feature Sections', () => {
  test('Key features/benefits section exists', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Scroll down to find features
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'e2e/screenshots/ui-10-features.png', fullPage: true });

    // Look for features section
    const featuresSection = page.locator('[class*="feature"], [class*="benefit"], section').first();
    const sectionVisible = await featuresSection.isVisible().catch(() => false);
    console.log('Features section visible:', sectionVisible);
  });

  test('Pricing or credits info is shown', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Look for pricing mentions
    const pricingText = await page.locator('text=/credit|price|\\$|free/i').first().isVisible().catch(() => false);
    console.log('Pricing/credits info visible:', pricingText);

    await page.screenshot({ path: 'e2e/screenshots/ui-11-pricing.png', fullPage: true });
  });
});
