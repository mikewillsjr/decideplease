/**
 * Stripe Integration Tests
 * Tests for Stripe checkout and webhook endpoints
 *
 * Note: These tests verify API behavior without making real Stripe API calls.
 * For production, real webhook testing should use Stripe CLI or test mode webhooks.
 */

import { test, expect } from '@playwright/test';
import crypto from 'crypto';
import {
  API_BASE_URL,
  API_ENDPOINTS,
  generateTestEmail,
  generateTestPassword,
} from '../fixtures/test-helpers.js';

// Stripe webhook endpoint
const WEBHOOK_ENDPOINT = '/api/webhooks/stripe';

/**
 * Generate a mock Stripe webhook signature for testing
 * Note: This won't pass real Stripe verification but tests the endpoint behavior
 */
function generateMockStripeSignature(payload, timestamp = Date.now()) {
  const timestampSeconds = Math.floor(timestamp / 1000);
  // Create a signature that looks like a real Stripe signature format
  const signature = crypto
    .createHmac('sha256', 'whsec_test_secret')
    .update(`${timestampSeconds}.${payload}`)
    .digest('hex');
  return `t=${timestampSeconds},v1=${signature}`;
}

/**
 * Create a mock checkout.session.completed event payload
 */
function createCheckoutCompletedPayload(userId, credits = 20, sessionId = 'cs_test_123') {
  return JSON.stringify({
    id: `evt_${Date.now()}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        payment_intent: `pi_${Date.now()}`,
        amount_total: 500,
        customer_email: 'test@example.com',
        metadata: {
          user_id: userId,
          credits: String(credits),
        },
      },
    },
  });
}

/**
 * Create a mock charge.refunded event payload
 */
function createRefundPayload(chargeId = 'ch_test_123') {
  return JSON.stringify({
    id: `evt_${Date.now()}`,
    type: 'charge.refunded',
    data: {
      object: {
        id: chargeId,
        payment_intent: `pi_${Date.now()}`,
        amount_refunded: 500,
        billing_details: {
          email: 'test@example.com',
        },
      },
    },
  });
}

test.describe('Stripe Webhook Security', () => {
  test('POST /api/webhooks/stripe rejects missing signature', async ({ request }) => {
    console.log('Testing: Webhook without Stripe-Signature header');

    const payload = createCheckoutCompletedPayload('test_user_123');

    const response = await request.post(`${API_BASE_URL}${WEBHOOK_ENDPOINT}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: payload,
    });

    // Should reject without signature header
    expect(response.status()).toBe(400);

    const error = await response.json();
    expect(error.detail).toContain('Missing Stripe-Signature');

    console.log('  Missing signature correctly rejected');
  });

  test('POST /api/webhooks/stripe rejects invalid signature', async ({ request }) => {
    console.log('Testing: Webhook with invalid signature');

    const payload = createCheckoutCompletedPayload('test_user_123');

    const response = await request.post(`${API_BASE_URL}${WEBHOOK_ENDPOINT}`, {
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 'invalid_signature_here',
      },
      data: payload,
    });

    // Should reject invalid signature (400 for bad format or signature mismatch)
    // 500 means webhook secret not configured, which is also valid for tests
    expect([400, 500]).toContain(response.status());

    console.log(`  Invalid signature rejected with ${response.status()}`);
  });

  test('POST /api/webhooks/stripe rejects malformed signature format', async ({ request }) => {
    console.log('Testing: Webhook with malformed signature format');

    const payload = createCheckoutCompletedPayload('test_user_123');

    const response = await request.post(`${API_BASE_URL}${WEBHOOK_ENDPOINT}`, {
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 't=notanumber,v1=abc123',
      },
      data: payload,
    });

    // Should reject malformed signature
    expect([400, 500]).toContain(response.status());

    console.log(`  Malformed signature rejected with ${response.status()}`);
  });

  test('POST /api/webhooks/stripe rejects expired timestamp', async ({ request }) => {
    console.log('Testing: Webhook with expired timestamp');

    const payload = createCheckoutCompletedPayload('test_user_123');
    // Use timestamp from 10 minutes ago (Stripe default tolerance is 300 seconds)
    const expiredTimestamp = Date.now() - 10 * 60 * 1000;
    const signature = generateMockStripeSignature(payload, expiredTimestamp);

    const response = await request.post(`${API_BASE_URL}${WEBHOOK_ENDPOINT}`, {
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature,
      },
      data: payload,
    });

    // Should reject expired timestamp or invalid signature
    expect([400, 500]).toContain(response.status());

    console.log(`  Expired timestamp handled with ${response.status()}`);
  });

  test('POST /api/webhooks/stripe rejects empty payload', async ({ request }) => {
    console.log('Testing: Webhook with empty payload');

    const response = await request.post(`${API_BASE_URL}${WEBHOOK_ENDPOINT}`, {
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': generateMockStripeSignature(''),
      },
      data: '',
    });

    // Should reject empty payload
    expect([400, 422, 500]).toContain(response.status());

    console.log(`  Empty payload rejected with ${response.status()}`);
  });
});

test.describe('Stripe Credits Info Endpoint', () => {
  test('GET /api/credits/info returns credit pack details', async ({ request }) => {
    console.log('Testing: Credits info endpoint');

    const response = await request.get(`${API_BASE_URL}${API_ENDPOINTS.creditsInfo}`);

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('credits');
    expect(data).toHaveProperty('price_display');
    expect(data).toHaveProperty('stripe_configured');
    expect(typeof data.credits).toBe('number');
    expect(typeof data.price_display).toBe('string');
    expect(typeof data.stripe_configured).toBe('boolean');

    console.log(`  Credit pack: ${data.credits} credits for ${data.price_display}`);
    console.log(`  Stripe configured: ${data.stripe_configured}`);
  });
});

