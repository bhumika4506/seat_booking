import React, { useState, useEffect } from 'react';
import { getBookingHistory, releaseSeat } from './api';
import { formatDisplay, dayName } from './utils';
import { Clock, Ban, CheckCircle } from 'lucide-react';
import { useToast } from './Toast';

export default function BookingHistory({ currentMember, wsEvent }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchHistory = () => {
    if (!currentMember) return;
    getBookingHistory(currentMember.id)
      .then(setHistory)
      .catch(() => toast('Failed to load history', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => fetchHistory(), [currentMember]);
  useEffect(() => { if (wsEvent) fetchHistory(); }, [wsEvent]);

  const handleCancel = async (date) => {
    if (!confirm(`Cancel booking for ${formatDisplay(date)}?`)) return;
    try {
      await releaseSeat({ member_id: currentMember.id, date });
      toast('Booking cancelled', 'success');
      fetchHistory();
    } catch (e) {
      toast(e.response?.data?.detail || 'Failed to cancel', 'error');
    }
  };

  if (loading) return <div className="spinner-wrap"><div className="spinner"></div></div>;

  return (
    <div>
      <h2 style={{ marginBottom: '20px' }}>
        <Clock size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
        Booking History
      </h2>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Seat</th>
              <th>Location</th>
              <th>Time Slot</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--ink-muted)' }}>No bookings found</td></tr>
            ) : (
              history.map(bk => {
                const isFuture = new Date(bk.date) >= new Date(new Date().setHours(0,0,0,0));
                const hasCheckedIn = !!bk.checkin;
                return (
                  <tr key={bk.id || bk.date}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{formatDisplay(bk.date)}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>{dayName(bk.date)}</div>
                    </td>
                    <td>
                      <div className="badge badge-blue">Seat {bk.seat.id}</div>
                      {bk.recurring && <span className="badge" style={{marginLeft:'4px'}}>🔁</span>}
                    </td>
                    <td>
                      Floor {bk.seat.floor} · Zone {bk.seat.zone}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>
                      {bk.time_slot?.replace('_', ' ') || 'Full Day'}
                    </td>
                    <td>
                      {hasCheckedIn ? (
                        <span style={{ color: 'var(--green)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={14} /> Checked-in
                        </span>
                      ) : isFuture ? (
                        <span style={{ color: 'var(--orange)' }}>Upcoming</span>
                      ) : (
                        <span style={{ color: 'var(--ink-muted)' }}>Did not check-in</span>
                      )}
                    </td>
                    <td>
                      {isFuture && !hasCheckedIn && (
                        <button className="btn btn-sm btn-danger" onClick={() => handleCancel(bk.date)}>
                          <Ban size={14} /> Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
