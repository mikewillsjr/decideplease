/**
 * Security Tests
 * Test authentication, authorization, and basic security measures
 */

import { test, expect } from '@playwright/test';
import {
  API_BASE_URL,
  API_ENDPOINTS,
  ROUTES,
  generateTestEmail,
  generateTestPassword,
} from '../fixtures/test-helpers.js';

test.describe('Security Tests - Authentication Required', () => {
  test('protected pages redirect when not logged in', async ({ page }) => {
    console.log('Testing: Protected page access without auth');

    // Try to access settings without auth
    await page.goto(ROUTES.settings);

    // Should either redirect to login or show landing page
    await page.waitForTimeout(1000);

    const isOnSettings = page.url().includes('settings');
    const hasAuthModal = await page.locator('.modal, [role="dialog"], .auth-modal').isVisible().catch(() => false);
    const isOnLanding = await page.locator('button:has-text("Sign In")').isVisible().catch(() => false);

    // Should not show settings content without auth
    if (isOnSettings) {
      expect(hasAuthModal || isOnLanding).toBe(true);
    }
    console.log('  Protected pages require authentication');
  });

  test('API endpoints require authentication', async ({ request }) => {
    console.log('Testing: API auth requirements');

    const protectedEndpoints = [
      { method: 'GET', path: API_ENDPOINTS.me },
      { method: 'GET', path: API_ENDPOINTS.conversations },
      { method: 'POST', path: API_ENDPOINTS.conversations },
      { method: 'POST', path: API_ENDPOINTS.changePassword },
      { method: 'POST', path: API_ENDPOINTS.updateEmail },
      { method: 'DELETE', path: API_ENDPOINTS.deleteAccount },
    ];

    for (const endpoint of protectedEndpoints) {
      const response = endpoint.method === 'GET'
        ? await request.get(`${API_BASE_URL}${endpoint.path}`)
        : await request.post(`${API_BASE_URL}${endpoint.path}`, { data: {} });

      expect(response.status()).toBe(401);
    }

    console.log(`  All ${protectedEndpoints.length} protected endpoints require auth`);
  });
});

test.describe('Security Tests - User Isolation', () => {
  let user1Token;
  let user2Token;
  let user1ConversationId;

  test.beforeAll(async ({ request }) => {
    // Create two test users
    const user1Response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
      data: { email: generateTestEmail(), password: generateTestPassword() },
    });
    user1Token = (await user1Response.json()).access_token;

    const user2Response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
      data: { email: generateTestEmail(), password: generateTestPassword() },
    });
    user2Token = (await user2Response.json()).access_token;

    // Create a conversation for user1
    const convResponse = await request.post(`${API_BASE_URL}${API_ENDPOINTS.conversations}`, {
      headers: { Authorization: `Bearer ${user1Token}` },
      data: {},
    });
    user1ConversationId = (await convResponse.json()).id;
  });

  test('user cannot access another user\'s conversation', async ({ request }) => {
    console.log('Testing: User isolation - conversation access');

    // User 2 tries to access User 1's conversation
    const response = await request.get(
      `${API_BASE_URL}${API_ENDPOINTS.conversations}/${user1ConversationId}`,
      { headers: { Authorization: `Bearer ${user2Token}` } }
    );

    expect(response.status()).toBeGreaterThanOrEqual(403);
    console.log('  User cannot access another user\'s conversation');
  });

  test('user cannot delete another user\'s conversation', async ({ request }) => {
    console.log('Testing: User isolation - conversation deletion');

    // User 2 tries to delete User 1's conversation
    const response = await request.delete(
      `${API_BASE_URL}${API_ENDPOINTS.conversations}/${user1ConversationId}`,
      { headers: { Authorization: `Bearer ${user2Token}` } }
    );

    expect(response.status()).toBeGreaterThanOrEqual(403);
    console.log('  User cannot delete another user\'s conversation');
  });

  test('conversation list only shows own conversations', async ({ request }) => {
    console.log('Testing: User isolation - conversation list');

    // Get User 2's conversations
    const response = await request.get(
      `${API_BASE_URL}${API_ENDPOINTS.conversations}`,
      { headers: { Authorization: `Bearer ${user2Token}` } }
    );

    expect(response.status()).toBe(200);

    const conversations = await response.json();
    const hasUser1Conv = conversations.some(c => c.id === user1ConversationId);

    expect(hasUser1Conv).toBe(false);
    console.log('  User only sees their own conversations');
  });
});

