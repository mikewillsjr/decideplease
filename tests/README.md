# DecidePlease Test Suite

Comprehensive Playwright test suite covering end-to-end testing, accessibility, performance, security, and more.

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npx playwright test

# Run with UI mode (interactive)
npx playwright test --ui

# Run specific browser only
npx playwright test --project=chromium
```

## Test Categories

### 1. Smoke Tests (`tests/smoke.spec.js`)
Quick health check for critical paths - **run before every deploy**.

```bash
npx playwright test tests/smoke.spec.js
```

Tests:
- Frontend pages load (landing, privacy, terms)
- Backend API is responding
- Auth forms are accessible
- Static assets load correctly

### 2. E2E Tests (`tests/e2e/`)
End-to-end user flow tests covering complete user journeys.

```bash
npx playwright test tests/e2e/
```

Files:
- `auth.spec.js` - Registration, login, logout, password reset
- `conversation.spec.js` - Creating and managing conversations
- `settings.spec.js` - Account settings, email/password changes

### 3. Link Tests (`tests/links/`)
Navigation and link validation.

```bash
npx playwright test tests/links/
```

Tests:
- All internal links return valid status codes
- Navigation menus work correctly
- 404 pages handled properly
- External links have proper attributes

### 4. Form Tests (`tests/forms/`)
Form validation and input handling.

```bash
npx playwright test tests/forms/
```

Tests:
- Email format validation
- Password requirements
- Required field validation
- XSS and SQL injection prevention
- Edge cases (long inputs, special characters)

### 5. Visual Tests (`tests/visual/`)
Screenshot comparison for visual regression detection.

```bash
# Run visual tests
npx playwright test tests/visual/

# Update baseline screenshots
npx playwright test tests/visual/ --update-snapshots
```

Tests:
- Page screenshots at desktop/tablet/mobile
- Component screenshots (header, footer, modals)
- Interactive state screenshots (hover, focus)

### 6. Responsive Tests (`tests/responsive/`)
Mobile and tablet compatibility.

```bash
npx playwright test tests/responsive/
```

Viewports:
- Mobile: 375x667
- Tablet: 768x1024
- Desktop: 1920x1080

Tests:
- No horizontal overflow
- Navigation accessible on all sizes
- Touch target sizes
- Content readability

### 7. Accessibility Tests (`tests/accessibility/`)
WCAG compliance using axe-core.

```bash
npx playwright test tests/accessibility/
```

Tests:
- WCAG 2.0 AA compliance
- Heading hierarchy
- Image alt text
- Form labels
- Color contrast
- Keyboard navigation
- ARIA attributes

### 8. Performance Tests (`tests/performance/`)
Page load times and resource optimization.

```bash
npx playwright test tests/performance/
```

Thresholds:
- Page load: < 3 seconds
- First Contentful Paint: < 1.5 seconds
- Total JS bundle: < 2MB

Tests:
- Page load times
- Core Web Vitals
- Resource sizes
- API response times
- Caching headers

### 9. Console Tests (`tests/console/`)
JavaScript error detection.

```bash
npx playwright test tests/console/
```

Tests:
- No JS errors on page load
- No errors during interactions
- No errors during navigation
- Graceful network error handling

### 10. API Tests (`tests/api/`)
Backend API endpoint testing.

```bash
npx playwright test tests/api/
```

Tests:
- All endpoints return correct status codes
- Response data structure validation
- Authentication requirements
- Error handling
- Rate limiting

### 11. Security Tests (`tests/security/`)
Authentication and authorization testing.

```bash
npx playwright test tests/security/
```

Tests:
- Protected routes require authentication
- User data isolation
- Token validation
- Password security
- Admin access control
- XSS/SQL injection handling
- CORS headers

## Running Tests

### All Tests
```bash
npx playwright test
```

### Specific Category
```bash
npx playwright test tests/e2e/
npx playwright test tests/accessibility/
```

### Specific File
```bash
npx playwright test tests/e2e/auth.spec.js
```

### Specific Browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Headed Mode (see browser)
```bash
npx playwright test --headed
```

### Debug Mode
```bash
npx playwright test --debug
```

### Generate Report
```bash
npx playwright test
npx playwright show-report
```

## Test Configuration

Configuration is in `playwright.config.js`:
- Base URL: `http://localhost:5173`
- API URL: `http://localhost:8001`
- Browsers: Chrome, Firefox, Safari
- Mobile viewports included

## Prerequisites

Before running tests, ensure:

1. **Backend is running** on port 8001
   ```bash
   cd backend && python -m backend.main
   ```

2. **Frontend is running** on port 5173
   ```bash
   cd frontend && npm run dev
   ```

Or let Playwright start them automatically (configured in `playwright.config.js`).

## Test Fixtures

Located in `tests/fixtures/`:

- `test-helpers.js` - Common utilities and test data
- `auth.setup.js` - Authentication setup for tests

### Test Helpers

```javascript
import {
  generateTestEmail,
  generateTestPassword,
  API_BASE_URL,
  ROUTES,
  VIEWPORTS,
  TestData,
} from './fixtures/test-helpers.js';
```

## Writing New Tests

### Basic Test Structure
```javascript
import { test, expect } from '@playwright/test';
import { generateTestEmail } from '../fixtures/test-helpers.js';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    console.log('Testing: Feature description');

    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();

    console.log('  Test passed');
  });
});
```

### Authenticated Test
```javascript
test.beforeEach(async ({ page, request }) => {
  const email = generateTestEmail();
  const password = generateTestPassword();

  // Register and login
  await request.post(`${API_BASE_URL}/api/auth/register`, {
    data: { email, password },
  });

  const loginResponse = await request.post(`${API_BASE_URL}/api/auth/login`, {
    data: { email, password },
  });

  const { access_token, refresh_token, user } = await loginResponse.json();

  await page.goto('/');
  await page.evaluate(({ accessToken, refreshToken, user }) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
  }, { accessToken: access_token, refreshToken: refresh_token, user });

  await page.reload();
});
```

## Updating Visual Baselines

When UI changes are intentional:

```bash
npx playwright test tests/visual/ --update-snapshots
```

Review the changes in `tests/visual/screenshots.spec.js-snapshots/`.

## CI/CD Integration

Tests are configured to run in CI with:
- Single worker
- 2 retries on failure
- Trace collection on first retry

```yaml
# Example GitHub Actions
- name: Run Playwright tests
  run: npx playwright test
  env:
    CI: true
```

## Troubleshooting

### Tests timing out
- Increase timeout in `playwright.config.js`
- Check if servers are running

### Visual tests failing
- Update baselines if changes are intentional
- Check viewport consistency

### Auth tests failing
- Verify backend is running
- Check database connection

### Console errors
- Check browser console output
- Review error messages in test logs

## Contributing

When adding new features:
1. Add tests to appropriate category
2. Update this README if adding new test files
3. Run full test suite before committing
4. Update visual baselines if UI changed
