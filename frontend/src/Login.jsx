import React, { useState } from 'react';
import { login } from './api';
import { LogIn } from 'lucide-react';
import { useToast } from './Toast';

export default function Login({ onLoginSuccess }) {
  const [memberId, setMemberId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const [errorMsg, setErrorMsg] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      // 10 second forced timeout
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Server took too long to respond')), 10000));
      const loginRequest = login({ member_id: memberId, password: password });
      
      const resp = await Promise.race([loginRequest, timeoutPromise]);
      
      localStorage.setItem('seatflow_token', resp.access_token);
      toast('Login successful!', 'success');
      onLoginSuccess(resp.member);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Login failed Check backend server.';
      setErrorMsg(msg);
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ color: 'var(--brand)', marginBottom: '8px' }}>SeatFlow</h1>
          <p style={{ color: 'var(--ink-muted)' }}>Workspace Management System</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Member ID</label>
            <input
              type="text"
              className="form-input"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value.toUpperCase())}
              placeholder="e.g. M0101"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Default: pass123"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '16px', justifyContent: 'center' }}>
            <LogIn size={18} style={{ marginRight: '8px' }} />
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}