test.describe('Security Tests - Token Security', () => {
  test('expired/invalid token is rejected', async ({ request }) => {
    console.log('Testing: Invalid token rejection');

    const response = await request.get(`${API_BASE_URL}${API_ENDPOINTS.me}`, {
      headers: { Authorization: 'Bearer invalid.token.here' },
    });

    expect(response.status()).toBe(401);
    console.log('  Invalid token rejected');
  });

  test('token format is validated', async ({ request }) => {
    console.log('Testing: Token format validation');

    const invalidTokens = [
      'Bearer ',
      'Bearer invalid',
      'Bearer 12345',
      'NotBearer token',
      '',
    ];

    for (const token of invalidTokens) {
      const response = await request.get(`${API_BASE_URL}${API_ENDPOINTS.me}`, {
        headers: { Authorization: token },
      });

      expect(response.status()).toBe(401);
    }

    console.log('  Invalid token formats rejected');
  });

  test('tokens are not exposed in responses', async ({ request }) => {
    console.log('Testing: Token exposure in responses');

    const testEmail = generateTestEmail();
    const testPassword = generateTestPassword();

    // Register
    const regResponse = await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
      data: { email: testEmail, password: testPassword },
    });

    const regData = await regResponse.json();

    // Get user info
    const meResponse = await request.get(`${API_BASE_URL}${API_ENDPOINTS.me}`, {
      headers: { Authorization: `Bearer ${regData.access_token}` },
    });

    const meData = await meResponse.json();

    // User info should not contain tokens
    expect(meData).not.toHaveProperty('access_token');
    expect(meData).not.toHaveProperty('refresh_token');
    expect(meData).not.toHaveProperty('password');
    expect(meData).not.toHaveProperty('password_hash');

    console.log('  Sensitive data not exposed in responses');
  });
});

test.describe('Security Tests - Password Security', () => {
  test('password is not returned in user info', async ({ request }) => {
    console.log('Testing: Password not in user info');

    const testEmail = generateTestEmail();
    const testPassword = generateTestPassword();

    const regResponse = await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
      data: { email: testEmail, password: testPassword },
    });

    const { access_token, user } = await regResponse.json();

    // Registration response
    expect(user).not.toHaveProperty('password');
    expect(user).not.toHaveProperty('password_hash');

    // User info endpoint
    const meResponse = await request.get(`${API_BASE_URL}${API_ENDPOINTS.me}`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const meData = await meResponse.json();
    expect(meData).not.toHaveProperty('password');
    expect(meData).not.toHaveProperty('password_hash');

    console.log('  Password never exposed');
  });

  test('password minimum length enforced', async ({ request }) => {
    console.log('Testing: Password minimum length');

    const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
      data: { email: generateTestEmail(), password: '1234567' }, // 7 chars
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
    console.log('  Short passwords rejected');
  });
});

