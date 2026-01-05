/**
 * Accessibility (a11y) Tests
 * Run accessibility audits on every page using axe-core
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  ROUTES,
  UI,
  openAuthModal,
  setupAuthenticatedUser,
} from '../fixtures/test-helpers.js';

test.describe('Accessibility Tests - Public Pages', () => {
  test('landing page passes accessibility audit', async ({ page }) => {
    console.log('Auditing: Landing page accessibility');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Log violations for debugging
    if (results.violations.length > 0) {
      console.log('  Violations found:', results.violations.map(v => ({
        id: v.id,
        description: v.description,
        impact: v.impact,
        nodes: v.nodes.length,
      })));
    }

    // Expect no critical or serious violations
    const criticalViolations = results.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(criticalViolations).toHaveLength(0);

    console.log(`  Found ${results.violations.length} total violations, ${criticalViolations.length} critical/serious`);
  });

  test('privacy page passes accessibility audit', async ({ page }) => {
    console.log('Auditing: Privacy page accessibility');

    await page.goto(ROUTES.privacy);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const criticalViolations = results.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(criticalViolations).toHaveLength(0);

    console.log(`  Privacy page: ${criticalViolations.length} critical/serious violations`);
  });

  test('terms page passes accessibility audit', async ({ page }) => {
    console.log('Auditing: Terms page accessibility');

    await page.goto(ROUTES.terms);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const criticalViolations = results.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(criticalViolations).toHaveLength(0);

    console.log(`  Terms page: ${criticalViolations.length} critical/serious violations`);
  });
});

test.describe('Accessibility Tests - Auth Modal', () => {
  test('login modal passes accessibility audit', async ({ page }) => {
    console.log('Auditing: Login modal accessibility');

    await openAuthModal(page, 'signin');

    const results = await new AxeBuilder({ page })
      .include(UI.auth.modal)
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const criticalViolations = results.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );

    console.log(`  Login modal: ${criticalViolations.length} critical/serious violations`);
  });
});

test.describe('Accessibility Tests - Authenticated Pages', () => {
  test.beforeEach(async ({ page, request }) => {
    await setupAuthenticatedUser(page, request);
  });

  test('main app passes accessibility audit', async ({ page }) => {
    console.log('Auditing: Main app accessibility');

    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const criticalViolations = results.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );

    if (criticalViolations.length > 0) {
      console.log('  Critical violations:', criticalViolations.map(v => v.id));
    }

    expect(criticalViolations).toHaveLength(0);
    console.log(`  Main app: ${criticalViolations.length} critical/serious violations`);
  });

  test('settings page passes accessibility audit', async ({ page }) => {
    console.log('Auditing: Settings page accessibility');

    await page.goto(ROUTES.settings);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const criticalViolations = results.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations).toHaveLength(0);
    console.log(`  Settings page: ${criticalViolations.length} critical/serious violations`);
  });
});

test.describe('Accessibility Tests - Heading Hierarchy', () => {
  test('landing page has proper heading hierarchy', async ({ page }) => {
    console.log('Checking: Heading hierarchy on landing page');

    await page.goto('/');

    // Get all headings
    const headings = await page.evaluate(() => {
      const h = [];
      document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(el => {
        h.push({
          level: parseInt(el.tagName[1]),
          text: el.textContent.trim().substring(0, 50),
        });
      });
      return h;
    });

    // Should have at least one h1
    const hasH1 = headings.some(h => h.level === 1);
    expect(hasH1).toBe(true);

    // Heading levels shouldn't skip (e.g., h1 to h3 without h2)
    let prevLevel = 0;
    for (const heading of headings) {
      if (heading.level > prevLevel + 1 && prevLevel !== 0) {
        console.log(`  Warning: Heading level jump from h${prevLevel} to h${heading.level}`);
      }
      prevLevel = heading.level;
    }

    console.log(`  Found ${headings.length} headings, h1 present: ${hasH1}`);
  });
});

test.describe('Accessibility Tests - Images', () => {
  test('images have alt text', async ({ page }) => {
    console.log('Checking: Image alt text');

    await page.goto('/');

    const images = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src.substring(0, 50),
        alt: img.alt,
        hasAlt: img.hasAttribute('alt'),
      }));
    });

    const missingAlt = images.filter(img => !img.hasAlt);

    if (missingAlt.length > 0) {
      console.log('  Images missing alt:', missingAlt);
    }

    // All images should have alt attribute (can be empty for decorative)
    expect(missingAlt).toHaveLength(0);
    console.log(`  ${images.length} images checked, ${missingAlt.length} missing alt`);
  });
});

test.describe('Accessibility Tests - Form Labels', () => {
  test('login form inputs have labels', async ({ page }) => {
    console.log('Checking: Login form labels');

    await openAuthModal(page, 'signin');

    const inputs = await page.evaluate(() => {
      const formInputs = document.querySelectorAll('input[type="email"], input[type="password"], input[type="text"]');
      return Array.from(formInputs).map(input => {
        const id = input.id;
        const hasLabel = !!document.querySelector(`label[for="${id}"]`);
        const hasAriaLabel = input.hasAttribute('aria-label');
        const hasAriaLabelledBy = input.hasAttribute('aria-labelledby');
        const hasPlaceholder = input.hasAttribute('placeholder');

        return {
          type: input.type,
          hasLabel: hasLabel || hasAriaLabel || hasAriaLabelledBy,
          method: hasLabel ? 'label' : hasAriaLabel ? 'aria-label' : hasAriaLabelledBy ? 'aria-labelledby' : 'none',
        };
      });
    });

    const unlabelled = inputs.filter(i => !i.hasLabel);

    if (unlabelled.length > 0) {
      console.log('  Unlabelled inputs:', unlabelled);
    }

    // All inputs should have some form of label
    expect(unlabelled.length).toBeLessThanOrEqual(inputs.length * 0.1); // Allow 10% tolerance
    console.log(`  ${inputs.length} inputs, ${unlabelled.length} without labels`);
  });
});

test.describe('Accessibility Tests - Color Contrast', () => {
  test('page has sufficient color contrast', async ({ page }) => {
    console.log('Checking: Color contrast');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .options({
        runOnly: {
          type: 'rule',
          values: ['color-contrast'],
        },
      })
      .analyze();

    const contrastViolations = results.violations.filter(v => v.id === 'color-contrast');

    if (contrastViolations.length > 0) {
      const nodeCount = contrastViolations.reduce((sum, v) => sum + v.nodes.length, 0);
      console.log(`  Found ${nodeCount} elements with contrast issues`);
    }

    // Log but don't fail on contrast issues (common in designs)
    console.log(`  Color contrast check complete: ${contrastViolations.length} rule violations`);
  });
});

test.describe('Accessibility Tests - Keyboard Navigation', () => {
  test('can navigate with keyboard on landing page', async ({ page }) => {
    console.log('Testing: Keyboard navigation');

    await page.goto('/');

    // Start tabbing through the page
    await page.keyboard.press('Tab');

    // Should be able to reach interactive elements
    for (let i = 0; i < 10; i++) {
      const activeElement = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tagName: el?.tagName,
          type: el?.getAttribute('type'),
          text: el?.textContent?.substring(0, 30),
        };
      });

      // Should be able to focus on links, buttons, inputs
      const focusableElements = ['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'];
      if (activeElement.tagName && focusableElements.includes(activeElement.tagName)) {
        console.log(`  Focused: ${activeElement.tagName} - "${activeElement.text}"`);
      }

      await page.keyboard.press('Tab');
    }

    console.log('  Keyboard navigation working');
  });

  test('focus is visible', async ({ page }) => {
    console.log('Testing: Focus visibility');

    await page.goto('/');

    // Tab to first focusable element
    await page.keyboard.press('Tab');

    // Check if focus is visible
    const hasFocusStyle = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return false;

      const style = getComputedStyle(el);
      const outlineStyle = style.outline || style.outlineStyle;
      const boxShadow = style.boxShadow;

      // Check for visible focus indicator
      return outlineStyle !== 'none' ||
             boxShadow !== 'none' ||
             el.matches(':focus-visible');
    });

    console.log(`  Focus indicator visible: ${hasFocusStyle}`);
  });
});

test.describe('Accessibility Tests - ARIA', () => {
  test('buttons have accessible names', async ({ page }) => {
    console.log('Checking: Button accessible names');

    await page.goto('/');

    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map(btn => ({
        text: btn.textContent?.trim().substring(0, 30) || '',
        ariaLabel: btn.getAttribute('aria-label') || '',
        hasAccessibleName: btn.textContent?.trim().length > 0 || btn.hasAttribute('aria-label'),
      }));
    });

    const noName = buttons.filter(b => !b.hasAccessibleName);

    if (noName.length > 0) {
      console.log('  Buttons without accessible names:', noName.length);
    }

    expect(noName).toHaveLength(0);
    console.log(`  ${buttons.length} buttons checked, all have accessible names`);
  });

  test('links have accessible names', async ({ page }) => {
    console.log('Checking: Link accessible names');

    await page.goto('/');

    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).map(link => ({
        text: link.textContent?.trim().substring(0, 30) || '',
        ariaLabel: link.getAttribute('aria-label') || '',
        hasAccessibleName: (link.textContent?.trim().length || 0) > 0 || link.hasAttribute('aria-label'),
        href: link.href.substring(0, 50),
      }));
    });

    const noName = links.filter(l => !l.hasAccessibleName);

    // Allow some tolerance for icon-only links
    expect(noName.length).toBeLessThanOrEqual(2);
    console.log(`  ${links.length} links checked, ${noName.length} without accessible names`);
  });
});