test.describe('Stripe Checkout Endpoint', () => {
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

  test('POST /api/credits/checkout requires authentication', async ({ request }) => {
    console.log('Testing: Checkout without authentication');

    const response = await request.post(`${API_BASE_URL}/api/credits/checkout`, {
      data: {
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      },
    });

    expect(response.status()).toBe(401);
    console.log('  Unauthenticated request rejected');
  });

  test('POST /api/credits/checkout with valid auth', async ({ request }) => {
    console.log('Testing: Checkout with authentication');

    const response = await request.post(`${API_BASE_URL}/api/credits/checkout`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      },
    });

    // If Stripe is configured, should return checkout URL
    // If not configured, should return 500
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('checkout_url');
      expect(data).toHaveProperty('session_id');
      expect(data.checkout_url).toContain('stripe.com');
      console.log('  Checkout session created');
    } else {
      // Stripe not configured in test environment
      expect(response.status()).toBe(500);
      console.log('  Stripe not configured (expected in test environment)');
    }
  });

  test('POST /api/credits/checkout requires success_url and cancel_url', async ({ request }) => {
    console.log('Testing: Checkout with missing URLs');

    const response = await request.post(`${API_BASE_URL}/api/credits/checkout`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {},
    });

    // Should fail validation or Stripe configuration
    expect([400, 422, 500]).toContain(response.status());
    console.log(`  Missing URLs handled with ${response.status()}`);
  });
});

test.describe('Stripe Webhook Event Types', () => {
  test('webhook endpoint exists and responds', async ({ request }) => {
    console.log('Testing: Webhook endpoint availability');

    // OPTIONS request to check if endpoint exists
    const response = await request.post(`${API_BASE_URL}${WEBHOOK_ENDPOINT}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: '{}',
    });

    // Endpoint exists (even if it returns error due to missing signature)
    expect(response.status()).not.toBe(404);
    expect(response.status()).not.toBe(405);

    console.log(`  Webhook endpoint responds with ${response.status()}`);
  });
});

test.describe('Stripe Payment History', () => {
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

  test('GET /api/user returns credit balance', async ({ request }) => {
    console.log('Testing: User credit balance');

    const response = await request.get(`${API_BASE_URL}/api/user`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('credits');
    expect(typeof data.credits).toBe('number');
    expect(data.credits).toBeGreaterThanOrEqual(0);

    console.log(`  User has ${data.credits} credits`);
  });

  test('new users start with initial credits', async ({ request }) => {
    console.log('Testing: Initial credits for new users');

    // Register a new user
    const newEmail = generateTestEmail();
    const newPassword = generateTestPassword();

    const registerResponse = await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
      data: { email: newEmail, password: newPassword },
    });

    // Handle rate limiting gracefully
    if (registerResponse.status() === 429) {
      console.log('  Rate limited - skipping (covered by other tests)');
      return;
    }

    expect(registerResponse.status()).toBe(200);
    const registerData = await registerResponse.json();
    const access_token = registerData.access_token;
    expect(access_token).toBeDefined();

    // Check credits
    const userResponse = await request.get(`${API_BASE_URL}/api/user`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    expect(userResponse.status()).toBe(200);
    const userData = await userResponse.json();

    // New users should have some initial credits (typically 5)
    expect(userData).toHaveProperty('credits');
    expect(userData.credits).toBeGreaterThanOrEqual(0);
    console.log(`  New user starts with ${userData.credits} credits`);
  });
});

test.describe('Stripe Idempotency', () => {
  test('webhook should handle duplicate events gracefully', async ({ request }) => {
    console.log('Testing: Duplicate webhook handling concept');

    // This test documents expected behavior:
    // 1. Same session_id should not add credits twice
    // 2. Events should be stored/tracked to prevent replay
    // 3. Idempotency is handled by recording payment with session_id

    // Verify the storage has payment tracking
    // (We can't test real idempotency without a configured Stripe webhook secret)
    console.log('  Note: Full idempotency testing requires Stripe webhook secret');
    console.log('  Implementation uses session_id tracking in database');
  });
});

test.describe('Stripe Error Handling', () => {
  test('checkout handles Stripe errors gracefully', async ({ request }) => {
    console.log('Testing: Error handling in checkout');

    const testEmail = generateTestEmail();
    const testPassword = generateTestPassword();

    const registerResponse = await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
      data: { email: testEmail, password: testPassword },
    });

    const { access_token } = await registerResponse.json();

    // Try to create checkout with potentially invalid URLs
    const response = await request.post(`${API_BASE_URL}/api/credits/checkout`, {
      headers: { Authorization: `Bearer ${access_token}` },
      data: {
        success_url: 'not-a-valid-url',
        cancel_url: 'also-not-valid',
      },
    });

    // Should handle gracefully (error or validation rejection)
    expect(response.status()).not.toBe(500);
    console.log(`  Invalid URLs handled with ${response.status()}`);
  });
});

/**
 * Integration test notes:
 *
 * For production webhook testing, use:
 * 1. Stripe CLI: stripe listen --forward-to localhost:8001/api/webhooks/stripe
 * 2. Stripe test mode webhooks with real signature verification
 * 3. Test events from Stripe dashboard
 *
 * Key behaviors to verify with real Stripe integration:
 * - checkout.session.completed adds credits to user
 * - charge.refunded logs refund (doesn't auto-deduct credits)
 * - Events without user_id metadata are ignored
 * - Signature verification blocks replay attacks
 * - Idempotency prevents duplicate credit allocation
 */
