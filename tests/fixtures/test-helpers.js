/**
 * Test Helpers and Utilities
 * Common functions used across all test categories
 *
 * IMPORTANT: This file contains the canonical selectors for the DecidePlease UI.
 * All test files should import selectors from here to maintain consistency.
 */

/**
 * Generate a unique test email
 * @returns {string} Unique email address for testing
 */
export function generateTestEmail() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `test_${timestamp}_${random}@example.com`;
}

/**
 * Generate a valid test password
 * @returns {string} Password meeting requirements (8+ chars)
 */
export function generateTestPassword() {
  return `TestPass${Date.now().toString().slice(-6)}!`;
}

/**
 * API base URL
 */
export const API_BASE_URL = 'http://localhost:8001';

/**
 * Frontend base URL
 */
export const FRONTEND_BASE_URL = 'http://localhost:5173';

/**
 * Test user credentials for pre-existing test account
 * These should be created before running tests
 */
export const TEST_USER = {
  email: 'playwright_test@example.com',
  password: 'TestPassword123!',
};

/**
 * Admin test user credentials
 */
export const TEST_ADMIN = {
  email: 'playwright_admin@example.com',
  password: 'AdminPassword123!',
};

/**
 * Common page routes
 */
export const ROUTES = {
  home: '/',
  privacy: '/privacy',
  terms: '/terms',
  settings: '/settings',
  resetPassword: '/reset-password',
};

/**
 * API endpoints for testing
 */
export const API_ENDPOINTS = {
  // Auth
  register: '/api/auth/register',
  login: '/api/auth/login',
  refresh: '/api/auth/refresh',
  me: '/api/auth/me',
  forgotPassword: '/api/auth/forgot-password',
  resetPassword: '/api/auth/reset-password',
  updateEmail: '/api/auth/update-email',
  changePassword: '/api/auth/change-password',
  deleteAccount: '/api/auth/delete-account',

  // Conversations
  conversations: '/api/conversations',

  // Credits
  creditsInfo: '/api/credits/info',
  creditsCheckout: '/api/credits/checkout',

  // Config
  runModes: '/api/run-modes',

  // Admin
  adminCheck: '/api/admin/check',
  adminStats: '/api/admin/stats',
  adminUsers: '/api/admin/users',
};

/**
 * UI Selectors - Canonical selectors for DecidePlease UI components
 * Use these throughout all tests for consistency
 */
export const UI = {
  // Landing Page
  landing: {
    heroButton: 'button:has-text("Get 5 Free Credits")',
    viewSampleButton: 'button:has-text("View Sample Verdict")',
    tryFreeButton: 'button:has-text("Try Free")',
    loginButton: 'button:has-text("Log in")',
    pricingCards: '.pricing-card',
    // Inline email capture form (shown after clicking Try Free / Get 5 Free Credits)
    inlineEmailInput: 'input[placeholder="Enter your email"], textbox[name="Enter your email"]',
    cancelButton: 'button:has-text("Cancel")',
  },

  // Auth Modal
  auth: {
    modal: '.auth-modal',
    overlay: '.auth-modal-overlay',
    closeButton: '.auth-modal-close',
    emailInput: 'input#email',
    passwordInput: 'input#password',
    confirmPasswordInput: 'input#confirmPassword',
    submitButton: '.auth-submit',
    errorMessage: '.auth-error',
    successMessage: '.auth-success',
    forgotPasswordLink: 'button:has-text("Forgot your password?")',
    switchToSignUp: 'button:has-text("Sign up")',
    switchToSignIn: 'button:has-text("Sign in")',
    // Button text by mode
    loginButtonText: 'Sign in',
    registerButtonText: 'Create account',
    forgotButtonText: 'Send reset link',
  },

  // Main App (Authenticated)
  app: {
    sidebar: '.sidebar',
    newDecisionButton: '.new-conversation-btn',
    conversationList: '.conversation-list',
    conversationItem: '.conversation-item',
    activeConversation: '.conversation-item.active',
    deleteButton: '.delete-btn',
    historyLabel: '.history-label',
    noConversations: '.no-conversations',
  },

  // Chat Interface
  chat: {
    container: '.chat-interface',
    messagesContainer: '.messages-container',
    emptyState: '.empty-state',
    messageInput: '.message-input',
    sendButton: '.send-button',
    inputForm: '.input-form',
    userMessage: '.user-message',
    assistantMessage: '.assistant-message',
    rerunButton: '.rerun-button',
    suggestionGrid: '.suggestion-grid',
    suggestionCard: '.suggestion-card',
    errorBanner: '.error-banner',
  },

  // Settings Page
  settings: {
    container: '.settings-page',
    nav: '.settings-nav',
    profileTab: 'button:has-text("Profile")',
    securityTab: 'button:has-text("Security")',
    accountTab: 'button:has-text("Account")',
    section: '.settings-section',
    card: '.settings-card',
    errorMessage: '.settings-error',
    successMessage: '.settings-success',
    dangerZone: '.settings-card.danger-zone',
    deleteConfirmInput: 'input[placeholder="DELETE"]',
    deleteButton: 'button:has-text("Delete Account")',
  },

  // Header
  header: {
    container: 'header, .header',
    logo: '.logo, a[href="/"]',
    userMenu: '.user-menu, .header-user',
  },

  // Footer
  footer: {
    container: 'footer, .footer',
  },

  // Common
  common: {
    primaryButton: '.btn-primary',
    secondaryButton: '.btn-secondary',
    dangerButton: '.btn-danger',
    loadingSpinner: '.loading, .spinner',
  },
};

