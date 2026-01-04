/**
 * API client for the DecidePlease backend.
 */

// In production with same-domain routing, API_BASE can be empty (relative paths)
// In development, use localhost:8001
const API_BASE = import.meta.env.VITE_API_URL || '';

// Debug logging
console.log('[API] Initialized with API_BASE:', API_BASE || '(empty - using relative paths)');
console.log('[API] VITE_API_URL env var:', import.meta.env.VITE_API_URL);

// Token getter - set by App.jsx when Clerk is ready
let getAuthToken = null;

export const setAuthTokenGetter = (getter) => {
  console.log('[API] Auth token getter set');
  getAuthToken = getter;
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
        console.log('[API] Auth token obtained (length:', token.length, ')');
      } else {
        console.warn('[API] getAuthToken returned null/empty token');
      }
    } catch (err) {
      console.error('[API] Failed to get auth token:', err);
    }
  } else {
    console.warn('[API] No auth token getter set');
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
  async sendMessage(conversationId, content, mode = 'standard') {
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
   * @param {string} mode - Run mode: 'quick', 'standard', or 'extra_care'
   * @param {function} onEvent - Callback function for each event: (eventType, data) => void
   * @param {File[]} files - Optional array of File objects to attach
   * @returns {Promise<void>}
   */
  async sendMessageStream(conversationId, content, mode, onEvent, files = []) {
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

    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/message/stream`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content,
          mode: mode || 'standard',
          files: fileAttachments,
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
      // Try to get error detail from response
      try {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to send message');
      } catch {
        throw new Error('Failed to send message');
      }
    }

    await this._processSSEStream(response, onEvent);
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
   * @param {string} mode - Run mode: 'quick', 'standard', or 'extra_care'
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
          mode: mode || 'standard',
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

    await this._processSSEStream(response, onEvent);
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
   */
  async _processSSEStream(response, onEvent) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

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
            } catch (e) {
              console.error('Failed to parse SSE event:', e, 'Data:', data.substring(0, 100));
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
        } catch (e) {
          console.error('Failed to parse final SSE event:', e);
        }
      }
    }
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
   * Create a checkout session to purchase credits.
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
   * Set user credits by email (admin).
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
};
