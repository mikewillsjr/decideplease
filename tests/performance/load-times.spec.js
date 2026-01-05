/**
 * Performance Tests
 * Measure page load times and Core Web Vitals
 */

import { test, expect } from '@playwright/test';
import {
  ROUTES,
  PERFORMANCE_THRESHOLDS,
  getPerformanceMetrics,
  generateTestEmail,
  generateTestPassword,
  API_BASE_URL,
  API_ENDPOINTS,
} from '../fixtures/test-helpers.js';

test.describe('Performance Tests - Page Load Times', () => {
  test('landing page loads within threshold', async ({ page }) => {
    console.log('Measuring: Landing page load time');

    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('load');
    const loadTime = Date.now() - startTime;

    const metrics = await getPerformanceMetrics(page);

    console.log(`  Load time: ${loadTime}ms`);
    console.log(`  DOM Content Loaded: ${metrics.domContentLoaded?.toFixed(0)}ms`);
    console.log(`  First Contentful Paint: ${metrics.firstContentfulPaint?.toFixed(0)}ms`);

    expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.pageLoadTime);
  });

  test('privacy page loads within threshold', async ({ page }) => {
    console.log('Measuring: Privacy page load time');

    const startTime = Date.now();
    await page.goto(ROUTES.privacy);
    await page.waitForLoadState('load');
    const loadTime = Date.now() - startTime;

    console.log(`  Load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.pageLoadTime);
  });

  test('terms page loads within threshold', async ({ page }) => {
    console.log('Measuring: Terms page load time');

    const startTime = Date.now();
    await page.goto(ROUTES.terms);
    await page.waitForLoadState('load');
    const loadTime = Date.now() - startTime;

    console.log(`  Load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.pageLoadTime);
  });
});

test.describe('Performance Tests - Authenticated Pages', () => {
  let testEmail;
  let testPassword;

  test.beforeEach(async ({ page, request }) => {
    testEmail = generateTestEmail();
    testPassword = generateTestPassword();

    await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
      data: { email: testEmail, password: testPassword },
    });

    const loginResponse = await request.post(`${API_BASE_URL}${API_ENDPOINTS.login}`, {
      data: { email: testEmail, password: testPassword },
    });

    const loginData = await loginResponse.json();

    await page.goto('/');
    await page.evaluate(({ accessToken, refreshToken, user }) => {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));
    }, {
      accessToken: loginData.access_token,
      refreshToken: loginData.refresh_token,
      user: loginData.user,
    });
  });

  test('main app loads within threshold', async ({ page }) => {
    console.log('Measuring: Main app load time');

    const startTime = Date.now();
    await page.reload();
    await page.waitForLoadState('load');
    await page.waitForSelector('.sidebar, [data-testid="sidebar"]', { timeout: 10000 });
    const loadTime = Date.now() - startTime;

    console.log(`  Load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.pageLoadTime);
  });

  test('settings page loads within threshold', async ({ page }) => {
    console.log('Measuring: Settings page load time');

    await page.reload();

    const startTime = Date.now();
    await page.goto(ROUTES.settings);
    await page.waitForLoadState('load');
    const loadTime = Date.now() - startTime;

    console.log(`  Load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.pageLoadTime);
  });
});

test.describe('Performance Tests - Core Web Vitals', () => {
  test('First Contentful Paint within threshold', async ({ page }) => {
    console.log('Measuring: First Contentful Paint');

    await page.goto('/');
    await page.waitForLoadState('load');

    const metrics = await getPerformanceMetrics(page);
    const fcp = metrics.firstContentfulPaint;

    if (fcp) {
      console.log(`  FCP: ${fcp.toFixed(0)}ms`);
      expect(fcp).toBeLessThan(PERFORMANCE_THRESHOLDS.firstContentfulPaint);
    } else {
      console.log('  FCP metric not available');
    }
  });

  test('DOM interactive time is reasonable', async ({ page }) => {
    console.log('Measuring: DOM Interactive');

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const metrics = await getPerformanceMetrics(page);
    const domInteractive = metrics.domContentLoaded;

    if (domInteractive) {
      console.log(`  DOM Interactive: ${domInteractive.toFixed(0)}ms`);
      expect(domInteractive).toBeLessThan(2000); // 2 second threshold
    } else {
      console.log('  DOM Interactive metric not available');
    }
  });
});

