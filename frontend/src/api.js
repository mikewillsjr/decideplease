/**
 * API client for the DecidePlease backend.
 */

// In production with same-domain routing, API_BASE can be empty (relative paths)
// In development, use localhost:8001
const API_BASE = import.meta.env.VITE_API_URL || '';

// Token getter - set by App.jsx when auth is ready
let getAuthToken = null;

export const setAuthTokenGetter = (getter) => {
  getAuthToken = getter;
};

/**
 * Check if an error is a transient network error that should be retried.
 */
const isRetryableError = (error) => {
  // Network errors (fetch failed completely)
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return true;
  }
  // Abort errors should not be retried
  if (error.name === 'AbortError') {
    return false;
  }
  // Generic network failure messages
  const retryableMessages = [
    'failed to fetch',
    'network error',
    'networkerror',
    'load failed',
    'net::',
  ];
  const msg = (error.message || '').toLowerCase();
  return retryableMessages.some(m => msg.includes(m));
};

/**
 * Retry a function with exponential backoff.
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} baseDelay - Base delay in ms (doubles each retry)
 * @returns {Promise<any>} Result of the function
 */
const withRetry = async (fn, maxRetries = 2, baseDelay = 1000) => {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      // Don't retry non-retryable errors
      if (!isRetryableError(error)) {
        throw error;
      }
      // Don't retry after last attempt
      if (attempt === maxRetries) {
        throw error;
      }
      // Wait before retrying (exponential backoff)
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`[API] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
};

/**
 * Get headers including auth token if available.
 */
const getHeaders = async () => {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (getAuthToken) {
    try {
      const token = await getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch {
      // Token retrieval failed - continue without auth header
    }
  }

  return headers;
};

export const api = {
  /**
   * Get current user information including credits.
   */
  async getUserInfo() {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/user`, { headers });
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Not authenticated');
      }
      throw new Error('Failed to get user info');
    }
    return response.json();
  },

  /**
   * List all conversations.
   */
  async listConversations() {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/conversations`, { headers });
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Not authenticated');
      }
      throw new Error('Failed to list conversations');
    }
    return response.json();
  },

  /**
   * Create a new conversation.
   */
  async createConversation() {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/conversations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Not authenticated');
      }
      throw new Error('Failed to create conversation');
    }
    return response.json();
  },

  /**
   * Get a specific conversation.
   */
  async getConversation(conversationId) {
    const headers = await getHeaders();
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}`,
      { headers }
    );
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Not authenticated');
      }
      throw new Error('Failed to get conversation');
    }
    return response.json();
  },

  /**
   * Delete a conversation.
   */
  async deleteConversation(conversationId) {
    const headers = await getHeaders();
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}`,
      {
        method: 'DELETE',
        headers,
      }
    );
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Not authenticated');
      }
      if (response.status === 404) {
        throw new Error('Conversation not found');
      }
      throw new Error('Failed to delete conversation');
    }
    return response.json();
  },

  /**
   * Update a conversation's metadata (e.g., title).
   */
  async updateConversation(conversationId, { title }) {
    const headers = await getHeaders();
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ title }),
      }
    );
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Not authenticated');
      }
      if (response.status === 404) {
        throw new Error('Conversation not found');
      }
      throw new Error('Failed to update conversation');
    }
    return response.json();
  },

  /**
   * Check if a conversation is currently being processed.
   */
  async getConversationStatus(conversationId) {
    const headers = await getHeaders();
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/status`,
      { headers }
    );
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Not authenticated');
      }
      throw new Error('Failed to get conversation status');
    }
    return response.json();
  },

  /**
   * Send a message in a conversation.
   */
  async sendMessage(conversationId, content, mode = 'decide_please') {
    const headers = await getHeaders();
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/message`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ content, mode }),
      }
    );
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Not authenticated');
      }
      if (response.status === 402) {
        throw new Error('Insufficient credits');
      }
      throw new Error('Failed to send message');
    }
    return response.json();
  },

  /**
   * Send a message and receive streaming updates.
   * @param {string} conversationId - The conversation ID
   * @param {string} content - The message content
   * @param {string} mode - Run mode: 'quick_decision', 'decide_please', or 'decide_pretty_please'
   * @param {function} onEvent - Callback function for each event: (eventType, data) => void
   * @param {File[]} files - Optional array of File objects to attach
   * @param {number|null} sourceMessageId - Optional message ID to respond to (for responding to specific previous decisions)
   * @returns {Promise<void>}
   */
  async sendMessageStream(conversationId, content, mode, onEvent, files = [], sourceMessageId = null) {
    const headers = await getHeaders();

    // Convert files to base64 if present
    let fileAttachments = null;
    if (files && files.length > 0) {
      fileAttachments = await Promise.all(
        files.map(async (file) => ({
          filename: file.name,
          content_type: file.type,
          data: await this._fileToBase64(file),
        }))
      );
    }

    const requestBody = {
      content,
      mode: mode || 'decide_please',
      files: fileAttachments,
    };

    // Include source_message_id if responding to a specific previous decision
    if (sourceMessageId) {
      requestBody.source_message_id = sourceMessageId;
    }

    // Use retry wrapper for the initial fetch (handles transient network errors)
    const response = await withRetry(async () => {
      const res = await fetch(
        `${API_BASE}/api/conversations/${conversationId}/message/stream`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
        }
      );

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Not authenticated');
        }
        if (res.status === 402) {
          // Parse the payment options from the response
          try {
            const paymentData = await res.json();
            // Create an error with payment details attached
            const error = new Error(paymentData.message || 'Insufficient quota');
            error.isPaymentRequired = true;
            error.paymentOption = paymentData.payment_option;
            error.priceCents = paymentData.price_cents;
            error.mode = paymentData.mode;
            error.subscriptionPlan = paymentData.subscription_plan;
            error.stripeCustomerId = paymentData.stripe_customer_id;
            throw error;
          } catch (parseError) {
            if (parseError.isPaymentRequired) {
              throw parseError; // Re-throw our custom error
            }
            throw new Error('Insufficient credits');
          }
        }
        // Try to get error detail from response
        let errorMessage = `Failed to send message (HTTP ${res.status})`;
        try {
          const errorData = await res.json();
          if (errorData.detail) {
            errorMessage = errorData.detail;
          }
        } catch {
          // JSON parsing failed, use default message with HTTP status
        }
        throw new Error(errorMessage);
      }

      return res;
    });

    // Process SSE stream with automatic reconnection on failure
    await this._processSSEStreamWithRecovery(response, onEvent, conversationId);
  },

  /**
   * Convert a File to base64 string.
   * @param {File} file - The file to convert
   * @returns {Promise<string>} Base64-encoded file content
   */
  _fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Remove the data URL prefix (e.g., "data:image/png;base64,")
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  /**
   * Rerun a decision with optional new input.
   * @param {string} conversationId - The conversation ID
   * @param {string|null} newInput - Optional new input for refinement
   * @param {string} mode - Run mode: 'quick_decision', 'decide_please', or 'decide_pretty_please'
   * @param {function} onEvent - Callback function for each event: (eventType, data) => void
   * @returns {Promise<void>}
   */
  async rerunDecision(conversationId, newInput, mode, onEvent) {
    const headers = await getHeaders();
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/rerun`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mode: mode || 'decide_please',
          new_input: newInput || null,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Not authenticated');
      }
      if (response.status === 402) {
        throw new Error('Insufficient credits');
      }
      throw new Error('Failed to rerun decision');
    }

    // Process SSE stream with automatic reconnection on failure
    await this._processSSEStreamWithRecovery(response, onEvent, conversationId);
  },

  /**
   * Get revisions for a specific message.
   */
  async getRevisions(conversationId, messageId) {
    const headers = await getHeaders();
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/revisions/${messageId}`,
      { headers }
    );
    if (!response.ok) {
      throw new Error('Failed to get revisions');
    }
    return response.json();
  },

  /**
   * Get available run modes.
   */
  async getRunModes() {
    const response = await fetch(`${API_BASE}/api/run-modes`);
    if (!response.ok) {
      throw new Error('Failed to get run modes');
    }
    return response.json();
  },

  /**
   * Helper to process SSE stream responses.
   * Returns true if stream completed normally, false if interrupted.
   */
  async _processSSEStream(response, onEvent) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let receivedComplete = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Append new chunk to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines from buffer
        const lines = buffer.split('\n');
        // Keep the last (potentially incomplete) line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data.trim()) {
              try {
                const event = JSON.parse(data);
                onEvent(event.type, event);
                // Track if we received the completion event
                if (event.type === 'complete') {
                  receivedComplete = true;
                }
              } catch {
                // Malformed SSE event - notify via error event
                onEvent('error', { message: 'Invalid response from server' });
              }
            }
          }
        }
      }

      // Process any remaining data in buffer
      if (buffer.startsWith('data: ')) {
        const data = buffer.slice(6);
        if (data.trim()) {
          try {
            const event = JSON.parse(data);
            onEvent(event.type, event);
            if (event.type === 'complete') {
              receivedComplete = true;
            }
          } catch {
            // Malformed final SSE event - notify via error event
            onEvent('error', { message: 'Invalid response from server' });
          }
        }
      }
    } catch (error) {
      // Stream was interrupted (network error, QUIC timeout, etc.)
      console.warn('[SSE] Stream interrupted:', error.message);
      return false;
    }

    return receivedComplete;
  },

  /**
   * Process SSE stream with automatic recovery on connection failure.
   * If the stream is interrupted, polls the status endpoint until processing
   * completes, then fetches the final result.
   */
  async _processSSEStreamWithRecovery(response, onEvent, conversationId) {
    const streamCompleted = await this._processSSEStream(response, onEvent);

    if (!streamCompleted) {
      // Stream was interrupted - enter recovery mode
      console.log('[SSE Recovery] Stream interrupted, entering recovery mode...');
      onEvent('recovery_start', { message: 'Connection lost, checking processing status...' });

      // Poll status endpoint until processing completes
      const maxAttempts = 180; // 6 minutes max (2s intervals)
      let attempts = 0;

      while (attempts < maxAttempts) {
        attempts++;
        await this._sleep(2000); // Wait 2 seconds between polls

        try {
          const status = await this.getConversationStatus(conversationId);

          if (status.processing) {
            // Still processing - send heartbeat to keep UI updated
            onEvent('heartbeat', {
              operation: `Recovering... (${status.current_stage || 'processing'})`,
              elapsed_seconds: attempts * 2,
            });
          } else {
            // Processing complete - fetch the updated conversation
            console.log('[SSE Recovery] Processing complete, fetching result...');
            const conversation = await this.getConversation(conversationId);

            // Find the latest assistant message
            const messages = conversation.messages || [];
            const latestAssistant = messages
              .filter(m => m.role === 'assistant')
              .pop();

            if (latestAssistant) {
              // Emit the stage events for the recovered data
              if (latestAssistant.stage1) {
                onEvent('stage1_complete', { data: latestAssistant.stage1 });
              }
              if (latestAssistant.stage1_5) {
                onEvent('stage1_5_complete', { data: latestAssistant.stage1_5 });
              }
              if (latestAssistant.stage2) {
                onEvent('stage2_complete', { data: latestAssistant.stage2 });
              }
              if (latestAssistant.stage3) {
                onEvent('stage3_complete', { data: latestAssistant.stage3 });
              }

              // Emit completion event
              onEvent('complete', {
                recovered: true,
                message_id: latestAssistant.id,
              });
            } else {
              onEvent('error', { message: 'Processing completed but no result found' });
            }

            return; // Recovery successful
          }
        } catch (error) {
          console.warn('[SSE Recovery] Status check failed:', error.message);
          // Continue polling - might be a transient network issue
        }
      }

      // Exceeded max attempts
      onEvent('error', {
        message: 'Connection lost and recovery timed out. Please refresh the page.',
        recoverable: false,
      });
    }
  },

  /**
   * Helper to sleep for a given number of milliseconds.
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Get credit pack information.
   */
  async getCreditPackInfo() {
    const response = await fetch(`${API_BASE}/api/credits/info`);
    if (!response.ok) {
      throw new Error('Failed to get credit pack info');
    }
    return response.json();
  },

  /**
   * Create a checkout session to purchase credits (legacy - redirects to Stripe).
   * Returns a URL to redirect the user to Stripe checkout.
   */
  async createCheckoutSession() {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/credits/checkout`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        success_url: `${window.location.origin}/?payment=success`,
        cancel_url: `${window.location.origin}/?payment=cancelled`,
      }),
    });
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Not authenticated');
      }
      throw new Error('Failed to create checkout session');
    }
    return response.json();
  },

  /**
   * Create a PaymentIntent for purchasing credits.
   * Returns client_secret for use with Stripe Payment Element.
   * Supports Apple Pay, Google Pay, and cards.
   */
  async createPaymentIntent() {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/credits/create-payment-intent`, {
      method: 'POST',
      headers,
    });
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Not authenticated');
      }
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || 'Failed to create payment intent');
    }
    return response.json();
  },

  // ============== Saved Payment Methods API ==============

  /**
   * Get list of saved payment methods (cards).
   */
  async getPaymentMethods() {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/payments/methods`, { headers });
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Not authenticated');
      }
      throw new Error('Failed to get payment methods');
    }
    return response.json();
  },

  /**
   * Create a SetupIntent for adding a new payment method.
   * Returns client_secret to use with Stripe Elements.
   */
  async createSetupIntent() {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/payments/methods/setup`, {
      method: 'POST',
      headers,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || 'Failed to create setup intent');
    }
    return response.json();
  },

  /**
   * Delete a saved payment method.
   */
  async deletePaymentMethod(paymentMethodId) {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/payments/methods/${paymentMethodId}`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || 'Failed to delete payment method');
    }
    return response.json();
  },

  /**
   * Set a payment method as the default.
   */
  async setDefaultPaymentMethod(paymentMethodId) {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/payments/methods/${paymentMethodId}/default`, {
      method: 'POST',
      headers,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || 'Failed to set default payment method');
    }
    return response.json();
  },

  /**
   * Charge saved cards with automatic fallback.
   * Tries preferred card first, then falls back to other saved cards.
   */
  async chargeSavedCard(paymentMethodId = null) {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/payments/charge-saved`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ payment_method_id: paymentMethodId }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || 'Failed to charge saved card');
    }
    return response.json();
  },

  /**
   * Charge subscriber for an overage decision.
   * Called when a subscriber exceeds their quota.
   */
  async chargeOverage(mode, paymentMethodId = null) {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/payments/charge-overage`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        mode,
        payment_method_id: paymentMethodId,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || 'Failed to charge overage');
    }
    return response.json();
  },

  /**
   * Charge non-subscriber for a pay-per-use decision.
   * Called when a non-subscriber wants to run a single decision.
   */
  async chargePayPerUse(mode, paymentMethodId = null) {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/payments/charge-payperuse`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        mode,
        payment_method_id: paymentMethodId,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || 'Failed to charge pay-per-use');
    }
    return response.json();
  },

  // ============== User Settings API ==============

  /**
   * Update user's email address.
   */
  async updateEmail(newEmail, currentPassword) {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/auth/update-email`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ new_email: newEmail, current_password: currentPassword }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || 'Failed to update email');
    }
    return response.json();
  },

  /**
   * Change user's password.
   */
  async changePassword(currentPassword, newPassword) {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/auth/change-password`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || 'Failed to change password');
    }
    return response.json();
  },

  /**
   * Delete user's own account.
   */
  async deleteAccount() {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/auth/delete-account`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || 'Failed to delete account');
    }
    return response.json();
  },

  // ============== Admin API ==============

  /**
   * Check if current user has admin access.
   */
  async checkAdminAccess() {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/admin/check`, { headers });
    if (!response.ok) {
      return { is_admin: false };
    }
    return response.json();
  },

  /**
   * Get admin dashboard stats.
   */
  async getAdminStats() {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/admin/stats`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get admin stats');
    }
    return response.json();
  },

  /**
   * List users (admin).
   */
  async getAdminUsers(limit = 50, offset = 0, search = '') {
    const headers = await getHeaders();
    const params = new URLSearchParams({ limit, offset });
    if (search) params.append('search', search);
    const response = await fetch(`${API_BASE}/api/admin/users?${params}`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get users');
    }
    return response.json();
  },

  /**
   * Get user details (admin).
   */
  async getAdminUserDetail(userId) {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/admin/users/${userId}`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get user details');
    }
    return response.json();
  },

  /**
   * Adjust user credits (admin).
   */
  async adjustUserCredits(userId, credits) {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/admin/users/${userId}/credits?credits=${credits}`, {
      method: 'POST',
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to adjust credits');
    }
    return response.json();
  },

  /**
   * List payments (admin).
   */
  async getAdminPayments(limit = 50, offset = 0) {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/admin/payments?limit=${limit}&offset=${offset}`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get payments');
    }
    return response.json();
  },

  /**
   * List recent queries (admin).
   */
  async getAdminQueries(limit = 50, offset = 0) {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/admin/queries?limit=${limit}&offset=${offset}`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get queries');
    }
    return response.json();
  },

  /**
   * List recent decisions with full question and moderator response (admin).
   */
  async getAdminDecisions(limit = 50, offset = 0, search = '') {
    const headers = await getHeaders();
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search) params.append('search', search);
    const response = await fetch(`${API_BASE}/api/admin/decisions?${params}`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get decisions');
    }
    return response.json();
  },

  /**
   * Get full details of a specific decision (admin).
   */
  async getAdminDecisionDetail(messageId) {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/admin/decisions/${messageId}`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get decision detail');
    }
    return response.json();
  },

  /**
   * Get daily metrics (admin).
   */
  async getAdminMetrics(days = 30) {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/admin/metrics/daily?days=${days}`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get metrics');
    }
    return response.json();
  },

  /**
   * Set user credits by email (admin) - Legacy, kept for backward compatibility.
   */
  async setUserCreditsByEmail(email, credits) {
    const headers = await getHeaders();
    const response = await fetch(
      `${API_BASE}/api/admin/users/set-credits-by-email?email=${encodeURIComponent(email)}&credits=${credits}`,
      { method: 'POST', headers }
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || 'Failed to set credits');
    }
    return response.json();
  },

  /**
   * Grant decisions to a user by email (admin).
   * @param {string} email - User email
   * @param {string} decisionType - Decision type: 'quick_decision', 'standard_decision', or 'premium_decision'
   * @param {number} amount - Number of decisions to grant
   * @param {string} notes - Optional notes about the grant
   */
  async grantDecisions(email, decisionType, amount, notes = null) {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/admin/users/grant-decisions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        decision_type: decisionType,
        amount,
        notes,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || 'Failed to grant decisions');
    }
    return response.json();
  },

  /**
   * Delete user account by email (admin).
   */
  async deleteUserByEmail(email) {
    const headers = await getHeaders();
    const response = await fetch(
      `${API_BASE}/api/admin/users/delete-by-email?email=${encodeURIComponent(email)}`,
      { method: 'DELETE', headers }
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || 'Failed to delete user');
    }
    return response.json();
  },

  /**
   * Reset user password (admin) - sends reset email.
   */
  async adminSendPasswordReset(email) {
    const headers = await getHeaders();
    const response = await fetch(
      `${API_BASE}/api/admin/users/send-password-reset?email=${encodeURIComponent(email)}`,
      { method: 'POST', headers }
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || 'Failed to send password reset');
    }
    return response.json();
  },

  // ============== Staff Management ==============

  /**
   * Get list of staff users (employees, admins, superadmins).
   */
  async getStaffUsers() {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/admin/staff`, { headers });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || 'Failed to get staff users');
    }
    return response.json();
  },

  /**
   * Create a new staff user.
   */
  async createStaffUser(email, password, role) {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/admin/staff`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password, role }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || 'Failed to create staff user');
    }
    return response.json();
  },

  /**
   * Update a user's role.
   */
  async updateUserRole(userId, role) {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/admin/users/${userId}/role`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ role }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || 'Failed to update user role');
    }
    return response.json();
  },

  // ============== Impersonation ==============

  /**
   * Get impersonation token for a user (superadmin only).
   */
  async impersonateUser(userId) {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/admin/impersonate/${userId}`, { headers });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || 'Failed to impersonate user');
    }
    return response.json();
  },

  /**
   * End impersonation session.
   */
  async endImpersonation() {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/admin/impersonate/end`, {
      method: 'POST',
      headers,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || 'Failed to end impersonation');
    }
    return response.json();
  },

  // ============== Audit Log ==============

  /**
   * Get admin audit log.
   */
  async getAuditLog(limit = 100, offset = 0) {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/api/admin/audit-log?limit=${limit}&offset=${offset}`, { headers });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || 'Failed to get audit log');
    }
    return response.json();
  },

  // ============== Request Cancellation ==============

  /**
   * Cancel processing for a conversation (best effort).
   * The backend may have already completed by the time this is called.
   */
  async cancelProcessing(conversationId) {
    const headers = await getHeaders();
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/cancel`,
      { method: 'POST', headers }
    );
    // Don't throw on error - cancellation is best-effort
    if (!response.ok) {
      console.warn('Cancel request failed:', response.status);
      return { cancelled: false, reason: 'Request failed' };
    }
    return response.json();
  },

  /**
   * Delete an orphaned user message (one without a corresponding AI response).
   * Used before retrying a failed request.
   */
  async deleteOrphanedMessage(conversationId, messageId) {
    const headers = await getHeaders();
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/messages/${messageId}`,
      { method: 'DELETE', headers }
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || 'Failed to delete orphaned message');
    }
    return response.json();
  },

  /**
   * Retry an orphaned message with the same content.
   */
  async retryOrphanedMessage(conversationId, messageId, mode, onEvent) {
    const headers = await getHeaders();
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/messages/${messageId}/retry`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ mode: mode || 'decide_please' }),
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Not authenticated');
      }
      if (response.status === 402) {
        throw new Error('Insufficient credits');
      }
      throw new Error('Failed to retry message');
    }

    // Process SSE stream with recovery
    await this._processSSEStreamWithRecovery(response, onEvent, conversationId);
  },
};
