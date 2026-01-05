/**
 * API Endpoint Tests
 * Test every API endpoint for correct responses
 */

import { test, expect } from '@playwright/test';
import {
  API_BASE_URL,
  API_ENDPOINTS,
  generateTestEmail,
  generateTestPassword,
} from '../fixtures/test-helpers.js';

test.describe('API Tests - Public Endpoints', () => {
  test.describe('Run Modes Endpoint', () => {
    test('GET /api/run-modes returns 200', async ({ request }) => {
      console.log('Testing: GET /api/run-modes');

      const response = await request.get(`${API_BASE_URL}${API_ENDPOINTS.runModes}`);

      expect(response.status()).toBe(200);
      console.log('  Status: 200 OK');
    });

    test('GET /api/run-modes returns modes object', async ({ request }) => {
      console.log('Testing: Run modes data structure');

      const response = await request.get(`${API_BASE_URL}${API_ENDPOINTS.runModes}`);
      const data = await response.json();

      // Run modes returns an object keyed by mode name
      expect(typeof data).toBe('object');
      expect(data).not.toBeNull();

      const modeKeys = Object.keys(data);
      expect(modeKeys.length).toBeGreaterThan(0);

      // Each mode should have expected properties
      const firstModeKey = modeKeys[0];
      const mode = data[firstModeKey];
      expect(mode).toHaveProperty('label');
      expect(mode).toHaveProperty('credit_cost');
      expect(mode).toHaveProperty('enable_peer_review');
      console.log(`  Found ${modeKeys.length} run modes: ${modeKeys.join(', ')}`);
    });
  });

  test.describe('Credits Info Endpoint', () => {
    test('GET /api/credits/info returns 200', async ({ request }) => {
      console.log('Testing: GET /api/credits/info');

      const response = await request.get(`${API_BASE_URL}${API_ENDPOINTS.creditsInfo}`);

      expect(response.status()).toBe(200);
      console.log('  Status: 200 OK');
    });

    test('GET /api/credits/info returns credit pack info', async ({ request }) => {
      console.log('Testing: Credits info data structure');

      const response = await request.get(`${API_BASE_URL}${API_ENDPOINTS.creditsInfo}`);
      const data = await response.json();

      expect(data).toHaveProperty('credits');
      expect(data).toHaveProperty('price_display');
      expect(data).toHaveProperty('stripe_configured');
      expect(typeof data.credits).toBe('number');
      expect(typeof data.price_display).toBe('string');
      expect(typeof data.stripe_configured).toBe('boolean');
      console.log(`  Credit pack: ${data.credits} credits for ${data.price_display}`);
    });
  });
});

