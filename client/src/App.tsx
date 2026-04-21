import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from './store/authStore';
import { useCallStore } from './store/callStore';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import VideoCallModal from './components/calls/VideoCallModal';
import PostCallModal from './components/calls/PostCallModal';
import Modals from './components/modals/Modals';

export default function App() {
  const { user, token, loginSSO } = useAuthStore();
  const { active: callActive, postCallInfo, clearPostCallInfo } = useCallStore();

  useEffect(() => {
    if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }, [token]);

  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.onSSOToken) {
      electronAPI.onSSOToken((ssoToken: string) => loginSSO(ssoToken));
      return () => electronAPI.removeSSOListener?.();
    }
  }, [loginSSO]);

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
      {/* Video/Audio call — only while active */}
      {callActive && <VideoCallModal />}

      {/* Post-call modal — survives endCall(), shown independently */}
      {postCallInfo && (
        <PostCallModal
          callType={postCallInfo.callType}
          duration={postCallInfo.duration}
          participants={postCallInfo.participants}
          transcript={postCallInfo.transcript}
          onClose={clearPostCallInfo}
        />
      )}

      <Modals />
      <Layout />
    </BrowserRouter>
  );
}