/**
 * Viewport sizes for responsive testing
 */
export const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1920, height: 1080 },
};

/**
 * Performance thresholds
 */
export const PERFORMANCE_THRESHOLDS = {
  pageLoadTime: 3000, // 3 seconds max
  firstContentfulPaint: 1500,
  largestContentfulPaint: 2500,
};

/**
 * Wait for network to be idle
 * @param {import('@playwright/test').Page} page
 */
export async function waitForNetworkIdle(page) {
  await page.waitForLoadState('networkidle');
}

/**
 * Open the auth modal on the landing page
 * @param {import('@playwright/test').Page} page
 * @param {'signin' | 'signup'} mode - Which auth mode to open
 */
export async function openAuthModal(page, mode = 'signin') {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  if (mode === 'signin') {
    // Click "Log in" button in header - directly opens auth modal
    const loginButton = page.locator(UI.landing.loginButton);
    if (await loginButton.isVisible({ timeout: 3000 })) {
      await loginButton.click();
    }
    // Wait for modal to appear
    await page.waitForSelector(UI.auth.modal, { timeout: 5000 });
  } else {
    // For signup, click "Log in" first then switch to signup mode
    // This is more reliable than inline email capture flow
    const loginButton = page.locator(UI.landing.loginButton);
    if (await loginButton.isVisible({ timeout: 3000 })) {
      await loginButton.click();
    }
    // Wait for modal to appear
    await page.waitForSelector(UI.auth.modal, { timeout: 5000 });

    // Switch to signup mode if available
    const switchToSignUp = page.locator(UI.auth.switchToSignUp);
    if (await switchToSignUp.isVisible({ timeout: 2000 }).catch(() => false)) {
      await switchToSignUp.click();
      await page.waitForTimeout(300); // Allow animation
    }
  }
}

/**
 * Setup an authenticated user for tests
 * Creates a new user via API, sets tokens in localStorage, and reloads the page
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {object} options - Options for setup
 * @param {number} options.retries - Number of retries for rate limiting (default: 3)
 * @returns {Promise<{email: string, password: string, accessToken: string}>}
 */
export async function setupAuthenticatedUser(page, request, options = {}) {
  const { retries = 3 } = options;
  const email = generateTestEmail();
  const password = generateTestPassword();

  // Register user with retry for rate limiting
  let registerResponse;
  let lastError;

  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) {
      // Wait before retry with exponential backoff
      await page.waitForTimeout(1000 * Math.pow(2, attempt));
    }

    registerResponse = await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
      data: { email, password },
    });

    if (registerResponse.ok()) {
      break;
    }

    if (registerResponse.status() === 429) {
      // Rate limited, will retry
      lastError = new Error(`Rate limited (429), attempt ${attempt + 1}/${retries}`);
      continue;
    }

    // Other error, don't retry
    throw new Error(`Registration failed: ${registerResponse.status()}`);
  }

  if (!registerResponse.ok()) {
    throw lastError || new Error(`Registration failed after ${retries} retries: ${registerResponse.status()}`);
  }

  const data = await registerResponse.json();

  // Navigate to page first (needed to set localStorage)
  await page.goto('/');

  // Set tokens in localStorage using the app's actual key names
  await page.evaluate(({ accessToken, refreshToken, user }) => {
    localStorage.setItem('decideplease_access_token', accessToken);
    localStorage.setItem('decideplease_refresh_token', refreshToken);
    localStorage.setItem('decideplease_user', JSON.stringify(user));
  }, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    user: data.user,
  });

  // Reload to apply authentication
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Wait for sidebar to confirm we're authenticated
  await page.waitForSelector(UI.app.sidebar, { timeout: 10000 });

  return {
    email,
    password,
    accessToken: data.access_token,
    user: data.user,
  };
}

