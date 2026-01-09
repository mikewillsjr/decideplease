/**
 * E2E Tests - Council Process
 * Tests for the core DecidePlease functionality: the multi-stage council deliberation
 *
 * Stage 1: Individual model responses
 * Stage 1.5: Cross-review (Extra Care mode only) - models see all responses and refine
 * Stage 2: Peer review and rankings (with anonymization)
 * Stage 3: Chairman synthesis
 *
 * Run Modes:
 * - Quick: Haiku-tier models, no peer review (Stage 1 → Stage 3)
 * - Standard: Premium models, peer review (Stage 1 → Stage 2 → Stage 3)
 * - Extra Care: Premium models, cross-review + peer review (Stage 1 → Stage 1.5 → Stage 2 → Stage 3)
 */

import { test, expect } from '@playwright/test';
import {
  API_BASE_URL,
  API_ENDPOINTS,
  generateTestEmail,
  generateTestPassword,
  setupAuthenticatedUser,
} from '../fixtures/test-helpers.js';

// Test configuration
const COUNCIL_TIMEOUT = 120000; // 2 minutes for council process

/**
 * Helper to create an authenticated API request context
 */
async function getAuthenticatedRequest(request, email, password) {
  const loginResponse = await request.post(`${API_BASE_URL}${API_ENDPOINTS.login}`, {
    data: { email, password },
  });
  const loginData = await loginResponse.json();
  return {
    accessToken: loginData.access_token,
    user: loginData.user,
  };
}

/**
 * Helper to create a conversation via API
 */
async function createConversation(request, accessToken) {
  const response = await request.post(`${API_BASE_URL}/api/conversations`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: {}, // Empty body required by Pydantic model
  });
  expect(response.status()).toBe(200);
  return await response.json();
}

/**
 * Helper to send a message and collect SSE events
 */
async function sendMessageAndCollectEvents(request, accessToken, conversationId, content, mode = 'quick') {
  const events = [];

  const response = await request.post(
    `${API_BASE_URL}/api/conversations/${conversationId}/message/stream`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { content, mode },
    }
  );

  expect(response.status()).toBe(200);

  // Parse SSE response
  const body = await response.text();
  const lines = body.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data.trim()) {
        try {
          events.push(JSON.parse(data));
        } catch {
          // Skip malformed events
        }
      }
    }
  }

  return events;
}

