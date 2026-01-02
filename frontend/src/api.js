/**
 * API client for the DecidePlease backend.
 */

// In production with same-domain routing, API_BASE can be empty (relative paths)
// In development, use localhost:8001
const API_BASE = import.meta.env.VITE_API_URL || '';

// Token getter - set by App.jsx when Clerk is ready
let getAuthToken = null;

export const setAuthTokenGetter = (getter) => {
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
    const token = await getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
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
   * Send a message in a conversation.
   */
  async sendMessage(conversationId, content) {
    const headers = await getHeaders();
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/message`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ content }),
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
   * @param {function} onEvent - Callback function for each event: (eventType, data) => void
   * @returns {Promise<void>}
   */
  async sendMessageStream(conversationId, content, onEvent) {
    const headers = await getHeaders();
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/message/stream`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ content }),
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

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const event = JSON.parse(data);
            onEvent(event.type, event);
          } catch (e) {
            console.error('Failed to parse SSE event:', e);
          }
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
};
