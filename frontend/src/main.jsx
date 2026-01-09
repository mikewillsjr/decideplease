import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import './index.css'
import App from './App.jsx'
import CouncilPage from './pages/CouncilPage'
import AdminPage from './pages/AdminPage'
import PrivacyPage from './components/PrivacyPage'
import TermsPage from './components/TermsPage'
import ResetPasswordPage from './components/ResetPasswordPage'
import SettingsPage from './components/SettingsPage'
import GoogleCallbackPage from './pages/GoogleCallbackPage'
import MagicLinkPage from './pages/MagicLinkPage'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/decision" element={<CouncilPage />} />
            {/* Redirect old /council route to /decision */}
            <Route path="/council" element={<Navigate to="/decision" replace />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
            <Route path="/auth/magic" element={<MagicLinkPage />} />
            <Route path="/*" element={<App />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
