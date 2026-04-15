import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from './store/authStore';
import { useCallStore } from './store/callStore';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import VideoCallModal from './components/calls/VideoCallModal';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function App() {
  const { user, token, loginSSO } = useAuthStore();
  const { active: callActive } = useCallStore();

  // Restore session token on load
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, [token]);

  // Electron SSO deep link listener
  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.onSSOToken) {
      electronAPI.onSSOToken((ssoToken: string) => loginSSO(ssoToken));
      return () => electronAPI.removeSSOListener?.();
    }
  }, [loginSSO]);

  // Web fallback — SSO token in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get('token');
    if (ssoToken && !user) {
      loginSSO(ssoToken).then(() => window.history.replaceState({}, '', '/'));
    }
  }, []);

  if (!user) return <LoginPage />;

  return (
    <BrowserRouter>
      {/* Full-screen call overlay — rendered above everything */}
      {callActive && <VideoCallModal />}

      <Layout />
    </BrowserRouter>
  );
}
