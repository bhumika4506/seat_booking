import React, { useState, useEffect } from 'react';
import { getWeekAllocation } from './api';
import { formatDisplay, dayName, getSquadColor, formatDate } from './utils';
import { addDays, format } from 'date-fns';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { useToast } from './Toast';

export default function FloorPlan({ weekStart, currentMember }) {
  const [allocation, setAllocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [filter, setFilter] = useState('all');
  const [highlightSquad, setHighlightSquad] = useState(null);
  const [localWeek, setLocalWeek] = useState(weekStart);
  const toast = useToast();

  useEffect(() => {
    setLocalWeek(weekStart);
  }, [weekStart]);

  useEffect(() => {
    setLoading(true);
    getWeekAllocation(localWeek)
      .then(data => {
        setAllocation(data);
        setSelectedSeat(null);
      })
      .catch(() => toast('Failed to load floor plan', 'error'))
      .finally(() => setLoading(false));
  }, [localWeek]);

  const navWeek = (dir) => {
    const d = new Date(localWeek + 'T00:00:00');
    setLocalWeek(formatDate(addDays(d, dir * 7)));
  };

  if (loading) {
    return <div className="spinner-wrap"><div className="spinner"></div></div>;
  }
  if (!allocation) return null;

  const dayKeys = Object.keys(allocation).sort();
  const currentDayKey = dayKeys[selectedDay];
  const dayData = allocation[currentDayKey];

  if (!dayData) return null;

  const seats = Object.values(dayData.seats).sort((a, b) => a.number - b.number);

  const filteredSeats = seats.filter(s => {
    if (filter === 'fixed') return !s.is_floater;
    if (filter === 'floater') return s.is_floater;
    return true;
  });

  const getSeatColor = (seat) => {
    if (seat.status === 'booked' && seat.booking) {
      return getSquadColor(seat.booking.squad?.id);
    }
    if (seat.status === 'blocked') return 'var(--yellow)';
    return null;
  };

  const getSeatClass = (seat) => {
    let cls = 'seat-box';
    if (seat.status === 'available') cls += ' available';
    else if (seat.status === 'booked') cls += ' booked';
    else if (seat.status === 'blocked') cls += ' blocked';
    if (seat.is_floater) cls += ' floater';
    if (selectedSeat?.id === seat.id) cls += ' selected';
    if (highlightSquad && seat.booking?.squad?.id !== highlightSquad && seat.status === 'booked') {
      cls += ' disabled';
    }
    return cls;
  };

  return (
    <div>
      <div className="week-nav">
        <button className="btn btn-ghost" onClick={() => navWeek(-1)}><ChevronLeft size={20} /></button>
        <h3>Week of {formatDisplay(localWeek)}</h3>
        <button className="btn btn-ghost" onClick={() => navWeek(1)}><ChevronRight size={20} /></button>
      </div>

      {/* Day Tabs */}
      <div className="day-tabs">
        {dayKeys.map((dk, i) => (
          <button
            key={dk}
            className={`day-tab ${selectedDay === i ? 'active' : ''} ${allocation[dk]?.is_holiday ? 'holiday' : ''}`}
            onClick={() => { setSelectedDay(i); setSelectedSeat(null); }}
            id={`day-tab-${i}`}
          >
            {dayName(dk)} · {formatDisplay(dk)}
          </button>
        ))}
      </div>

      {dayData.is_holiday ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <h2 style={{ marginBottom: '8px' }}>🚫 Holiday</h2>
          <p style={{ color: 'var(--ink-muted)' }}>No bookings available on this day</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
          {/* Seat Grid */}
          <div className="card">
            <div className="card-header">
              <h3>Floor Plan — {dayData.day_name}</h3>
              <div className="filter-bar" style={{ marginBottom: 0 }}>
                {['all', 'fixed', 'floater'].map(f => (
                  <button
                    key={f}
                    className={`filter-chip ${filter === f ? 'active' : ''}`}
                    onClick={() => setFilter(f)}
                  >
                    {f === 'all' ? 'All Seats' : f === 'fixed' ? 'Fixed (1-40)' : 'Floater (41-50)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="seat-grid">
              {filteredSeats.map((seat, idx) => {
                const showLabel = seat.is_floater && idx === 0 && filter !== 'fixed';
                return (
                  <React.Fragment key={seat.id}>
                    {seat.number === 41 && filter === 'all' && (
                      <div className="floater-zone-label">🔄 Floater Zone (41–50)</div>
                    )}
                    <div
                      className={getSeatClass(seat)}
                      style={seat.status === 'booked' ? { background: getSeatColor(seat) } : {}}
                      onClick={() => setSelectedSeat(seat)}
                      id={`seat-${seat.id}`}
                    >
                      <span className="seat-number">{seat.id}</span>
                      {seat.booking && (
                        <span className="seat-member">{seat.booking.member?.name}</span>
                      )}
                      {seat.block && (
                        <span className="seat-member">🔒 {seat.block.member?.name}</span>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '20px', marginTop: '20px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}>
                <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: 'var(--green-light)', border: '1px solid var(--green)' }} />
                Available
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}>
                <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: 'var(--accent)' }} />
                Booked
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}>
                <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: 'var(--yellow-light)', border: '1px solid var(--yellow)' }} />
                Blocked
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}>
                <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: 'transparent', border: '2px dashed var(--surface-3)' }} />
                Floater
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div>
            {/* Squad Highlight */}
            <div className="detail-panel" style={{ marginBottom: '16px' }}>
              <h4>Highlight Squad</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button
                  className={`filter-chip ${!highlightSquad ? 'active' : ''}`}
                  onClick={() => setHighlightSquad(null)}
                  style={{ textAlign: 'left' }}
                >
                  All Squads
                </button>
                {dayData.designated_squads.map(sq => (
                  <button
                    key={sq.id}
                    className={`filter-chip ${highlightSquad === sq.id ? 'active' : ''}`}
                    onClick={() => setHighlightSquad(highlightSquad === sq.id ? null : sq.id)}
                    style={{ textAlign: 'left' }}
                  >
                    <span style={{
                      display: 'inline-block', width: '10px', height: '10px',
                      borderRadius: '50%', background: getSquadColor(sq.id), marginRight: '8px'
                    }} />
                    {sq.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Seat Detail */}
            {selectedSeat && (
              <div className="detail-panel" style={{ animation: 'fadeUp 0.3s ease-out' }}>
                <h4>Seat Details</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem' }}>
                  <div><strong>Seat:</strong> {selectedSeat.id} (#{selectedSeat.number})</div>
                  <div><strong>Type:</strong> {selectedSeat.is_floater ? '🔄 Floater' : '📌 Fixed'}</div>
                  <div><strong>Row:</strong> {selectedSeat.row + 1}, <strong>Col:</strong> {selectedSeat.col + 1}</div>
                  <div>
                    <strong>Status:</strong>{' '}
                    <span className={`badge ${selectedSeat.status === 'available' ? 'badge-green' : selectedSeat.status === 'booked' ? 'badge-blue' : 'badge-yellow'}`}>
                      {selectedSeat.status}
                    </span>
                  </div>
                  {selectedSeat.booking && (
                    <>
                      <div><strong>Booked by:</strong> {selectedSeat.booking.member?.name}</div>
                      <div><strong>Squad:</strong> {selectedSeat.booking.squad?.name}</div>
                    </>
                  )}
                  {selectedSeat.block && (
                    <>
                      <div><strong>Blocked by:</strong> {selectedSeat.block.member?.name}</div>
                      <div><strong>Squad:</strong> {selectedSeat.block.squad?.name}</div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
