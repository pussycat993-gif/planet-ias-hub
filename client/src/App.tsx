import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from './store/authStore';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import ChannelsPage from './pages/ChannelsPage';
import DirectMessagesPage from './pages/DirectMessagesPage';
import CallsPage from './pages/CallsPage';
import FilesPage from './pages/FilesPage';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function App() {
  const { user, token, loginSSO } = useAuthStore();

  // Restore session on app load
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, [token]);

  // Listen for SSO token from Electron deep link (iashub://auth?token=...)
  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.onSSOToken) {
      electronAPI.onSSOToken((ssoToken: string) => {
        loginSSO(ssoToken);
      });
      return () => electronAPI.removeSSOListener?.();
    }
  }, [loginSSO]);

  // Check for SSO token in URL (web fallback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get('token');
    if (ssoToken && !user) {
      loginSSO(ssoToken).then(() => {
        window.history.replaceState({}, '', '/');
      });
    }
  }, []);

  if (!user) return <LoginPage />;

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/channels" replace />} />
          <Route path="/channels/:id?" element={<ChannelsPage />} />
          <Route path="/dm/:id?" element={<DirectMessagesPage />} />
          <Route path="/calls" element={<CallsPage />} />
          <Route path="/files" element={<FilesPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