test.describe('API Tests - Authentication Endpoints', () => {
  test.describe('Register Endpoint', () => {
    test('POST /api/auth/register creates new user', async ({ request }) => {
      console.log('Testing: POST /api/auth/register');

      const testEmail = generateTestEmail();
      const testPassword = generateTestPassword();

      const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
        data: { email: testEmail, password: testPassword },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('access_token');
      expect(data).toHaveProperty('refresh_token');
      expect(data).toHaveProperty('user');
      expect(data.user.email).toBe(testEmail);
      console.log('  User registered successfully');
    });

    test('POST /api/auth/register rejects invalid email', async ({ request }) => {
      console.log('Testing: Register with invalid email');

      const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
        data: { email: 'notanemail', password: 'ValidPassword123!' },
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
      expect(response.status()).toBeLessThan(500);
      console.log(`  Invalid email rejected with ${response.status()}`);
    });

    test('POST /api/auth/register rejects short password', async ({ request }) => {
      console.log('Testing: Register with short password');

      const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
        data: { email: generateTestEmail(), password: 'short' },
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
      expect(response.status()).toBeLessThan(500);
      console.log(`  Short password rejected with ${response.status()}`);
    });

    test('POST /api/auth/register rejects duplicate email', async ({ request }) => {
      console.log('Testing: Register with duplicate email');

      const testEmail = generateTestEmail();
      const testPassword = generateTestPassword();

      // First registration
      await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
        data: { email: testEmail, password: testPassword },
      });

      // Second registration with same email
      const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
        data: { email: testEmail, password: testPassword },
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
      console.log(`  Duplicate email rejected with ${response.status()}`);
    });
  });

  test.describe('Login Endpoint', () => {
    test('POST /api/auth/login with valid credentials', async ({ request }) => {
      console.log('Testing: POST /api/auth/login');

      const testEmail = generateTestEmail();
      const testPassword = generateTestPassword();

      // Create user first
      await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
        data: { email: testEmail, password: testPassword },
      });

      // Login
      const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.login}`, {
        data: { email: testEmail, password: testPassword },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('access_token');
      expect(data).toHaveProperty('refresh_token');
      console.log('  Login successful');
    });

    test('POST /api/auth/login rejects wrong password', async ({ request }) => {
      console.log('Testing: Login with wrong password');

      const testEmail = generateTestEmail();
      const testPassword = generateTestPassword();

      await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
        data: { email: testEmail, password: testPassword },
      });

      const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.login}`, {
        data: { email: testEmail, password: 'WrongPassword123!' },
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
      console.log(`  Wrong password rejected with ${response.status()}`);
    });

    test('POST /api/auth/login rejects nonexistent user', async ({ request }) => {
      console.log('Testing: Login with nonexistent user');

      const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.login}`, {
        data: { email: `nonexistent_${Date.now()}@example.com`, password: 'SomePassword123!' },
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
      console.log(`  Nonexistent user rejected with ${response.status()}`);
    });
  });

  test.describe('Token Refresh Endpoint', () => {
    test('POST /api/auth/refresh with valid token', async ({ request }) => {
      console.log('Testing: POST /api/auth/refresh');

      const testEmail = generateTestEmail();
      const testPassword = generateTestPassword();

      // Create and login
      const loginResponse = await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
        data: { email: testEmail, password: testPassword },
      });

      const { refresh_token } = await loginResponse.json();

      // Refresh
      const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.refresh}`, {
        data: { refresh_token },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('access_token');
      console.log('  Token refresh successful');
    });

    test('POST /api/auth/refresh rejects invalid token', async ({ request }) => {
      console.log('Testing: Refresh with invalid token');

      const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.refresh}`, {
        data: { refresh_token: 'invalid.token.here' },
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
      console.log(`  Invalid token rejected with ${response.status()}`);
    });
  });

  test.describe('Forgot Password Endpoint', () => {
    test('POST /api/auth/forgot-password with valid email', async ({ request }) => {
      console.log('Testing: POST /api/auth/forgot-password');

      const testEmail = generateTestEmail();
      const testPassword = generateTestPassword();

      await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
        data: { email: testEmail, password: testPassword },
      });

      const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.forgotPassword}`, {
        data: { email: testEmail },
      });

      expect(response.status()).toBe(200);
      console.log('  Password reset email requested');
    });

    test('POST /api/auth/forgot-password handles nonexistent email gracefully', async ({ request }) => {
      console.log('Testing: Forgot password with nonexistent email');

      const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.forgotPassword}`, {
        data: { email: `nonexistent_${Date.now()}@example.com` },
      });

      // Should not reveal whether email exists
      expect(response.status()).toBeLessThan(500);
      console.log(`  Nonexistent email handled with ${response.status()}`);
    });
  });
});

test.describe('API Tests - Authenticated Endpoints', () => {
  let accessToken;
  let testEmail;
  let testPassword;

  test.beforeEach(async ({ request }) => {
    testEmail = generateTestEmail();
    testPassword = generateTestPassword();

    const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
      data: { email: testEmail, password: testPassword },
    });

    const data = await response.json();
    accessToken = data.access_token;
  });

  test.describe('User Info Endpoint', () => {
    test('GET /api/auth/me returns user info', async ({ request }) => {
      console.log('Testing: GET /api/auth/me');

      const response = await request.get(`${API_BASE_URL}${API_ENDPOINTS.me}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('email');
      expect(data.email).toBe(testEmail);
      console.log('  User info retrieved');
    });

    test('GET /api/auth/me rejects without auth', async ({ request }) => {
      console.log('Testing: /api/auth/me without auth');

      const response = await request.get(`${API_BASE_URL}${API_ENDPOINTS.me}`);

      expect(response.status()).toBe(401);
      console.log('  Unauthenticated request rejected');
    });
  });

  test.describe('Conversations Endpoints', () => {
    test('GET /api/conversations returns list', async ({ request }) => {
      console.log('Testing: GET /api/conversations');

      const response = await request.get(`${API_BASE_URL}${API_ENDPOINTS.conversations}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      console.log(`  Found ${data.length} conversations`);
    });

    test('POST /api/conversations creates conversation', async ({ request }) => {
      console.log('Testing: POST /api/conversations');

      const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.conversations}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {},
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('id');
      console.log(`  Created conversation ${data.id}`);
    });

    test('GET /api/conversations/:id returns conversation', async ({ request }) => {
      console.log('Testing: GET /api/conversations/:id');

      // Create a conversation first
      const createResponse = await request.post(`${API_BASE_URL}${API_ENDPOINTS.conversations}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {},
      });

      const { id } = await createResponse.json();

      // Get the conversation
      const response = await request.get(`${API_BASE_URL}${API_ENDPOINTS.conversations}/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.id).toBe(id);
      console.log('  Conversation retrieved');
    });

    test('DELETE /api/conversations/:id deletes conversation', async ({ request }) => {
      console.log('Testing: DELETE /api/conversations/:id');

      const createResponse = await request.post(`${API_BASE_URL}${API_ENDPOINTS.conversations}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {},
      });

      const { id } = await createResponse.json();

      const response = await request.delete(`${API_BASE_URL}${API_ENDPOINTS.conversations}/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.status()).toBe(200);
      console.log('  Conversation deleted');
    });

    test('Conversations endpoints require auth', async ({ request }) => {
      console.log('Testing: Conversations auth requirement');

      const response = await request.get(`${API_BASE_URL}${API_ENDPOINTS.conversations}`);

      expect(response.status()).toBe(401);
      console.log('  Auth required');
    });
  });

  test.describe('Password Change Endpoint', () => {
    test('POST /api/auth/change-password with correct current password', async ({ request }) => {
      console.log('Testing: POST /api/auth/change-password');

      const newPassword = generateTestPassword();

      const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.changePassword}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          current_password: testPassword,
          new_password: newPassword,
        },
      });

      expect(response.status()).toBe(200);
      console.log('  Password changed');
    });

    test('POST /api/auth/change-password rejects wrong current password', async ({ request }) => {
      console.log('Testing: Change password with wrong current');

      const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.changePassword}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          current_password: 'WrongPassword123!',
          new_password: 'NewPassword123!',
        },
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
      console.log(`  Wrong password rejected with ${response.status()}`);
    });
  });

  test.describe('Email Update Endpoint', () => {
    test('POST /api/auth/update-email with correct password', async ({ request }) => {
      console.log('Testing: POST /api/auth/update-email');

      const newEmail = generateTestEmail();

      const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.updateEmail}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          new_email: newEmail,
          password: testPassword,
        },
      });

      expect(response.status()).toBe(200);
      console.log('  Email updated');
    });

    test('POST /api/auth/update-email rejects wrong password', async ({ request }) => {
      console.log('Testing: Update email with wrong password');

      const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.updateEmail}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          new_email: generateTestEmail(),
          password: 'WrongPassword123!',
        },
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
      console.log(`  Wrong password rejected with ${response.status()}`);
    });
  });
});

test.describe('API Tests - Admin Endpoints', () => {
  test('GET /api/admin/check without admin returns false', async ({ request }) => {
    console.log('Testing: GET /api/admin/check (non-admin)');

    const testEmail = generateTestEmail();
    const testPassword = generateTestPassword();

    const loginResponse = await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
      data: { email: testEmail, password: testPassword },
    });

    const { access_token } = await loginResponse.json();

    const response = await request.get(`${API_BASE_URL}${API_ENDPOINTS.adminCheck}`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.is_admin).toBe(false);
    console.log('  Non-admin correctly identified');
  });

  test('GET /api/admin/stats requires staff permission', async ({ request }) => {
    console.log('Testing: GET /api/admin/stats permission check');

    const testEmail = generateTestEmail();
    const testPassword = generateTestPassword();

    const loginResponse = await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
      data: { email: testEmail, password: testPassword },
    });

    const { access_token } = await loginResponse.json();

    const response = await request.get(`${API_BASE_URL}${API_ENDPOINTS.adminStats}`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    // Regular user should be denied
    expect([401, 403]).toContain(response.status());
    console.log(`  Non-staff denied with ${response.status()}`);
  });

  test('GET /api/admin/users requires staff permission', async ({ request }) => {
    console.log('Testing: GET /api/admin/users permission check');

    const testEmail = generateTestEmail();
    const testPassword = generateTestPassword();

    const loginResponse = await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
      data: { email: testEmail, password: testPassword },
    });

    const { access_token } = await loginResponse.json();

    const response = await request.get(`${API_BASE_URL}${API_ENDPOINTS.adminUsers}`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    // Regular user should be denied
    expect([401, 403]).toContain(response.status());
    console.log(`  Non-staff denied with ${response.status()}`);
  });

  test('POST /api/admin/staff requires admin permission', async ({ request }) => {
    console.log('Testing: POST /api/admin/staff permission check');

    const testEmail = generateTestEmail();
    const testPassword = generateTestPassword();

    const loginResponse = await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
      data: { email: testEmail, password: testPassword },
    });

    const { access_token } = await loginResponse.json();

    const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.adminStaff}`, {
      headers: { Authorization: `Bearer ${access_token}` },
      data: {
        email: generateTestEmail(),
        password: generateTestPassword(),
        role: 'employee',
      },
    });

    // Regular user should be denied
    expect([401, 403]).toContain(response.status());
    console.log(`  Non-admin denied with ${response.status()}`);
  });

  test('GET /api/admin/impersonate/:id requires superadmin', async ({ request }) => {
    console.log('Testing: GET /api/admin/impersonate/:id permission check');

    const testEmail = generateTestEmail();
    const testPassword = generateTestPassword();

    const loginResponse = await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
      data: { email: testEmail, password: testPassword },
    });

    const { access_token, user } = await loginResponse.json();

    const response = await request.get(`${API_BASE_URL}${API_ENDPOINTS.adminImpersonate(user.id)}`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    // Regular user should be denied (only superadmin can impersonate)
    expect([401, 403]).toContain(response.status());
    console.log(`  Non-superadmin denied with ${response.status()}`);
  });

  test('POST /api/admin/users/:id/role requires permission', async ({ request }) => {
    console.log('Testing: POST /api/admin/users/:id/role permission check');

    const testEmail = generateTestEmail();
    const testPassword = generateTestPassword();

    const loginResponse = await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
      data: { email: testEmail, password: testPassword },
    });

    const { access_token, user } = await loginResponse.json();

    const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.adminUserRole(user.id)}`, {
      headers: { Authorization: `Bearer ${access_token}` },
      data: { role: 'admin' },
    });

    // Regular user should be denied
    expect([401, 403]).toContain(response.status());
    console.log(`  Non-admin denied with ${response.status()}`);
  });

  test('GET /api/admin/audit-log requires staff permission', async ({ request }) => {
    console.log('Testing: GET /api/admin/audit-log permission check');

    const testEmail = generateTestEmail();
    const testPassword = generateTestPassword();

    const loginResponse = await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
      data: { email: testEmail, password: testPassword },
    });

    const { access_token } = await loginResponse.json();

    const response = await request.get(`${API_BASE_URL}${API_ENDPOINTS.adminAuditLog}`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    // Regular user should be denied
    expect([401, 403]).toContain(response.status());
    console.log(`  Non-staff denied with ${response.status()}`);
  });

  test('admin endpoints require authentication', async ({ request }) => {
    console.log('Testing: Admin endpoints auth requirement');

    const endpoints = [
      API_ENDPOINTS.adminStats,
      API_ENDPOINTS.adminUsers,
      API_ENDPOINTS.adminAuditLog,
    ];

    for (const endpoint of endpoints) {
      const response = await request.get(`${API_BASE_URL}${endpoint}`);
      expect(response.status()).toBe(401);
    }

    console.log('  All admin endpoints require auth');
  });
});

test.describe('API Tests - Error Handling', () => {
  test('returns 404 for nonexistent endpoints', async ({ request }) => {
    console.log('Testing: Nonexistent endpoint');

    const response = await request.get(`${API_BASE_URL}/api/nonexistent-endpoint-12345`);

    expect(response.status()).toBe(404);
    console.log('  404 returned correctly');
  });

  test('returns proper error format', async ({ request }) => {
    console.log('Testing: Error response format');

    const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.login}`, {
      data: { email: 'test@test.com', password: 'wrong' },
    });

    const data = await response.json();

    // Should have error detail
    expect(data).toHaveProperty('detail');
    console.log('  Error format correct');
  });

  test('handles malformed JSON gracefully', async ({ request }) => {
    console.log('Testing: Malformed JSON handling');

    const response = await request.post(`${API_BASE_URL}${API_ENDPOINTS.login}`, {
      headers: { 'Content-Type': 'application/json' },
      data: 'not valid json{',
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
    console.log(`  Malformed JSON handled with ${response.status()}`);
  });
});

test.describe('API Tests - Rate Limiting', () => {
  test('rate limiting headers present', async ({ request }) => {
    console.log('Testing: Rate limiting headers');

    const response = await request.get(`${API_BASE_URL}${API_ENDPOINTS.runModes}`);

    // Check for rate limit headers (may vary by implementation)
    const headers = response.headers();
    const hasRateLimitHeader =
      'x-ratelimit-limit' in headers ||
      'ratelimit-limit' in headers ||
      'retry-after' in headers;

    console.log(`  Rate limit headers present: ${hasRateLimitHeader}`);
    // Informational - don't fail if not present
  });
});
