import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import UnifiedHeader from '../components/UnifiedHeader';
import UnifiedFooter from '../components/UnifiedFooter';
import Sidebar from '../components/Sidebar';
import ChatInterface from '../components/ChatInterface';
import CouncilChamber from '../components/CouncilChamber';
import ImpersonationBanner from '../components/ImpersonationBanner';
import AdminPanel from '../components/AdminPanel';
import { api, setAuthTokenGetter } from '../api';
import '../App.css';

function CouncilPage() {
  const navigate = useNavigate();
  const { isLoading: authLoading, isAuthenticated, user, logout, getAccessToken, refreshUser } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [credits, setCredits] = useState(null);
  const [creditPackInfo, setCreditPackInfo] = useState(null);
  const [error, setError] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [respondingToMessageId, setRespondingToMessageId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState('user');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [orphanedMessage, setOrphanedMessage] = useState(null);

  // Ref to track polling cleanup function
  const pollingCleanupRef = useRef(null);

  // Ref for abort controller (to cancel in-progress requests)
  const abortControllerRef = useRef(null);

  // Interface mode: 'chamber' (new) or 'classic' (old ChatInterface)
  const [interfaceMode, setInterfaceMode] = useState(() => {
    const saved = localStorage.getItem('decideplease_interface');
    return saved === 'classic' ? 'classic' : 'chamber';
  });

  // Save interface preference
  useEffect(() => {
    localStorage.setItem('decideplease_interface', interfaceMode);
  }, [interfaceMode]);

  // Define data loading functions with useCallback to avoid hoisting issues
  const loadUserInfo = useCallback(async () => {
    try {
      const userInfo = await api.getUserInfo();
      setCredits(userInfo.credits);
    } catch (err) {
      console.error('Failed to load user info:', err);
    }
  }, []);

  const loadCreditPackInfo = useCallback(async () => {
    try {
      const info = await api.getCreditPackInfo();
      setCreditPackInfo(info);
    } catch (err) {
      console.error('Failed to load credit pack info:', err);
    }
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const result = await api.listConversations();
      // API returns { conversations: [], total: N, has_more: bool }
      setConversations(result.conversations || []);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }, []);

  const checkAdminAccess = useCallback(async () => {
    try {
      const result = await api.checkAdminAccess();
      setIsAdmin(result.is_admin || result.is_staff);
      setUserRole(result.role || 'user');
    } catch (err) {
      console.error('Failed to check admin access:', err);
    }
  }, []);

  const checkPaymentStatus = useCallback(() => {
    // Check URL params for payment status
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');

    if (paymentStatus === 'success') {
      // Reload user info to get updated credits
      setTimeout(() => {
        loadUserInfo();
        refreshUser();
      }, 1000);
      // Clear the URL param
      window.history.replaceState({}, '', window.location.pathname);
    } else if (paymentStatus === 'cancelled') {
      // Clear the URL param
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [loadUserInfo, refreshUser]);

  // Set up auth token getter for API calls
  useEffect(() => {
    if (isAuthenticated) {
      setAuthTokenGetter(() => getAccessToken());
    }
  }, [isAuthenticated, getAccessToken]);

  // Redirect to landing if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/');
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Load conversations and user info when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
      loadUserInfo();
      loadCreditPackInfo();
      checkPaymentStatus();
      checkAdminAccess();
    }
  }, [isAuthenticated, loadConversations, loadUserInfo, loadCreditPackInfo, checkPaymentStatus, checkAdminAccess]);

  // Polling function defined as useCallback since it's used by loadConversation
  const startPollingForUpdates = useCallback((conversationId, initialStage) => {
    // Set up loading state for the current stage
    setCurrentConversation((prev) => {
      if (!prev || !prev.messages) return prev;
      const messages = [...prev.messages];
      // Find the last assistant message or create one
      let lastMsg = messages[messages.length - 1];
      if (!lastMsg || lastMsg.role !== 'assistant') {
        lastMsg = {
          role: 'assistant',
          stage1: null,
          stage2: null,
          stage3: null,
          metadata: {},
          loading: { stage1: false, stage2: false, stage3: false },
        };
        messages.push(lastMsg);
      }
      // Set the current stage as loading
      if (!lastMsg.loading) {
        lastMsg.loading = { stage1: false, stage2: false, stage3: false };
      }
      if (!lastMsg.metadata) {
        lastMsg.metadata = {};
      }
      lastMsg.loading[initialStage] = true;
      lastMsg.processingResumed = true;
      return { ...prev, messages };
    });

    setIsLoading(true);

    // Poll every 2 seconds until complete
    const pollInterval = setInterval(async () => {
      try {
        const status = await api.getConversationStatus(conversationId);

        if (!status.processing) {
          // Processing complete, reload conversation
          clearInterval(pollInterval);
          pollingCleanupRef.current = null;
          setIsLoading(false);
          const conv = await api.getConversation(conversationId);
          if (conv && !conv.messages) {
            conv.messages = [];
          }
          setCurrentConversation(conv);
          loadUserInfo(); // Refresh credits
          loadConversations(); // Refresh sidebar
        } else {
          // Update loading state for current stage
          setCurrentConversation((prev) => {
            if (!prev || !prev.messages) return prev;
            const messages = [...prev.messages];
            const lastMsg = messages[messages.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              if (!lastMsg.loading) {
                lastMsg.loading = { stage1: false, stage2: false, stage3: false };
              }
              lastMsg.loading = {
                stage1: status.current_stage === 'stage1',
                stage2: status.current_stage === 'stage2',
                stage3: status.current_stage === 'stage3',
              };
            }
            return { ...prev, messages };
          });
        }
      } catch (err) {
        console.error('Polling error:', err);
        clearInterval(pollInterval);
        pollingCleanupRef.current = null;
        setIsLoading(false);
      }
    }, 2000);

    // Stop polling if conversation changes
    return () => clearInterval(pollInterval);
  }, [loadUserInfo, loadConversations]);

  const loadConversation = useCallback(async (id) => {
    setLoadError(false);
    setOrphanedMessage(null);

    // Clear any existing polling before loading new conversation
    if (pollingCleanupRef.current) {
      pollingCleanupRef.current();
      pollingCleanupRef.current = null;
    }

    try {
      const conv = await api.getConversation(id);
      console.log('[CouncilPage] Loaded conversation:', conv);
      // Ensure messages is always an array
      if (conv && !conv.messages) {
        conv.messages = [];
      }
      setCurrentConversation(conv);

      // Check if this conversation is still being processed or has orphaned messages
      try {
        const status = await api.getConversationStatus(id);
        if (status.processing) {
          console.log('[CouncilPage] Conversation still processing, stage:', status.current_stage);
          // Start polling for updates and store cleanup function
          pollingCleanupRef.current = startPollingForUpdates(id, status.current_stage);
        } else if (status.orphaned && status.orphaned_message) {
          // Found an orphaned message (user question without AI response)
          console.log('[CouncilPage] Found orphaned message:', status.orphaned_message);
          setOrphanedMessage(status.orphaned_message);
        }
      } catch (statusError) {
        console.error('Failed to check conversation status:', statusError);
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
      // Set error state so user can retry or delete
      setLoadError(true);
      setCurrentConversation({ id, messages: [], title: 'Error loading' });
    }
  }, [startPollingForUpdates]);

  // Load conversation details when selected
  useEffect(() => {
    if (currentConversationId && isAuthenticated) {
      loadConversation(currentConversationId);
    }
  }, [currentConversationId, isAuthenticated, loadConversation]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingCleanupRef.current) {
        pollingCleanupRef.current();
        pollingCleanupRef.current = null;
      }
    };
  }, []);

  const handleRetryLoad = () => {
    if (currentConversationId) {
      loadConversation(currentConversationId);
    }
  };

  const handleDeleteFailedConversation = async () => {
    if (currentConversationId) {
      await handleDeleteConversation(currentConversationId);
      setLoadError(false);
    }
  };

  const handleNewConversation = async () => {
    try {
      const newConv = await api.createConversation();
      setConversations((prev) => [
        { id: newConv.id, created_at: newConv.created_at, title: 'New Conversation', message_count: 0 },
        ...prev,
      ]);
      setCurrentConversationId(newConv.id);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const handleSelectConversation = (id) => {
    setCurrentConversationId(id);
  };

  const handleDeleteConversation = async (id) => {
    try {
      await api.deleteConversation(id);
      // Remove from local state
      setConversations((prev) => prev.filter((c) => c.id !== id));
      // If deleted conversation was selected, clear selection
      if (currentConversationId === id) {
        setCurrentConversationId(null);
        setCurrentConversation(null);
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      setError('Failed to delete conversation. Please try again.');
    }
  };

  // Helper function to safely get/create the last assistant message
  const getOrCreateLastAssistantMessage = (messages) => {
    let lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant') {
      // This shouldn't happen, but create a fallback assistant message
      lastMsg = {
        role: 'assistant',
        stage1: null,
        stage2: null,
        stage3: null,
        metadata: {},
        loading: { stage1: false, stage2: false, stage3: false },
      };
      messages.push(lastMsg);
    }
    // Ensure metadata and loading exist
    if (!lastMsg.metadata) lastMsg.metadata = {};
    if (!lastMsg.loading) lastMsg.loading = { stage1: false, stage2: false, stage3: false };
    return lastMsg;
  };

  // Helper function to handle SSE events for both send and rerun
  const handleStreamEvent = (eventType, event) => {
    switch (eventType) {
      case 'run_started':
        // Update credits immediately after debit
        if (event.updated_credits !== undefined) {
          setCredits(event.updated_credits);
        }
        // Store mode info in the message
        setCurrentConversation((prev) => {
          if (!prev || !prev.messages) return prev;
          const messages = [...prev.messages];
          const lastMsg = getOrCreateLastAssistantMessage(messages);
          lastMsg.metadata = {
            ...lastMsg.metadata,
            mode: event.mode,
            enable_peer_review: event.enable_peer_review,
          };
          return { ...prev, messages };
        });
        break;

      case 'stage1_start':
        setCurrentConversation((prev) => {
          if (!prev || !prev.messages) return prev;
          const messages = [...prev.messages];
          const lastMsg = getOrCreateLastAssistantMessage(messages);
          lastMsg.loading.stage1 = true;
          return { ...prev, messages };
        });
        break;

      case 'stage1_complete':
        setCurrentConversation((prev) => {
          if (!prev || !prev.messages) return prev;
          const messages = [...prev.messages];
          const lastMsg = getOrCreateLastAssistantMessage(messages);
          lastMsg.stage1 = event.data;
          lastMsg.loading.stage1 = false;
          return { ...prev, messages };
        });
        break;

      case 'stage_preparing':
        // Transition state between stages - keeps CouncilDebate visible
        setCurrentConversation((prev) => {
          if (!prev || !prev.messages) return prev;
          const messages = [...prev.messages];
          const lastMsg = getOrCreateLastAssistantMessage(messages);
          lastMsg.loading.preparing = true;
          lastMsg.loading.nextStage = event.next_stage;
          lastMsg.loading.preparingStatus = event.status;
          return { ...prev, messages };
        });
        break;

      case 'heartbeat':
        // Update heartbeat info for elapsed time display
        setCurrentConversation((prev) => {
          if (!prev || !prev.messages) return prev;
          const messages = [...prev.messages];
          const lastMsg = getOrCreateLastAssistantMessage(messages);
          lastMsg.loading.heartbeat = {
            operation: event.operation,
            elapsed: event.elapsed_seconds
          };
          return { ...prev, messages };
        });
        break;

      case 'recovery_start':
        // Connection was lost, entering recovery mode
        console.log('[Recovery] Connection lost, entering recovery mode');
        setCurrentConversation((prev) => {
          if (!prev || !prev.messages) return prev;
          const messages = [...prev.messages];
          const lastMsg = getOrCreateLastAssistantMessage(messages);
          lastMsg.loading.recovering = true;
          lastMsg.loading.heartbeat = {
            operation: 'Reconnecting...',
            elapsed: 0
          };
          return { ...prev, messages };
        });
        break;

      case 'stage1_5_start':
        setCurrentConversation((prev) => {
          if (!prev || !prev.messages) return prev;
          const messages = [...prev.messages];
          const lastMsg = getOrCreateLastAssistantMessage(messages);
          lastMsg.loading.preparing = false;
          lastMsg.loading.stage1_5 = true;
          return { ...prev, messages };
        });
        break;

      case 'stage1_5_complete':
        setCurrentConversation((prev) => {
          if (!prev || !prev.messages) return prev;
          const messages = [...prev.messages];
          const lastMsg = getOrCreateLastAssistantMessage(messages);
          lastMsg.stage1_5 = event.data;
          lastMsg.loading.stage1_5 = false;
          return { ...prev, messages };
        });
        break;

      case 'stage1_5_skipped':
        // Mark Stage 1.5 as skipped (Quick/Standard mode)
        setCurrentConversation((prev) => {
          if (!prev || !prev.messages) return prev;
          const messages = [...prev.messages];
          const lastMsg = getOrCreateLastAssistantMessage(messages);
          lastMsg.stage1_5Skipped = true;
          lastMsg.stage1_5 = [];
          lastMsg.loading.stage1_5 = false;
          return { ...prev, messages };
        });
        break;

      case 'stage2_start':
        setCurrentConversation((prev) => {
          if (!prev || !prev.messages) return prev;
          const messages = [...prev.messages];
          const lastMsg = getOrCreateLastAssistantMessage(messages);
          lastMsg.loading.preparing = false;
          lastMsg.loading.stage2 = true;
          return { ...prev, messages };
        });
        break;

      case 'stage2_skipped':
        // Mark Stage 2 as skipped (Quick mode)
        setCurrentConversation((prev) => {
          if (!prev || !prev.messages) return prev;
          const messages = [...prev.messages];
          const lastMsg = getOrCreateLastAssistantMessage(messages);
          lastMsg.stage2Skipped = true;
          lastMsg.stage2 = [];
          lastMsg.loading.stage2 = false;
          return { ...prev, messages };
        });
        break;

      case 'stage2_complete':
        setCurrentConversation((prev) => {
          if (!prev || !prev.messages) return prev;
          const messages = [...prev.messages];
          const lastMsg = getOrCreateLastAssistantMessage(messages);
          lastMsg.stage2 = event.data;
          lastMsg.metadata = { ...lastMsg.metadata, ...event.metadata };
          lastMsg.loading.stage2 = false;
          return { ...prev, messages };
        });
        break;

      case 'stage3_start':
        setCurrentConversation((prev) => {
          if (!prev || !prev.messages) return prev;
          const messages = [...prev.messages];
          const lastMsg = getOrCreateLastAssistantMessage(messages);
          lastMsg.loading.preparing = false;
          lastMsg.loading.stage3 = true;
          return { ...prev, messages };
        });
        break;

      case 'stage3_complete':
        setCurrentConversation((prev) => {
          if (!prev || !prev.messages) return prev;
          const messages = [...prev.messages];
          const lastMsg = getOrCreateLastAssistantMessage(messages);
          lastMsg.stage3 = event.data;
          lastMsg.metadata = { ...lastMsg.metadata, ...event.metadata };
          lastMsg.loading.stage3 = false;
          return { ...prev, messages };
        });
        break;

      case 'title_complete':
        // Reload conversations to get updated title
        loadConversations();
        break;

      case 'complete':
        // Stream complete, update credits and reload conversations
        if (event.credits !== undefined) {
          setCredits(event.credits);
        }
        loadConversations();
        setIsLoading(false);
        break;

      case 'error':
        console.error('Stream error:', event.message);
        setError(event.message);
        setIsLoading(false);
        break;

      default:
        console.log('Unknown event type:', eventType);
    }
  };

  const handleSendMessage = async (content, mode = 'standard', files = []) => {
    // Capture the source message ID before clearing it
    const sourceMessageId = respondingToMessageId;

    // Auto-create conversation if none exists
    let conversationId = currentConversationId;
    if (!conversationId) {
      try {
        const newConv = await api.createConversation();
        conversationId = newConv.id;
        setConversations((prev) => [
          { id: newConv.id, created_at: newConv.created_at, title: 'New Decision', message_count: 0 },
          ...prev,
        ]);
        setCurrentConversationId(newConv.id);
        setCurrentConversation({ id: newConv.id, messages: [], title: 'New Decision' });
      } catch (error) {
        console.error('Failed to create conversation:', error);
        setError('Failed to start new decision. Please try again.');
        return;
      }
    }

    // Check credits before sending (account for file upload cost)
    const fileCost = files.length > 0 ? 1 : 0;
    if (credits !== null && credits <= fileCost) {
      setError('No credits remaining. Please purchase more credits to continue.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setRespondingToMessageId(null); // Clear the responding state

    try {
      // Optimistically add user message to UI
      const userMessage = { role: 'user', content };
      setCurrentConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
      }));

      // Create a partial assistant message that will be updated progressively
      const assistantMessage = {
        role: 'assistant',
        stage1: null,
        stage2: null,
        stage2Skipped: false,
        stage3: null,
        metadata: { mode },
        loading: {
          stage1: false,
          stage2: false,
          stage3: false,
        },
      };

      // Add the partial assistant message
      setCurrentConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
      }));

      // Send message with streaming (include files and optional source message ID)
      // Use local conversationId variable, not state (which may not have updated yet)
      await api.sendMessageStream(conversationId, content, mode, (eventType, event) => {
        handleStreamEvent(eventType, event);
      }, files, sourceMessageId);
    } catch (error) {
      console.error('Failed to send message:', error);
      if (error.message === 'Insufficient credits') {
        setError('No credits remaining. Please purchase more credits to continue.');
      } else {
        setError(error.message || 'Failed to send message. Please try again.');
      }
      // Remove optimistic messages on error
      setCurrentConversation((prev) => ({
        ...prev,
        messages: prev.messages.slice(0, -2),
      }));
      setIsLoading(false);
    }
  };

  // Cancel an in-progress request
  const handleCancelRequest = useCallback(async () => {
    console.log('[CouncilPage] Cancelling request...');

    // Abort any active fetch request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Clear any active polling
    if (pollingCleanupRef.current) {
      pollingCleanupRef.current();
      pollingCleanupRef.current = null;
    }

    // Reset loading state
    setIsLoading(false);

    // Remove the optimistic messages (user message + loading assistant message)
    setCurrentConversation((prev) => {
      if (!prev || !prev.messages || prev.messages.length < 2) return prev;

      const messages = [...prev.messages];
      const lastMsg = messages[messages.length - 1];
      const secondLastMsg = messages[messages.length - 2];

      // If last message is assistant with no stage3 (incomplete), remove it and its user message
      if (lastMsg?.role === 'assistant' && !lastMsg.stage3) {
        // Also remove the preceding user message if it exists
        if (secondLastMsg?.role === 'user') {
          return { ...prev, messages: messages.slice(0, -2) };
        }
        return { ...prev, messages: messages.slice(0, -1) };
      }

      return prev;
    });

    // Notify user
    setError('Request cancelled');

    // Try to cancel on the backend (best effort - it may have already completed)
    if (currentConversationId) {
      try {
        await api.cancelProcessing?.(currentConversationId);
      } catch (err) {
        // Ignore - cancellation is best-effort
        console.log('[CouncilPage] Backend cancel failed (may already be complete):', err);
      }
    }
  }, [currentConversationId]);

  // Retry an orphaned message (request that never completed)
  const handleRetryOrphaned = useCallback(async (orphaned) => {
    if (!orphaned || !currentConversationId) return;

    console.log('[CouncilPage] Retrying orphaned message:', orphaned);
    setOrphanedMessage(null);

    const contentToRetry = orphaned.content;
    const modeToRetry = orphaned.mode || 'standard';

    // The orphaned message is already in the conversation - we need to delete it first
    try {
      await api.deleteOrphanedMessage(currentConversationId, orphaned.id);
      // Reload conversation to remove the orphaned message from UI
      const conv = await api.getConversation(currentConversationId);
      if (conv && !conv.messages) {
        conv.messages = [];
      }
      setCurrentConversation(conv);
    } catch (err) {
      console.log('[CouncilPage] Could not delete orphaned message, will proceed anyway:', err);
    }

    // Now resend the same content
    await handleSendMessage(contentToRetry, modeToRetry, []);
  }, [currentConversationId, handleSendMessage]);

  // Show nothing while auth is loading (prevents flash)
  if (authLoading) {
    return null;
  }

  // Redirect handled by useEffect, but show nothing while redirecting
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="app">
      <ImpersonationBanner />
      <UnifiedHeader
        isSignedIn={true}
        credits={credits}
        userEmail={user?.email}
        creditPackInfo={creditPackInfo}
        onCreditsUpdated={loadUserInfo}
        isAdmin={isAdmin}
        userRole={userRole}
        onOpenAdmin={() => setShowAdminPanel(true)}
        onSignOut={logout}
      />
      <div className="app-body">
        <Sidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onDeleteConversation={handleDeleteConversation}
        />
        {interfaceMode === 'chamber' ? (
          <CouncilChamber
            conversation={currentConversation}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            error={error}
            onDismissError={() => setError(null)}
            user={user}
            onCancelRequest={handleCancelRequest}
            onRetryOrphaned={handleRetryOrphaned}
            orphanedMessage={orphanedMessage}
          />
        ) : (
          <ChatInterface
            conversation={currentConversation}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            error={error}
            onDismissError={() => setError(null)}
            loadError={loadError}
            onDeleteConversation={handleDeleteFailedConversation}
            onRetryLoad={handleRetryLoad}
            respondingToMessageId={respondingToMessageId}
            onRespondToMessage={setRespondingToMessageId}
            onClearRespondingTo={() => setRespondingToMessageId(null)}
            user={user}
          />
        )}
      </div>
      <UnifiedFooter />
      {showAdminPanel && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}
    </div>
  );
}

export default CouncilPage;