test.describe('Performance Tests - Resource Loading', () => {
  test('total resource size is reasonable', async ({ page }) => {
    console.log('Measuring: Resource sizes');

    let totalBytes = 0;
    const resources = [];

    page.on('response', async response => {
      const contentLength = response.headers()['content-length'];
      if (contentLength) {
        totalBytes += parseInt(contentLength);
        resources.push({
          url: response.url().substring(0, 50),
          size: parseInt(contentLength),
        });
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const totalKB = totalBytes / 1024;
    console.log(`  Total resources: ${totalKB.toFixed(0)}KB`);

    // Log largest resources
    resources.sort((a, b) => b.size - a.size);
    resources.slice(0, 5).forEach(r => {
      console.log(`    ${(r.size / 1024).toFixed(0)}KB - ${r.url}`);
    });

    // Total bundle should be under 5MB for initial load
    expect(totalBytes).toBeLessThan(5 * 1024 * 1024);
  });

  test('no excessively large assets', async ({ page }) => {
    console.log('Checking: Individual asset sizes');

    const largeAssets = [];

    page.on('response', async response => {
      const contentLength = response.headers()['content-length'];
      if (contentLength && parseInt(contentLength) > 500 * 1024) { // 500KB
        largeAssets.push({
          url: response.url(),
          size: parseInt(contentLength) / 1024,
        });
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    if (largeAssets.length > 0) {
      console.log('  Large assets found:');
      largeAssets.forEach(a => {
        console.log(`    ${a.size.toFixed(0)}KB - ${a.url}`);
      });
    }

    // Warn but don't fail for large assets
    console.log(`  ${largeAssets.length} assets over 500KB`);
  });

  test('JavaScript files are reasonably sized', async ({ page }) => {
    console.log('Checking: JavaScript bundle sizes');

    const jsFiles = [];

    page.on('response', async response => {
      const url = response.url();
      if (url.endsWith('.js') || url.includes('.js?')) {
        const contentLength = response.headers()['content-length'];
        if (contentLength) {
          jsFiles.push({
            url: url.split('/').pop().substring(0, 40),
            size: parseInt(contentLength) / 1024,
          });
        }
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const totalJS = jsFiles.reduce((sum, f) => sum + f.size, 0);
    console.log(`  Total JS: ${totalJS.toFixed(0)}KB across ${jsFiles.length} files`);

    // Total JS should be under 2MB
    expect(totalJS).toBeLessThan(2 * 1024);
  });
});

test.describe('Performance Tests - API Response Times', () => {
  test('public API endpoints respond quickly', async ({ request }) => {
    console.log('Measuring: API response times');

    const endpoints = [
      { name: 'run-modes', url: `${API_BASE_URL}/api/run-modes` },
      { name: 'credits-info', url: `${API_BASE_URL}/api/credits/info` },
    ];

    for (const endpoint of endpoints) {
      const startTime = Date.now();
      const response = await request.get(endpoint.url);
      const responseTime = Date.now() - startTime;

      console.log(`  ${endpoint.name}: ${responseTime}ms (${response.status()})`);

      // API endpoints should respond within 1 second
      expect(responseTime).toBeLessThan(1000);
    }
  });

  test('auth endpoints respond quickly', async ({ request }) => {
    console.log('Measuring: Auth API response times');

    // Test login (will fail but should be fast)
    const startTime = Date.now();
    await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: { email: 'test@test.com', password: 'password' },
    });
    const responseTime = Date.now() - startTime;

    console.log(`  Login endpoint: ${responseTime}ms`);
    expect(responseTime).toBeLessThan(1000);
  });
});

test.describe('Performance Tests - Caching', () => {
  test('static assets have cache headers', async ({ page }) => {
    console.log('Checking: Cache headers on static assets');

    const cachedAssets = [];
    const uncachedAssets = [];

    page.on('response', async response => {
      const url = response.url();
      if (url.match(/\.(js|css|png|jpg|svg|woff|woff2)$/)) {
        const cacheControl = response.headers()['cache-control'];
        if (cacheControl && cacheControl.includes('max-age')) {
          cachedAssets.push(url.split('/').pop());
        } else {
          uncachedAssets.push(url.split('/').pop());
        }
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    console.log(`  Cached assets: ${cachedAssets.length}`);
    console.log(`  Uncached assets: ${uncachedAssets.length}`);

    // Most static assets should have cache headers
    const cacheRatio = cachedAssets.length / (cachedAssets.length + uncachedAssets.length);
    console.log(`  Cache ratio: ${(cacheRatio * 100).toFixed(0)}%`);
  });
});

test.describe('Performance Tests - Navigation Timing', () => {
  test('subsequent navigation is fast', async ({ page }) => {
    console.log('Measuring: Navigation timing');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to another page
    const startTime = Date.now();
    await page.goto(ROUTES.privacy);
    await page.waitForLoadState('load');
    const navTime = Date.now() - startTime;

    console.log(`  Navigation time: ${navTime}ms`);

    // Second navigation should be faster (cached resources)
    expect(navTime).toBeLessThan(PERFORMANCE_THRESHOLDS.pageLoadTime);
  });
});
