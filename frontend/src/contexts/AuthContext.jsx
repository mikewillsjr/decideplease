import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

const AuthContext = createContext(null);

// Token storage keys
const ACCESS_TOKEN_KEY = 'decideplease_access_token';
const REFRESH_TOKEN_KEY = 'decideplease_refresh_token';
const USER_KEY = 'decideplease_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Get stored tokens
  const getAccessToken = useCallback(() => {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }, []);

  const getRefreshToken = useCallback(() => {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }, []);

  // Store tokens
  const storeTokens = useCallback((accessToken, refreshToken) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  }, []);

  // Clear tokens
  const clearTokens = useCallback(() => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  // Store user
  const storeUser = useCallback((userData) => {
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setUser(userData);
    setIsAuthenticated(true);
  }, []);

  // Refresh access token
  const refreshAccessToken = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      return null;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
      return data.access_token;
    } catch (error) {
      console.error('Token refresh failed:', error);
      clearTokens();
      setUser(null);
      setIsAuthenticated(false);
      return null;
    }
  }, [getRefreshToken, clearTokens]);

  // Register new user
  const register = useCallback(async (email, password) => {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || 'Registration failed');
    }

    storeTokens(data.access_token, data.refresh_token);
    storeUser(data.user);

    return data.user;
  }, [storeTokens, storeUser]);

  // Login
  const login = useCallback(async (email, password) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || 'Login failed');
    }

    storeTokens(data.access_token, data.refresh_token);
    storeUser(data.user);

    return data.user;
  }, [storeTokens, storeUser]);

  // Logout
  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    setIsAuthenticated(false);
  }, [clearTokens]);

  // Get auth headers for API calls
  const getAuthHeaders = useCallback(async () => {
    let token = getAccessToken();

    if (!token) {
      token = await refreshAccessToken();
    }

    if (!token) {
      return {};
    }

    return {
      'Authorization': `Bearer ${token}`,
    };
  }, [getAccessToken, refreshAccessToken]);

  // Fetch current user from API
  const fetchCurrentUser = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      return null;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Try to refresh token
          const newToken = await refreshAccessToken();
          if (newToken) {
            const retryResponse = await fetch(`${API_URL}/api/auth/me`, {
              headers: { 'Authorization': `Bearer ${newToken}` },
            });
            if (retryResponse.ok) {
              return await retryResponse.json();
            }
          }
        }
        throw new Error('Failed to fetch user');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      return null;
    }
  }, [getAccessToken, refreshAccessToken]);

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);

      // Check for stored user
      const storedUser = localStorage.getItem(USER_KEY);
      const accessToken = getAccessToken();

      if (storedUser && accessToken) {
        // Verify token is still valid
        const userData = await fetchCurrentUser();
        if (userData) {
          setUser(userData);
          setIsAuthenticated(true);
          // Update stored user with fresh data
          localStorage.setItem(USER_KEY, JSON.stringify(userData));
        } else {
          // Token invalid, clear everything
          clearTokens();
        }
      }

      setIsLoading(false);
    };

    initAuth();
  }, [getAccessToken, fetchCurrentUser, clearTokens]);

  // Refresh user data (e.g., after credit purchase)
  const refreshUser = useCallback(async () => {
    const userData = await fetchCurrentUser();
    if (userData) {
      setUser(userData);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
    }
    return userData;
  }, [fetchCurrentUser]);

  // Set auth data directly (for OAuth callbacks)
  const setAuthData = useCallback(({ accessToken, refreshToken, user: userData }) => {
    storeTokens(accessToken, refreshToken);
    storeUser(userData);
  }, [storeTokens, storeUser]);

  // Request magic link (for signup or login)
  const requestMagicLink = useCallback(async (email, password = null) => {
    const body = { email };
    if (password) {
      body.password = password;
    }

    const response = await fetch(`${API_URL}/api/auth/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || 'Failed to send magic link');
    }

    // If password was provided, user is logged in immediately (but unverified)
    if (data.access_token) {
      storeTokens(data.access_token, data.refresh_token);
      storeUser(data.user);
      return {
        loggedIn: true,
        requiresVerification: data.requires_verification,
        message: data.message,
        user: data.user
      };
    }

    // Otherwise magic link was sent
    return {
      loggedIn: false,
      magicLinkSent: true,
      email: data.email,
      message: data.message
    };
  }, [storeTokens, storeUser]);

  // Verify magic link token
  const verifyMagicLink = useCallback(async (token) => {
    const response = await fetch(`${API_URL}/api/auth/verify-magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || 'Invalid or expired magic link');
    }

    storeTokens(data.access_token, data.refresh_token);
    storeUser(data.user);
    return data.user;
  }, [storeTokens, storeUser]);

  // Resend verification email
  const resendVerification = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      throw new Error('Not logged in');
    }

    const response = await fetch(`${API_URL}/api/auth/resend-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || 'Failed to resend verification');
    }

    return data;
  }, [getAccessToken]);

  const value = {
    user,
    isLoading,
    isAuthenticated,
    register,
    login,
    logout,
    getAuthHeaders,
    getAccessToken,
    refreshUser,
    setAuthData,
    requestMagicLink,
    verifyMagicLink,
    resendVerification,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
