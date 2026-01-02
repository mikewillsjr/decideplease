import { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import AdminPanel from './components/AdminPanel';
import LandingPage from './components/LandingPage';
import { api, setAuthTokenGetter } from './api';
import './App.css';

function App() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [credits, setCredits] = useState(null);
  const [creditPackInfo, setCreditPackInfo] = useState(null);
  const [error, setError] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // Set up auth token getter for API calls
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setAuthTokenGetter(() => getToken());
    }
  }, [isLoaded, isSignedIn, getToken]);

  // Load conversations and user info when signed in
  useEffect(() => {
    if (isSignedIn) {
      loadConversations();
      loadUserInfo();
      loadCreditPackInfo();
      checkPaymentStatus();
      checkAdminAccess();
    }
  }, [isSignedIn]);

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
    if (currentConversationId && isSignedIn) {
      loadConversation(currentConversationId);
    }
  }, [currentConversationId, isSignedIn]);

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
      setTimeout(() => loadUserInfo(), 1000);
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
    try {
      const conv = await api.getConversation(id);
      setCurrentConversation(conv);
    } catch (error) {
      console.error('Failed to load conversation:', error);
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

  const handleSendMessage = async (content) => {
    if (!currentConversationId) return;

    // Check credits before sending
    if (credits !== null && credits <= 0) {
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
        stage3: null,
        metadata: null,
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

      // Send message with streaming
      await api.sendMessageStream(currentConversationId, content, (eventType, event) => {
        switch (eventType) {
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

          case 'stage2_complete':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.stage2 = event.data;
              lastMsg.metadata = event.metadata;
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
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      if (error.message === 'Insufficient credits') {
        setError('No credits remaining. Please purchase more credits to continue.');
      } else {
        setError('Failed to send message. Please try again.');
      }
      // Remove optimistic messages on error
      setCurrentConversation((prev) => ({
        ...prev,
        messages: prev.messages.slice(0, -2),
      }));
      setIsLoading(false);
    }
  };

  // Show loading state while Clerk initializes
  if (!isLoaded) {
    return (
      <div className="app loading-screen">
        <div className="loading-content">
          <h1>DecidePlease</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Show landing page if not authenticated
  if (!isSignedIn) {
    return <LandingPage />;
  }

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        credits={credits}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        creditPackInfo={creditPackInfo}
        onCreditsUpdated={loadUserInfo}
        isAdmin={isAdmin}
        onOpenAdmin={() => setShowAdminPanel(true)}
      />
      <ChatInterface
        conversation={currentConversation}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        error={error}
        onDismissError={() => setError(null)}
      />
      {showAdminPanel && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}
    </div>
  );
}

export default App;
