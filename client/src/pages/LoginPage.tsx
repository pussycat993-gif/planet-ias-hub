import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { loginStandalone, loading, error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await loginStandalone(email, password);
  };

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#f0f2f5',
      fontFamily: 'Segoe UI, Arial, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 10, padding: '2.5rem',
        width: 380, boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
        border: '1px solid #dde1e7',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: '#1565c0', letterSpacing: -0.5 }}>IAS</span>
            <span style={{
              background: '#1976d2', color: '#fff', fontSize: 14,
              fontWeight: 700, padding: '2px 10px', borderRadius: 12,
            }}>Hub</span>
          </div>
          <div style={{ color: '#888', fontSize: 12, marginTop: 6 }}>
            PLANet Systems Group
          </div>
        </div>

        {/* SSO button */}
        <button
          onClick={() => window.location.href = `${import.meta.env.VITE_PCI_URL}/ias-connect/login`}
          style={{
            width: '100%', padding: '10px', marginBottom: 16,
            background: '#1976d2', color: '#fff', border: 'none',
            borderRadius: 8, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Sign in with PLANet Contact IAS
        </button>

        <div style={{ textAlign: 'center', color: '#aaa', fontSize: 11, marginBottom: 16 }}>
          — or sign in as external user —
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#ffebee', color: '#c62828', padding: '8px 12px',
            borderRadius: 6, fontSize: 12, marginBottom: 12, border: '1px solid #ef9a9a',
          }}>
            {error}
            <span onClick={clearError} style={{ float: 'right', cursor: 'pointer' }}>✕</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              style={{
                width: '100%', padding: '8px 10px', border: '1px solid #dde1e7',
                borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••••"
              required
              style={{
                width: '100%', padding: '8px 10px', border: '1px solid #dde1e7',
                borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '10px', background: loading ? '#90caf9' : '#1565c0',
              color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <a
            href="#"
            style={{ color: '#1976d2', fontSize: 11, textDecoration: 'none' }}
            onClick={() => {/* TODO: password reset */}}
          >
            Forgot password?
          </a>
        </div>
      </div>
    </div>
  );
}
