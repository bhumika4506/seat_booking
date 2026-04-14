import React, { useState, useEffect } from 'react';
import { getWeekAllocation, blockSeat as blockSeatApi, unblockSeat } from './api';
import { formatDisplay, dayName, formatDate, getSquadColor } from './utils';
import { Lock, Unlock, Clock, ShieldCheck, Trash2 } from 'lucide-react';
import { useToast } from './Toast';

export default function BlockSeat({ weekStart, currentMember }) {
  const [allocation, setAllocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [blocking, setBlocking] = useState(false);
  const toast = useToast();

  const now = new Date();
  const isAfter3PM = now.getHours() >= 15;

  // Calculate next working day
  const getNextWorkingDay = () => {
    let nxt = new Date();
    nxt.setDate(nxt.getDate() + 1);
    const holidays = [
      '2025-01-26','2025-03-17','2025-04-14','2025-05-01','2025-08-15',
      '2025-10-02','2025-10-20','2025-11-05','2025-12-25',
      '2026-01-01','2026-01-26','2026-03-06'
    ];
    while (nxt.getDay() === 0 || nxt.getDay() === 6 || holidays.includes(formatDate(nxt))) {
      nxt.setDate(nxt.getDate() + 1);
    }
    return formatDate(nxt);
  };

  const targetDate = getNextWorkingDay();

  // Get the week start for the target date
  const getTargetWeekStart = () => {
    const d = new Date(targetDate + 'T00:00:00');
    const dow = d.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    return formatDate(monday);
  };

  useEffect(() => {
    setLoading(true);
    const ws = getTargetWeekStart();
    getWeekAllocation(ws)
      .then(setAllocation)
      .catch(() => toast('Failed to load data', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const refresh = () => {
    const ws = getTargetWeekStart();
    getWeekAllocation(ws).then(setAllocation);
  };

  const handleBlock = async () => {
    if (!selectedSeat || !currentMember) return;
    setBlocking(true);
    try {
      await blockSeatApi({ member_id: currentMember.id, seat_id: selectedSeat.id, date: targetDate });
      toast('Seat blocked successfully!', 'success');
      refresh();
      setSelectedSeat(null);
    } catch (e) {
      toast(e.response?.data?.detail || 'Block failed', 'error');
    } finally {
      setBlocking(false);
    }
  };

  const handleUnblock = async (block) => {
    try {
      await unblockSeat(block.member.id, block.seat.id, block.date);
      toast('Block removed', 'success');
      refresh();
    } catch (e) {
      toast(e.response?.data?.detail || 'Failed to remove block', 'error');
    }
  };

  if (!currentMember) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
        <h2 style={{ marginBottom: '8px' }}>👤 Select a Member</h2>
        <p style={{ color: 'var(--ink-muted)' }}>Use the member selector in the top bar</p>
      </div>
    );
  }

  if (loading) return <div className="spinner-wrap"><div className="spinner"></div></div>;

  // 3PM Gate Banner
  const gateBanner = (
    <div className={`gate-banner ${isAfter3PM ? 'unlocked' : 'locked'}`}>
      {isAfter3PM ? <Unlock size={32} style={{ color: 'var(--green)' }} /> : <Lock size={32} style={{ color: 'var(--yellow)' }} />}
      <div>
        <h3>{isAfter3PM ? '🟢 Gate Open — Blocking Available' : '🟡 Gate Locked — Opens at 3:00 PM'}</h3>
        <p>
          {isAfter3PM
            ? `You can now block seats for ${dayName(targetDate)} ${formatDisplay(targetDate)}`
            : `Check back after 3:00 PM to block seats for ${dayName(targetDate)} ${formatDisplay(targetDate)}`
          }
        </p>
      </div>
    </div>
  );

  // Get day data for the target date
  const dayData = allocation?.[targetDate];
  const seats = dayData ? Object.values(dayData.seats).sort((a, b) => a.number - b.number) : [];

  // Check if member is designated on target date — blocking is only for non-designated
  function getISOWeek(d) {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  }

  const isoWeek = getISOWeek(new Date(targetDate + 'T00:00:00'));
  const wkNum = isoWeek % 2 === 1 ? 1 : 2;
  const squadNum = parseInt(currentMember.squad_id.replace('squad_', ''));
  const batch = squadNum <= 5 ? 1 : 2;
  const designatedDows = batch === 1
    ? (wkNum === 1 ? [0, 1, 2] : [3, 4])
    : (wkNum === 1 ? [3, 4] : [0, 1, 2]);
  const targetDow = new Date(targetDate + 'T00:00:00').getDay() - 1;
  const isDesignated = designatedDows.includes(targetDow);

  // Member's existing blocks
  const memberBlocks = seats
    .filter(s => s.block && s.block.member?.id === currentMember.id)
    .map(s => s.block);

  return (
    <div>
      <h2 style={{ marginBottom: '20px' }}>
        <ShieldCheck size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
        Block Seat
      </h2>

      {gateBanner}

      {isDesignated && (
        <div className="info-banner">
          ℹ️ {dayName(targetDate)} is your <strong>designated day</strong> — you can book directly without blocking. Use the Book a Seat page instead.
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <span className="badge badge-blue" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
          <Clock size={14} /> Target: {dayName(targetDate)} {formatDisplay(targetDate)}
        </span>
      </div>

      {/* Existing blocks */}
      {memberBlocks.length > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <h3>Your Active Blocks</h3>
          </div>
          {memberBlocks.map(bl => (
            <div key={`${bl.seat.id}_${bl.date}`} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px', borderRadius: '8px', background: 'var(--yellow-light)', marginBottom: '8px'
            }}>
              <div>
                <strong>{bl.seat.id}</strong>
                <span style={{ color: 'var(--ink-muted)', marginLeft: '8px' }}>
                  {bl.seat.is_floater ? 'Floater' : 'Fixed'} · {dayName(bl.date)} {formatDisplay(bl.date)}
                </span>
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => handleUnblock(bl)}>
                <Trash2 size={14} /> Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Seat Grid */}
      {isAfter3PM && !isDesignated && dayData && (
        <div className="card">
          <div className="card-header">
            <h3>Available Seats for Blocking</h3>
          </div>
          <div className="seat-grid">
            {seats.map(seat => {
              const isAvail = seat.status === 'available';
              const isSelected = selectedSeat?.id === seat.id;

              return (
                <React.Fragment key={seat.id}>
                  {seat.number === 41 && (
                    <div className="floater-zone-label">🔄 Floater Zone</div>
                  )}
                  <div
                    className={`seat-box ${isAvail ? 'available' : seat.status === 'blocked' ? 'blocked' : 'booked'} ${seat.is_floater ? 'floater' : ''} ${isSelected ? 'selected' : ''} ${!isAvail ? 'disabled' : ''}`}
                    style={seat.status === 'booked' && seat.booking ? { background: getSquadColor(seat.booking.squad?.id) } : {}}
                    onClick={() => isAvail && setSelectedSeat(seat)}
                  >
                    <span className="seat-number">{seat.id}</span>
                    {seat.booking && <span className="seat-member">{seat.booking.member?.name}</span>}
                    {seat.block && <span className="seat-member">🔒 {seat.block.member?.name}</span>}
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {selectedSeat && (
            <div className="booking-confirm">
              <div>
                <strong>Block {selectedSeat.id}</strong>
                <span style={{ color: 'var(--ink-muted)', marginLeft: '8px' }}>
                  {selectedSeat.is_floater ? 'Floater' : 'Fixed'} seat for {dayName(targetDate)} {formatDisplay(targetDate)}
                </span>
              </div>
              <button
                className="btn btn-primary"
                onClick={handleBlock}
                disabled={blocking}
                id="confirm-block-btn"
              >
                {blocking ? 'Blocking...' : 'Confirm Block'}
              </button>
            </div>
          )}
        </div>
      )}

      {!isAfter3PM && (
        <div className="card" style={{ textAlign: 'center', padding: '60px', color: 'var(--ink-muted)' }}>
          <Lock size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
          <h3 style={{ marginBottom: '8px' }}>Blocking Locked</h3>
          <p>Seat blocking opens at 3:00 PM. Please come back later.</p>
        </div>
      )}
    </div>
  );
}