/**
 * Login helper - logs in a user via the UI
 * @param {import('@playwright/test').Page} page
 * @param {string} email
 * @param {string} password
 */
export async function loginViaUI(page, email, password) {
  await openAuthModal(page, 'signin');

  // Fill in login form
  await page.fill(UI.auth.emailInput, email);
  await page.fill(UI.auth.passwordInput, password);

  // Submit login
  await page.click(UI.auth.submitButton);

  // Wait for modal to close and sidebar to appear
  await page.waitForSelector(UI.app.sidebar, { timeout: 10000 });
}

/**
 * Login helper - logs in a user via API and sets tokens
 * @param {import('@playwright/test').Page} page
 * @param {string} email
 * @param {string} password
 */
export async function loginViaAPI(page, email, password) {
  const response = await page.request.post(`${API_BASE_URL}${API_ENDPOINTS.login}`, {
    data: { email, password },
  });

  if (!response.ok()) {
    throw new Error(`Login failed: ${response.status()}`);
  }

  const data = await response.json();

  // Set tokens in localStorage using the app's actual key names
  await page.evaluate(({ accessToken, refreshToken, user }) => {
    localStorage.setItem('decideplease_access_token', accessToken);
    localStorage.setItem('decideplease_refresh_token', refreshToken);
    localStorage.setItem('decideplease_user', JSON.stringify(user));
  }, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    user: data.user,
  });
}

/**
 * Logout helper
 * @param {import('@playwright/test').Page} page
 */
export async function logout(page) {
  await page.evaluate(() => {
    localStorage.removeItem('decideplease_access_token');
    localStorage.removeItem('decideplease_refresh_token');
    localStorage.removeItem('decideplease_user');
  });
  await page.reload();
}

/**
 * Check if user is logged in
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>}
 */
export async function isLoggedIn(page) {
  return await page.evaluate(() => {
    return !!localStorage.getItem('decideplease_access_token');
  });
}

/**
 * Get all links on the current page
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>}
 */
export async function getAllLinks(page) {
  return await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href]'));
    return links.map(link => link.getAttribute('href')).filter(Boolean);
  });
}

/**
 * Collect console errors during test
 * @param {import('@playwright/test').Page} page
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function collectConsoleMessages(page) {
  const errors = [];
  const warnings = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    } else if (msg.type() === 'warning') {
      warnings.push(msg.text());
    }
  });

  page.on('pageerror', error => {
    errors.push(error.message);
  });

  return { errors, warnings };
}

/**
 * Filter out expected console errors (like 401 from auth tests)
 * @param {string[]} errors
 * @returns {string[]}
 */
export function filterExpectedErrors(errors) {
  const expectedPatterns = [
    /401/, // Auth failures in tests
    /403/, // Permission errors in tests
    /Failed to fetch/, // Network errors in offline tests
    /NetworkError/, // Network simulation
    /rate limit/i, // Rate limiting
  ];

  return errors.filter(error => {
    return !expectedPatterns.some(pattern => pattern.test(error));
  });
}

/**
 * Check if an element is in viewport
 * @param {import('@playwright/test').Locator} locator
 * @returns {Promise<boolean>}
 */
export async function isInViewport(locator) {
  return await locator.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth
    );
  });
}

/**
 * Get page load performance metrics
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<object>}
 */
export async function getPerformanceMetrics(page) {
  return await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');

    const fcp = paint.find(p => p.name === 'first-contentful-paint');

    return {
      loadTime: navigation ? navigation.loadEventEnd - navigation.startTime : null,
      domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.startTime : null,
      firstContentfulPaint: fcp ? fcp.startTime : null,
    };
  });
}

/**
 * Test data generators
 */
export const TestData = {
  // Valid inputs
  validEmail: () => generateTestEmail(),
  validPassword: () => generateTestPassword(),
  validName: () => `Test User ${Date.now()}`,

  // Invalid inputs for negative testing
  invalidEmails: [
    '',
    'notanemail',
    '@nodomain.com',
    'no@domain',
    'spaces in@email.com',
    'missing@.com',
  ],

  invalidPasswords: [
    '',
    'short',
    '1234567', // 7 chars, needs 8
  ],

  // Edge cases
  edgeCaseInputs: [
    '   ', // whitespace only
    '<script>alert("xss")</script>', // XSS attempt
    "'; DROP TABLE users; --", // SQL injection attempt
    'a'.repeat(10001), // Very long input
    '🎉🚀💯', // Emojis
    '日本語テスト', // Unicode
    'Test\nWith\nNewlines',
    'Test\tWith\tTabs',
  ],

  // File upload test data
  fileTypes: {
    valid: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'],
    invalid: ['application/exe', 'text/javascript'],
  },
};