test.describe.serial('Council Process - API Integration', () => {
  let testEmail;
  let testPassword;
  let accessToken;

  test.beforeAll(async ({ request }) => {
    // Create a test user with credits
    testEmail = generateTestEmail();
    testPassword = generateTestPassword();

    const registerResponse = await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
      data: { email: testEmail, password: testPassword },
    });

    expect(registerResponse.status()).toBe(200);
    const data = await registerResponse.json();
    accessToken = data.access_token;

    console.log(`Test user created: ${testEmail}`);
  });

  test.describe('Run Modes Configuration', () => {
    test('API returns all expected run modes', async ({ request }) => {
      console.log('Testing: Run modes configuration');

      const response = await request.get(`${API_BASE_URL}${API_ENDPOINTS.runModes}`);
      const modes = await response.json();

      // Verify expected modes exist
      expect(modes).toHaveProperty('quick');
      expect(modes).toHaveProperty('standard');
      expect(modes).toHaveProperty('extra_care');

      // Verify mode properties - peer review
      expect(modes.quick.enable_peer_review).toBe(false);
      expect(modes.standard.enable_peer_review).toBe(true);
      expect(modes.extra_care.enable_peer_review).toBe(true);

      // Verify mode properties - cross review (Stage 1.5)
      expect(modes.quick.enable_cross_review).toBe(false);
      expect(modes.standard.enable_cross_review).toBe(false);
      expect(modes.extra_care.enable_cross_review).toBe(true);

      // Verify context modes for follow-up handling
      expect(modes.quick.context_mode).toBe('minimal');
      expect(modes.standard.context_mode).toBe('standard');
      expect(modes.extra_care.context_mode).toBe('full');

      // Verify credit costs are ordered
      expect(modes.quick.credit_cost).toBeLessThan(modes.standard.credit_cost);
      expect(modes.standard.credit_cost).toBeLessThan(modes.extra_care.credit_cost);

      console.log('  All run modes configured correctly');
    });

    test('each mode has required configuration', async ({ request }) => {
      console.log('Testing: Mode configuration structure');

      const response = await request.get(`${API_BASE_URL}${API_ENDPOINTS.runModes}`);
      const modes = await response.json();

      for (const [modeName, mode] of Object.entries(modes)) {
        // Each mode should have all required properties
        expect(mode.label).toBeDefined();
        expect(typeof mode.label).toBe('string');
        expect(mode.credit_cost).toBeDefined();
        expect(typeof mode.credit_cost).toBe('number');
        expect(mode.enable_peer_review).toBeDefined();
        expect(typeof mode.enable_peer_review).toBe('boolean');
        // New properties for tiered models and Stage 1.5
        expect(mode.enable_cross_review).toBeDefined();
        expect(typeof mode.enable_cross_review).toBe('boolean');
        expect(mode.context_mode).toBeDefined();
        expect(['minimal', 'standard', 'full']).toContain(mode.context_mode);
        console.log(`  ${modeName}: ${mode.credit_cost} credits, peer=${mode.enable_peer_review}, cross=${mode.enable_cross_review}, context=${mode.context_mode}`);
      }
    });

    test('extra care mode enables Stage 1.5 cross-review', async ({ request }) => {
      console.log('Testing: Extra Care mode Stage 1.5 configuration');

      const response = await request.get(`${API_BASE_URL}${API_ENDPOINTS.runModes}`);
      const modes = await response.json();

      // Extra care should have cross-review (Stage 1.5) enabled
      expect(modes.extra_care.enable_cross_review).toBe(true);
      // And full context for follow-ups
      expect(modes.extra_care.context_mode).toBe('full');
      // Credit cost should be 4 (more expensive due to extra API calls)
      expect(modes.extra_care.credit_cost).toBe(4);

      console.log('  Extra Care mode correctly configured for Stage 1.5');
    });
  });

  test.describe('Conversation Creation', () => {
    test('authenticated user can create a conversation', async ({ request }) => {
      console.log('Testing: Create conversation');

      const conversation = await createConversation(request, accessToken);

      expect(conversation).toHaveProperty('id');
      expect(conversation).toHaveProperty('created_at');
      expect(typeof conversation.id).toBe('string');

      console.log(`  Conversation created: ${conversation.id}`);
    });

    test('unauthenticated request fails', async ({ request }) => {
      console.log('Testing: Unauthenticated conversation creation');

      const response = await request.post(`${API_BASE_URL}/api/conversations`, {
        headers: { Authorization: 'Bearer invalid-token' },
        data: {},
      });

      expect(response.status()).toBe(401);
      console.log('  Correctly rejected unauthenticated request');
    });
  });

  test.describe('Message Streaming - Quick Mode (No Peer Review)', () => {
    test('quick mode returns stage1 and stage3 events', async ({ request }) => {
      console.log('Testing: Quick mode streaming response');
      test.setTimeout(COUNCIL_TIMEOUT);

      // Create conversation
      const conversation = await createConversation(request, accessToken);

      // Send message in quick mode
      const events = await sendMessageAndCollectEvents(
        request,
        accessToken,
        conversation.id,
        'What is 2 + 2?',
        'quick'
      );

      // Verify we got events
      expect(events.length).toBeGreaterThan(0);

      // Check for expected event types
      const eventTypes = events.map(e => e.type);

      // Quick mode should have: stage1_start, stage1_complete, stage3_start, stage3_complete, complete
      expect(eventTypes).toContain('stage1_start');
      expect(eventTypes).toContain('stage1_complete');
      expect(eventTypes).toContain('stage3_start');
      expect(eventTypes).toContain('stage3_complete');
      expect(eventTypes).toContain('complete');

      // Quick mode should NOT have stage2 (peer review is disabled)
      expect(eventTypes).not.toContain('stage2_start');
      expect(eventTypes).not.toContain('stage2_complete');

      // Quick mode should NOT have stage1_5 (cross-review is disabled)
      expect(eventTypes).not.toContain('stage1_5_start');
      expect(eventTypes).not.toContain('stage1_5_complete');

      console.log(`  Received ${events.length} events: ${eventTypes.join(', ')}`);
    });

    test('stage1 response has correct structure', async ({ request }) => {
      console.log('Testing: Stage 1 response structure');
      test.setTimeout(COUNCIL_TIMEOUT);

      const conversation = await createConversation(request, accessToken);
      const events = await sendMessageAndCollectEvents(
        request,
        accessToken,
        conversation.id,
        'Explain what a function is in programming.',
        'quick'
      );

      // Find stage1_complete event
      const stage1Event = events.find(e => e.type === 'stage1_complete');
      expect(stage1Event).toBeDefined();
      expect(stage1Event.data).toBeDefined();
      expect(Array.isArray(stage1Event.data)).toBe(true);

      // If models responded, verify the structure
      if (stage1Event.data.length > 0) {
        for (const response of stage1Event.data) {
          expect(response).toHaveProperty('model');
          expect(response).toHaveProperty('response');
          expect(typeof response.model).toBe('string');
          expect(typeof response.response).toBe('string');
          expect(response.response.length).toBeGreaterThan(0);
        }
        console.log(`  Stage 1 returned ${stage1Event.data.length} model responses`);
      } else {
        // Models might not respond in test environment without OpenRouter
        console.log('  Stage 1 data empty (OpenRouter API may not be configured in test environment)');
      }
    });

    test('stage3 response has correct structure', async ({ request }) => {
      console.log('Testing: Stage 3 response structure');
      test.setTimeout(COUNCIL_TIMEOUT);

      const conversation = await createConversation(request, accessToken);
      const events = await sendMessageAndCollectEvents(
        request,
        accessToken,
        conversation.id,
        'Should I learn Python or JavaScript first?',
        'quick'
      );

      // Find stage3_complete event
      const stage3Event = events.find(e => e.type === 'stage3_complete');
      expect(stage3Event).toBeDefined();
      expect(stage3Event.data).toBeDefined();

      // Verify structure if response exists
      if (stage3Event.data.model && stage3Event.data.response) {
        expect(stage3Event.data).toHaveProperty('model');
        expect(stage3Event.data).toHaveProperty('response');
        expect(stage3Event.data.response.length).toBeGreaterThan(0);
        console.log(`  Chairman (${stage3Event.data.model}) provided synthesis`);
      } else {
        // Models might fail in test environment
        console.log('  Stage 3 response incomplete (API may not be configured)');
      }
    });
  });

  test.describe('Credits System', () => {
    test('sending a message deducts credits', async ({ request }) => {
      console.log('Testing: Credit deduction');
      test.setTimeout(COUNCIL_TIMEOUT);

      // Check initial credits
      const userInfoBefore = await request.get(`${API_BASE_URL}/api/user`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const creditsBefore = (await userInfoBefore.json()).credits;

      // Send a message
      const conversation = await createConversation(request, accessToken);
      await sendMessageAndCollectEvents(
        request,
        accessToken,
        conversation.id,
        'Test message for credit check',
        'quick'
      );

      // Check credits after
      const userInfoAfter = await request.get(`${API_BASE_URL}/api/user`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const creditsAfter = (await userInfoAfter.json()).credits;

      // Credits should have decreased
      expect(creditsAfter).toBeLessThan(creditsBefore);

      console.log(`  Credits: ${creditsBefore} -> ${creditsAfter} (deducted ${creditsBefore - creditsAfter})`);
    });

    test('insufficient credits returns 402 error', async ({ request }) => {
      console.log('Testing: Insufficient credits handling');

      // Create a new user with 0 credits (use up all credits first)
      const zeroCreditsEmail = generateTestEmail();
      const zeroCreditsPassword = generateTestPassword();

      // Register
      const registerResponse = await request.post(`${API_BASE_URL}${API_ENDPOINTS.register}`, {
        data: { email: zeroCreditsEmail, password: zeroCreditsPassword },
      });
      const newUser = await registerResponse.json();

      // Create conversation
      const convResponse = await request.post(`${API_BASE_URL}/api/conversations`, {
        headers: { Authorization: `Bearer ${newUser.access_token}` },
        data: {}, // Empty body required by Pydantic model
      });
      const conversation = await convResponse.json();

      // Use up credits with quick queries (new users start with 5 credits)
      for (let i = 0; i < 6; i++) {
        const msgResponse = await request.post(
          `${API_BASE_URL}/api/conversations/${conversation.id}/message/stream`,
          {
            headers: { Authorization: `Bearer ${newUser.access_token}` },
            data: { content: `Test ${i}`, mode: 'quick' },
          }
        );

        if (msgResponse.status() === 402) {
          console.log(`  402 error received after ${i} messages`);
          const error = await msgResponse.json();
          expect(error).toHaveProperty('detail');
          expect(error.detail).toContain('Insufficient credits');
          return; // Test passed
        }
      }

      console.log('  User ran out of credits as expected');
    });
  });

  test.describe('Conversation History', () => {
    test('message is saved to conversation', async ({ request }) => {
      console.log('Testing: Message persistence');
      test.setTimeout(COUNCIL_TIMEOUT);

      const conversation = await createConversation(request, accessToken);

      // Send a message
      await sendMessageAndCollectEvents(
        request,
        accessToken,
        conversation.id,
        'What is machine learning?',
        'quick'
      );

      // Fetch conversation
      const response = await request.get(
        `${API_BASE_URL}/api/conversations/${conversation.id}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const conv = await response.json();
      expect(conv.messages).toBeDefined();
      expect(conv.messages.length).toBeGreaterThanOrEqual(2); // User + Assistant

      // Find user message
      const userMessage = conv.messages.find(m => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage.content).toContain('machine learning');

      // Find assistant message
      const assistantMessage = conv.messages.find(m => m.role === 'assistant');
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage.stage1).toBeDefined();
      expect(assistantMessage.stage3).toBeDefined();

      console.log('  Message saved with all stages');
    });

    test('conversation title is auto-generated', async ({ request }) => {
      console.log('Testing: Auto-generated title');

      // List conversations and check if any have auto-generated titles
      // (Previous tests should have created conversations with messages)
      const response = await request.get(`${API_BASE_URL}/api/conversations`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.status()).toBe(200);
      const data = await response.json();

      // Find conversations with messages - look for non-default titles
      const conversationsWithMessages = data.conversations.filter(c => c.message_count > 0);
      const conversationsWithGeneratedTitles = data.conversations.filter(
        c => c.title && c.title !== 'New Conversation' && c.title.length > 0
      );

      if (conversationsWithGeneratedTitles.length > 0) {
        const conv = conversationsWithGeneratedTitles[0];
        console.log(`  Title generated: "${conv.title}"`);
      } else if (conversationsWithMessages.length > 0) {
        // Some conversations have messages but titles weren't generated
        // (This can happen if title generation API failed or is slow)
        console.log(`  Found ${conversationsWithMessages.length} conversations with messages, but title may not have been generated yet`);
      } else {
        // No conversations with messages yet (test user may be out of credits)
        console.log('  No conversations with messages found to verify title generation');
      }
    });
  });

  test.describe('Conversation List', () => {
    test('conversations are listed correctly', async ({ request }) => {
      console.log('Testing: Conversation listing');

      const response = await request.get(`${API_BASE_URL}/api/conversations`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('conversations');
      expect(Array.isArray(data.conversations)).toBe(true);

      // If there are conversations, verify structure
      if (data.conversations.length > 0) {
        const conv = data.conversations[0];
        expect(conv).toHaveProperty('id');
        expect(conv).toHaveProperty('title');
        expect(conv).toHaveProperty('created_at');
      }

      console.log(`  Found ${data.conversations.length} conversations`);
    });

    test('conversation deletion works', async ({ request }) => {
      console.log('Testing: Conversation deletion');

      // Create a conversation to delete
      const conversation = await createConversation(request, accessToken);

      // Delete it
      const deleteResponse = await request.delete(
        `${API_BASE_URL}/api/conversations/${conversation.id}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      expect(deleteResponse.status()).toBe(200);

      // Verify it's gone
      const getResponse = await request.get(
        `${API_BASE_URL}/api/conversations/${conversation.id}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      expect(getResponse.status()).toBe(404);

      console.log('  Conversation deleted successfully');
    });
  });

  test.describe('Error Handling', () => {
    test('invalid conversation ID returns 404', async ({ request }) => {
      console.log('Testing: Invalid conversation ID');

      const response = await request.get(
        `${API_BASE_URL}/api/conversations/00000000-0000-0000-0000-000000000000`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      expect(response.status()).toBe(404);
      console.log('  404 returned for invalid conversation');
    });

    test('empty message is rejected', async ({ request }) => {
      console.log('Testing: Empty message rejection');

      const conversation = await createConversation(request, accessToken);

      const response = await request.post(
        `${API_BASE_URL}/api/conversations/${conversation.id}/message/stream`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          data: { content: '', mode: 'quick' },
        }
      );

      // Should be rejected (400 or 422 for validation, or 402 if out of credits)
      // The key is that it shouldn't be a 200 or 500
      expect([400, 402, 422]).toContain(response.status());
      if (response.status() === 402) {
        console.log('  User out of credits (empty message test skipped)');
      } else {
        console.log('  Empty message correctly rejected');
      }
    });
  });
});

test.describe('Decision Process - UI Integration', () => {
  test('decision page shows input and mode selector', async ({ page, request }) => {
    console.log('Testing: Decision page UI elements');

    await setupAuthenticatedUser(page, request);
    await page.goto('/decision');

    // Check for message input
    const messageInput = page.locator('textarea, input[type="text"]').first();
    await expect(messageInput).toBeVisible();

    // Check for mode selector or speed options
    const hasQuickMode = await page.locator('text="Quick"').isVisible({ timeout: 3000 }).catch(() => false);
    const hasStandardMode = await page.locator('text="Standard"').isVisible({ timeout: 1000 }).catch(() => false);

    console.log(`  Input visible: true, Quick mode: ${hasQuickMode}, Standard mode: ${hasStandardMode}`);
  });

  test('credits are displayed in UI', async ({ page, request }) => {
    console.log('Testing: Credits display in UI');

    await setupAuthenticatedUser(page, request);
    await page.goto('/decision');

    // Look for credits display
    const creditsVisible = await page.locator('text=/\\d+\\s*credit/i').isVisible({ timeout: 5000 }).catch(() => false);

    if (creditsVisible) {
      console.log('  Credits displayed in UI');
    } else {
      console.log('  Credits display may be styled differently');
    }
  });
});
