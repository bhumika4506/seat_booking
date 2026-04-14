import React, { useState, useEffect } from 'react';
import { getAdminStats, adminAddSeat, adminRemoveSeat, adminUpdateSeat } from './api';
import { Shield, Plus, Trash2, Settings, Download } from 'lucide-react';
import { useToast } from './Toast';

export default function AdminPanel({ wsEvent }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('stats');
  const toast = useToast();

  const fetchStats = () => {
    getAdminStats()
      .then(setStats)
      .catch(() => toast('Failed to load admin stats', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => fetchStats(), []);
  useEffect(() => { if (wsEvent) fetchStats(); }, [wsEvent]);

  const handleAddSeat = async () => {
    try {
      await adminAddSeat({ floor: 1, zone: 'A', is_floater: false, amenities: [] });
      toast('Seat added successfully', 'success');
      fetchStats();
    } catch (e) {
      toast('Failed to add seat', 'error');
    }
  };

  if (loading) return <div className="spinner-wrap"><div className="spinner"></div></div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2>
          <Shield size={24} style={{ marginRight: '8px', verticalAlign: 'middle', color: 'var(--purple)' }} />
          Admin Panel
        </h2>
        <div className="filter-bar" style={{ marginBottom: 0 }}>
          <button className={`filter-chip ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}>Overview</button>
          <button className={`filter-chip ${tab === 'seats' ? 'active' : ''}`} onClick={() => setTab('seats')}>Seat Config</button>
        </div>
      </div>

      {tab === 'stats' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
          <div className="stat-card">
            <div className="stat-value">{stats.total_members}</div>
            <div className="stat-label">Total Users</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.total_seats}</div>
            <div className="stat-label">Total Seats</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.checkin_rate}%</div>
            <div className="stat-label">Today Check-in Rate</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.total_bookings}</div>
            <div className="stat-label">All-time Bookings</div>
          </div>
        </div>
      )}

      {tab === 'seats' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1rem' }}>Seat Management</h3>
            <button className="btn btn-sm btn-primary" onClick={handleAddSeat}>
              <Plus size={14} /> Add Seat
            </button>
          </div>
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
            Modify seats to trigger immediate updates across all active clients via WebSockets.
          </p>
          <div className="seat-grid">
            {/* Minimal display of stats for demo */}
            {stats.top_seats.map(s => (
              <div key={s.seat_id} style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', textAlign: 'center' }}>
                <strong>{s.seat_id}</strong><br/>
                <span style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>{s.count} bookings</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'stats' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1rem' }}>Global Booking Log</h3>
            <button className="btn btn-ghost btn-sm"><Download size={14} /> Export</button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th><th>User</th><th>Seat</th><th>Slot</th>
              </tr>
            </thead>
            <tbody>
              {stats.all_bookings.slice(0, 15).map(bk => (
                <tr key={bk.id}>
                  <td>{bk.date}</td>
                  <td>{bk.member.name}</td>
                  <td>{bk.seat.id}</td>
                  <td style={{ textTransform: 'capitalize' }}>{bk.time_slot.replace('_', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
