import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import ChannelsPage from './pages/ChannelsPage';
import DirectMessagesPage from './pages/DirectMessagesPage';
import CallsPage from './pages/CallsPage';
import FilesPage from './pages/FilesPage';

export default function App() {
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
