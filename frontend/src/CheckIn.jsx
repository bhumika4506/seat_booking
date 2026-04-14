import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getCheckinStatus, checkIn, checkOut } from './api';
import { formatDisplay, dayName } from './utils';
import { QrCode, CheckCircle, LogOut, Clock } from 'lucide-react';
import { useToast } from './Toast';

export default function CheckIn({ currentMember, wsEvent }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const today = new Date().toISOString().split('T')[0];

  const fetchStatus = () => {
    if (!currentMember) return;
    getCheckinStatus(currentMember.id, today)
      .then(setStatus)
      .catch(() => toast('Failed to load check-in status', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => fetchStatus(), [currentMember, today]);
  useEffect(() => { if (wsEvent) fetchStatus(); }, [wsEvent]);

  const handleCheckIn = async () => {
    try {
      await checkIn({ member_id: currentMember.id, date: today });
      toast('Checked in successfully!', 'success');
      fetchStatus();
    } catch (e) {
      toast(e.response?.data?.detail || 'Failed to check in', 'error');
    }
  };

  const handleCheckOut = async () => {
    if (!confirm('Are you ready to check out? This will release your seat for the rest of the day.')) return;
    try {
      await checkOut({ member_id: currentMember.id, date: today });
      toast('Checked out successfully.', 'success');
      fetchStatus();
    } catch (e) {
      toast(e.response?.data?.detail || 'Failed to check out', 'error');
    }
  };

  if (loading) return <div className="spinner-wrap"><div className="spinner"></div></div>;

  const { booking, checkin } = status;

  if (!booking) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
        <QrCode size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
        <h2>No Booking Today</h2>
        <p style={{ color: 'var(--ink-muted)' }}>You don't have a seat booked for {formatDisplay(today)}.</p>
      </div>
    );
  }

  const isCheckedIn = !!checkin;
  const isCheckedOut = checkin?.checkout_time;
  const qrValue = JSON.stringify({ member: currentMember.id, booking_id: booking.id, type: 'seatflow_checkin' });

  return (
    <div>
      <h2 style={{ marginBottom: '20px' }}>
        <QrCode size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
        Today's Check-In
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Booking Info */}
        <div className="card">
          <h3 style={{ marginBottom: '16px', fontSize: '1rem' }}>Seat Info</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--ink-muted)' }}>Seat</span>
              <strong>{booking.seat.id}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--ink-muted)' }}>Location</span>
              <strong>Floor {booking.seat.floor} · Zone {booking.seat.zone}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--ink-muted)' }}>Time Slot</span>
              <strong style={{ textTransform: 'capitalize' }}>{booking.time_slot.replace('_', ' ')}</strong>
            </div>
          </div>
        </div>

        {/* Action / QR Area */}
        <div className="card" style={{ textAlign: 'center' }}>
          {!isCheckedIn ? (
            <>
              <h3 style={{ marginBottom: '16px', fontSize: '1rem', color: 'var(--orange)' }}>Pending Check-in</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', marginBottom: '20px' }}>
                Scan this QR code at your desk or click the button below to check in.
                <br/><strong>Auto-release in 30 mins if not checked in.</strong>
              </p>
              
              <div style={{ background: '#fff', padding: '16px', display: 'inline-block', borderRadius: '8px', marginBottom: '20px' }}>
                <QRCodeSVG value={qrValue} size={150} />
              </div>
              <br/>
              <button className="btn btn-primary" onClick={handleCheckIn} style={{ width: '100%', justifyContent: 'center' }}>
                <CheckCircle size={18} style={{ marginRight: '8px' }} /> Confirm Check-In
              </button>
            </>
          ) : isCheckedOut ? (
            <>
              <h3 style={{ marginBottom: '16px', fontSize: '1rem', color: 'var(--green)' }}>Checked Out</h3>
              <p style={{ color: 'var(--ink-muted)' }}>You have completed your session for today.</p>
              <div style={{ marginTop: '20px', fontSize: '0.9rem' }}>
                Check-in: {new Date(checkin.checkin_time).toLocaleTimeString()}<br/>
                Check-out: {new Date(checkin.checkout_time).toLocaleTimeString()}
              </div>
            </>
          ) : (
            <>
              <h3 style={{ marginBottom: '16px', fontSize: '1rem', color: 'var(--green)' }}>
                <CheckCircle size={18} style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
                Active Session
              </h3>
              <p style={{ color: 'var(--ink-muted)' }}>
                You checked in at {new Date(checkin.checkin_time).toLocaleTimeString()}.
              </p>
              <button className="btn btn-secondary text-danger" onClick={handleCheckOut} style={{ width: '100%', justifyContent: 'center', marginTop: '30px' }}>
                <LogOut size={18} style={{ marginRight: '8px' }} /> Check Out now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
