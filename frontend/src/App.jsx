import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LandingPage from './components/LandingPage';
import './App.css';

/**
 * App component handles the root route (/).
 * - Shows landing page for unauthenticated users
 * - Redirects authenticated users to /decision
 */
function App() {
  const navigate = useNavigate();
  const { isLoading: authLoading, isAuthenticated } = useAuth();

  // Redirect authenticated users to /decision
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/decision');
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Show nothing while auth is loading (prevents flash)
  if (authLoading) {
    return null;
  }

  // Show landing page when not authenticated
  // (authenticated users are redirected to /decision by useEffect)
  return <LandingPage />;
}

export default App;