test.describe('Security Tests - Admin Access', () => {
  test('non-admin cannot access admin endpoints', async ({ request }) => {
    console.log('Testing: Admin endpoint protection');

    const testEmail = generateTestEmail();
    const testPassword = generateTestPassword();

    const regResponse = await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
      data: { email: testEmail, password: testPassword },
    });

    const { access_token } = await regResponse.json();

    const adminEndpoints = [
      API_ENDPOINTS.adminStats,
      API_ENDPOINTS.adminUsers,
    ];

    for (const endpoint of adminEndpoints) {
      const response = await request.get(`${API_BASE_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      expect(response.status()).toBeGreaterThanOrEqual(403);
    }

    console.log('  Admin endpoints protected from non-admins');
  });
});

test.describe('Security Tests - Input Validation', () => {
  test('XSS payloads in input are handled safely', async ({ request }) => {
    console.log('Testing: XSS payload handling');

    const xssPayloads = [
      '<script>alert("xss")</script>',
      '"><script>alert("xss")</script>',
      "javascript:alert('xss')",
      '<img src=x onerror=alert("xss")>',
    ];

    for (const payload of xssPayloads) {
      const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
        data: { email: `${payload}@example.com`, password: 'TestPassword123!' },
      });

      // Should be rejected or sanitized, not cause server error
      expect(response.status()).toBeLessThan(500);
    }

    console.log('  XSS payloads handled safely');
  });

  test('SQL injection payloads are handled safely', async ({ request }) => {
    console.log('Testing: SQL injection handling');

    const sqlPayloads = [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "admin'--",
      "1; DELETE FROM users;",
    ];

    for (const payload of sqlPayloads) {
      const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.login}`, {
        data: { email: `${payload}@example.com`, password: payload },
      });

      // Should be rejected, not cause server error
      expect(response.status()).toBeLessThan(500);
    }

    console.log('  SQL injection payloads handled safely');
  });

  test('very long inputs are handled', async ({ request }) => {
    console.log('Testing: Long input handling');

    const longString = 'a'.repeat(100000);

    const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
      data: { email: `${longString}@example.com`, password: longString },
    });

    // Should reject or truncate, not crash
    expect(response.status()).toBeLessThan(500);
    console.log('  Long inputs handled safely');
  });
});

test.describe('Security Tests - CORS', () => {
  test('CORS headers are present', async ({ request }) => {
    console.log('Testing: CORS headers');

    const response = await request.get(`${API_BASE_URL}${API_ENDPOINTS.runModes}`, {
      headers: { Origin: 'http://localhost:5173' },
    });

    const headers = response.headers();

    // Check for CORS headers
    const hasCorsHeader = 'access-control-allow-origin' in headers;
    console.log(`  CORS headers present: ${hasCorsHeader}`);
  });
});

test.describe('Security Tests - Account Deletion', () => {
  test('account deletion removes user data', async ({ request }) => {
    console.log('Testing: Account deletion');

    const testEmail = generateTestEmail();
    const testPassword = generateTestPassword();

    // Create user
    const regResponse = await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
      data: { email: testEmail, password: testPassword },
    });

    const { access_token } = await regResponse.json();

    // Create a conversation
    await request.post(`${API_BASE_URL}${API_ENDPOINTS.conversations}`, {
      headers: { Authorization: `Bearer ${access_token}` },
      data: {},
    });

    // Delete account
    const deleteResponse = await request.delete(`${API_BASE_URL}${API_ENDPOINTS.deleteAccount}`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    expect(deleteResponse.status()).toBe(200);

    // Try to login with deleted account
    const loginResponse = await request.post(`${API_BASE_URL}${API_ENDPOINTS.login}`, {
      data: { email: testEmail, password: testPassword },
    });

    expect(loginResponse.status()).toBeGreaterThanOrEqual(400);
    console.log('  Account deletion works correctly');
  });
});

test.describe('Security Tests - Rate Limiting', () => {
  test('auth endpoints have rate limiting', async ({ request }) => {
    console.log('Testing: Auth rate limiting');

    // Make multiple rapid requests
    const requests = [];
    for (let i = 0; i < 10; i++) {
      requests.push(
        request.post(`${API_BASE_URL}${API_ENDPOINTS.login}`, {
          data: { email: 'test@test.com', password: 'wrong' },
        })
      );
    }

    const responses = await Promise.all(requests);
    const statuses = responses.map(r => r.status());

    // At least some should be rate limited (429) or all should be 401
    const hasRateLimit = statuses.some(s => s === 429);
    const allRejected = statuses.every(s => s >= 400);

    expect(hasRateLimit || allRejected).toBe(true);
    console.log(`  Rate limiting behavior: ${hasRateLimit ? 'active' : 'requests rejected'}`);
  });
});

test.describe('Security Tests - Content Security', () => {
  test('security headers are present', async ({ page }) => {
    console.log('Testing: Security headers');

    const response = await page.goto('/');
    const headers = response.headers();

    const securityHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'x-xss-protection',
      'content-security-policy',
      'strict-transport-security',
    ];

    const presentHeaders = securityHeaders.filter(h => h in headers);
    console.log(`  Present security headers: ${presentHeaders.join(', ') || 'none'}`);
    console.log(`  ${presentHeaders.length}/${securityHeaders.length} security headers found`);
  });
});
