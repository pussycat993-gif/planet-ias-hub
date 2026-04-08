import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Segoe UI, Arial, sans-serif' }}>
      {/* Header placeholder */}
      <div style={{ background: '#1565c0', height: 44, display: 'flex', alignItems: 'center', padding: '0 16px', color: '#fff', fontSize: 16, fontWeight: 800 }}>
        IAS <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: '2px 10px', marginLeft: 4, fontSize: 13, fontWeight: 700 }}>Hub</span>
      </div>
      {/* Main content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}
