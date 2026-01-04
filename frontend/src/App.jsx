import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import UnifiedHeader from './components/UnifiedHeader';
import UnifiedFooter from './components/UnifiedFooter';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import AdminPanel from './components/AdminPanel';
import LandingPage from './components/LandingPage';
import { api, setAuthTokenGetter } from './api';
import './App.css';

function App() {
  const { isLoading: authLoading, isAuthenticated, user, logout, getAccessToken, refreshUser } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [credits, setCredits] = useState(null);
  const [creditPackInfo, setCreditPackInfo] = useState(null);
  const [error, setError] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // Set up auth token getter for API calls
  useEffect(() => {
    if (isAuthenticated) {
      setAuthTokenGetter(() => getAccessToken());
    }
  }, [isAuthenticated, getAccessToken]);

  // Load conversations and user info when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
      loadUserInfo();
      loadCreditPackInfo();
      checkPaymentStatus();
      checkAdminAccess();
    }
  }, [isAuthenticated]);

  const checkAdminAccess = async () => {
    try {
      const { is_admin } = await api.checkAdminAccess();
      setIsAdmin(is_admin);
    } catch (error) {
      console.error('Failed to check admin access:', error);
    }
  };

  // Load conversation details when selected
  useEffect(() => {
    if (currentConversationId && isAuthenticated) {
      loadConversation(currentConversationId);
    }
  }, [currentConversationId, isAuthenticated]);

  const loadUserInfo = async () => {
    try {
      const userInfo = await api.getUserInfo();
      setCredits(userInfo.credits);
    } catch (error) {
      console.error('Failed to load user info:', error);
    }
  };

  const loadCreditPackInfo = async () => {
    try {
      const info = await api.getCreditPackInfo();
      setCreditPackInfo(info);
    } catch (error) {
      console.error('Failed to load credit pack info:', error);
    }
  };

  const checkPaymentStatus = () => {
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
  };

  const loadConversations = async () => {
    try {
      const convs = await api.listConversations();
      setConversations(convs);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const loadConversation = async (id) => {
    setLoadError(false);
    try {
      const conv = await api.getConversation(id);
      console.log('[App] Loaded conversation:', conv);
      // Ensure messages is always an array
      if (conv && !conv.messages) {
        conv.messages = [];
      }
      setCurrentConversation(conv);

      // Check if this conversation is still being processed
      try {
        const status = await api.getConversationStatus(id);
        if (status.processing) {
          console.log('[App] Conversation still processing, stage:', status.current_stage);
          // Start polling for updates
          startPollingForUpdates(id, status.current_stage);
        }
      } catch (statusError) {
        console.error('Failed to check conversation status:', statusError);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
      // Set error state so user can retry or delete
      setLoadError(true);
      setCurrentConversation({ id, messages: [], title: 'Error loading' });
    }
  };

  const startPollingForUpdates = (conversationId, initialStage) => {
    // Set up loading state for the current stage
    setCurrentConversation((prev) => {
      if (!prev) return prev;
      const messages = [...prev.messages];
      // Find the last assistant message or create one
      let lastMsg = messages[messages.length - 1];
      if (!lastMsg || lastMsg.role !== 'assistant') {
        lastMsg = {
          role: 'assistant',
          stage1: null,
          stage2: null,
          stage3: null,
          loading: { stage1: false, stage2: false, stage3: false },
        };
        messages.push(lastMsg);
      }
      // Set the current stage as loading
      if (!lastMsg.loading) {
        lastMsg.loading = { stage1: false, stage2: false, stage3: false };
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
            if (!prev) return prev;
            const messages = [...prev.messages];
            const lastMsg = messages[messages.length - 1];
            if (lastMsg && lastMsg.role === 'assistant' && lastMsg.loading) {
              lastMsg.loading = {
                stage1: status.current_stage === 'stage1',
                stage2: status.current_stage === 'stage2',
                stage3: status.current_stage === 'stage3',
              };
            }
            return { ...prev, messages };
          });
        }
      } catch (error) {
        console.error('Polling error:', error);
        clearInterval(pollInterval);
        setIsLoading(false);
      }
    }, 2000);

    // Stop polling if conversation changes
    return () => clearInterval(pollInterval);
  };

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
      setConversations([
        { id: newConv.id, created_at: newConv.created_at, title: 'New Conversation', message_count: 0 },
        ...conversations,
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

  // Helper function to handle SSE events for both send and rerun
  const handleStreamEvent = (eventType, event, isRerun = false) => {
    switch (eventType) {
      case 'run_started':
        // Update credits immediately after debit
        if (event.updated_credits !== undefined) {
          setCredits(event.updated_credits);
        }
        // Store mode info in the message
        setCurrentConversation((prev) => {
          const messages = [...prev.messages];
          const lastMsg = messages[messages.length - 1];
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
          const messages = [...prev.messages];
          const lastMsg = messages[messages.length - 1];
          lastMsg.loading.stage1 = true;
          return { ...prev, messages };
        });
        break;

      case 'stage1_complete':
        setCurrentConversation((prev) => {
          const messages = [...prev.messages];
          const lastMsg = messages[messages.length - 1];
          lastMsg.stage1 = event.data;
          lastMsg.loading.stage1 = false;
          return { ...prev, messages };
        });
        break;

      case 'stage2_start':
        setCurrentConversation((prev) => {
          const messages = [...prev.messages];
          const lastMsg = messages[messages.length - 1];
          lastMsg.loading.stage2 = true;
          return { ...prev, messages };
        });
        break;

      case 'stage2_skipped':
        // Mark Stage 2 as skipped (Quick mode)
        setCurrentConversation((prev) => {
          const messages = [...prev.messages];
          const lastMsg = messages[messages.length - 1];
          lastMsg.stage2Skipped = true;
          lastMsg.stage2 = [];
          lastMsg.loading.stage2 = false;
          return { ...prev, messages };
        });
        break;

      case 'stage2_complete':
        setCurrentConversation((prev) => {
          const messages = [...prev.messages];
          const lastMsg = messages[messages.length - 1];
          lastMsg.stage2 = event.data;
          lastMsg.metadata = { ...lastMsg.metadata, ...event.metadata };
          lastMsg.loading.stage2 = false;
          return { ...prev, messages };
        });
        break;

      case 'stage3_start':
        setCurrentConversation((prev) => {
          const messages = [...prev.messages];
          const lastMsg = messages[messages.length - 1];
          lastMsg.loading.stage3 = true;
          return { ...prev, messages };
        });
        break;

      case 'stage3_complete':
        setCurrentConversation((prev) => {
          const messages = [...prev.messages];
          const lastMsg = messages[messages.length - 1];
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
    // Auto-create conversation if none exists
    let conversationId = currentConversationId;
    if (!conversationId) {
      try {
        const newConv = await api.createConversation();
        conversationId = newConv.id;
        setConversations([
          { id: newConv.id, created_at: newConv.created_at, title: 'New Decision', message_count: 0 },
          ...conversations,
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

      // Send message with streaming (include files)
      await api.sendMessageStream(currentConversationId, content, mode, (eventType, event) => {
        handleStreamEvent(eventType, event);
      }, files);
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

  const handleRerunDecision = async (newInput, mode = 'standard') => {
    if (!currentConversationId) return;

    // Check credits before sending
    if (credits !== null && credits <= 0) {
      setError('No credits remaining. Please purchase more credits to continue.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create a partial assistant message for the rerun
      const assistantMessage = {
        role: 'assistant',
        stage1: null,
        stage2: null,
        stage2Skipped: false,
        stage3: null,
        metadata: { mode, is_rerun: true },
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

      // Send rerun request with streaming
      await api.rerunDecision(currentConversationId, newInput, mode, (eventType, event) => {
        handleStreamEvent(eventType, event, true);
      });
    } catch (error) {
      console.error('Failed to rerun decision:', error);
      if (error.message === 'Insufficient credits') {
        setError('No credits remaining. Please purchase more credits to continue.');
      } else {
        setError('Failed to rerun decision. Please try again.');
      }
      // Remove optimistic message on error
      setCurrentConversation((prev) => ({
        ...prev,
        messages: prev.messages.slice(0, -1),
      }));
      setIsLoading(false);
    }
  };

  // Show nothing while auth is loading (prevents flash)
  if (authLoading) {
    return null;
  }

  // Show landing page when not authenticated
  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return (
    <div className="app">
      <UnifiedHeader
        isSignedIn={true}
        credits={credits}
        userEmail={user?.email}
        creditPackInfo={creditPackInfo}
        onCreditsUpdated={loadUserInfo}
        isAdmin={isAdmin}
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
        <ChatInterface
          conversation={currentConversation}
          onSendMessage={handleSendMessage}
          onRerunDecision={handleRerunDecision}
          isLoading={isLoading}
          error={error}
          onDismissError={() => setError(null)}
          loadError={loadError}
          onDeleteConversation={handleDeleteFailedConversation}
          onRetryLoad={handleRetryLoad}
        />
      </div>
      <UnifiedFooter />
      {showAdminPanel && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}
    </div>
  );
}

export default App;
