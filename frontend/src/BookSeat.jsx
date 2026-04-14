import React, { useState, useEffect } from 'react';
import { getWeekAllocation, bookSeat as bookSeatApi, getHolidays } from './api';
import { formatDisplay, dayName, formatDate, getSquadColor } from './utils';
import { addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, CheckCircle, Armchair } from 'lucide-react';
import { useToast } from './Toast';

export default function BookSeat({ weekStart, currentMember }) {
  const [allocation, setAllocation] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [localWeek, setLocalWeek] = useState(weekStart);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [filter, setFilter] = useState('all');
  const [booking, setBooking] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setLocalWeek(weekStart);
  }, [weekStart]);

  useEffect(() => {
    setLoading(true);
    Promise.all([getWeekAllocation(localWeek), getHolidays()])
      .then(([a, h]) => {
        setAllocation(a);
        setHolidays(h);
      })
      .catch(() => toast('Failed to load booking data', 'error'))
      .finally(() => setLoading(false));
  }, [localWeek]);

  const navWeek = (dir) => {
    const d = new Date(localWeek + 'T00:00:00');
    setLocalWeek(formatDate(addDays(d, dir * 7)));
    setSelectedDay(null);
    setSelectedSeat(null);
  };

  const handleBook = async () => {
    if (!selectedDay || !selectedSeat || !currentMember) return;
    setBooking(true);
    try {
      await bookSeatApi({ member_id: currentMember.id, seat_id: selectedSeat.id, date: selectedDay });
      toast('Seat booked successfully!', 'success');
      // Refresh
      const a = await getWeekAllocation(localWeek);
      setAllocation(a);
      setSelectedSeat(null);
    } catch (e) {
      toast(e.response?.data?.detail || 'Booking failed', 'error');
    } finally {
      setBooking(false);
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
  if (!allocation) return null;

  const dayKeys = Object.keys(allocation).sort();

  // Check member's designated days
  function getISOWeek(d) {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  }

  const isoWeek = getISOWeek(new Date(localWeek + 'T00:00:00'));
  const wkNum = isoWeek % 2 === 1 ? 1 : 2;
  const squadNum = parseInt(currentMember.squad_id.replace('squad_', ''));
  const batch = squadNum <= 5 ? 1 : 2;
  const designatedDows = batch === 1
    ? (wkNum === 1 ? [0, 1, 2] : [3, 4])
    : (wkNum === 1 ? [3, 4] : [0, 1, 2]);

  const dayData = selectedDay ? allocation[selectedDay] : null;

  const getAvailableSeats = (dk) => {
    if (!allocation[dk]) return 0;
    return Object.values(allocation[dk].seats).filter(s => s.status === 'available').length;
  };

  const isDayDesignated = (dk) => {
    const dow = new Date(dk + 'T00:00:00').getDay() - 1; // 0=Mon
    if (dow < 0) return false;
    return designatedDows.includes(dow);
  };

  let displaySeats = [];
  if (dayData) {
    const isDesig = isDayDesignated(selectedDay);
    displaySeats = Object.values(dayData.seats)
      .filter(s => {
        if (!isDesig && !s.is_floater) return false;
        if (filter === 'fixed') return !s.is_floater;
        if (filter === 'floater') return s.is_floater;
        return true;
      })
      .sort((a, b) => a.number - b.number);
  }

  return (
    <div>
      <div className="week-nav">
        <button className="btn btn-ghost" onClick={() => navWeek(-1)}><ChevronLeft size={20} /></button>
        <h3>Week of {formatDisplay(localWeek)}</h3>
        <button className="btn btn-ghost" onClick={() => navWeek(1)}><ChevronRight size={20} /></button>
      </div>

      <div className="booking-flow">
        {/* Step 1: Select Day */}
        <div>
          <h3 style={{ marginBottom: '12px', fontSize: '0.95rem' }}>1. Select Day</h3>
          <div className="booking-days-list">
            {dayKeys.map(dk => {
              const day = allocation[dk];
              const isHoliday = day.is_holiday;
              const isDesig = isDayDesignated(dk);
              const disabled = isHoliday;
              const free = getAvailableSeats(dk);

              return (
                <div
                  key={dk}
                  className={`booking-day-option ${selectedDay === dk ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                  onClick={() => {
                    if (disabled) return;
                    setSelectedDay(dk);
                    setSelectedSeat(null);
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                      {dayName(dk)} · {formatDisplay(dk)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: '2px' }}>
                      {isHoliday ? '🚫 Holiday' : isDesig ? '✓ Designated' : '○ Non-Designated'}
                    </div>
                  </div>
                  {!isHoliday && <span className="free-count">{free} free</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 2 & 3: Seat Selection */}
        <div>
          {selectedDay ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '0.95rem' }}>2. Select Seat — {dayName(selectedDay)}</h3>
                <div className="filter-bar" style={{ marginBottom: 0 }}>
                  {['all', 'fixed', 'floater'].map(f => (
                    <button
                      key={f}
                      className={`filter-chip ${filter === f ? 'active' : ''}`}
                      onClick={() => setFilter(f)}
                    >
                      {f === 'all' ? 'All' : f === 'fixed' ? 'Fixed' : 'Floater'}
                    </button>
                  ))}
                </div>
              </div>

              {!isDayDesignated(selectedDay) && (
                <div className="info-banner" style={{ marginBottom: '16px' }}>
                  ℹ️ Non-designated day — only floater seats (41-50) are available for direct booking
                </div>
              )}

              <div className="card">
                <div className="seat-grid">
                  {displaySeats.map(seat => {
                    const isAvail = seat.status === 'available';
                    const isSelected = selectedSeat?.id === seat.id;

                    return (
                      <React.Fragment key={seat.id}>
                        {seat.number === 41 && filter === 'all' && isDayDesignated(selectedDay) && (
                          <div className="floater-zone-label">🔄 Floater Zone</div>
                        )}
                        <div
                          className={`seat-box ${isAvail ? 'available' : 'booked'} ${seat.is_floater ? 'floater' : ''} ${isSelected ? 'selected' : ''} ${!isAvail ? 'disabled' : ''}`}
                          style={!isAvail && seat.booking ? { background: getSquadColor(seat.booking.squad?.id) } : {}}
                          onClick={() => isAvail && setSelectedSeat(seat)}
                        >
                          <span className="seat-number">{seat.id}</span>
                          {seat.booking && <span className="seat-member">{seat.booking.member?.name}</span>}
                          {isAvail && isSelected && <CheckCircle size={14} style={{ marginTop: '2px' }} />}
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Confirm */}
              {selectedSeat && (
                <div className="booking-confirm">
                  <div>
                    <strong>Book {selectedSeat.id}</strong>
                    <span style={{ color: 'var(--ink-muted)', marginLeft: '8px' }}>
                      {selectedSeat.is_floater ? 'Floater' : 'Fixed'} seat on {dayName(selectedDay)} {formatDisplay(selectedDay)}
                    </span>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={handleBook}
                    disabled={booking}
                    id="confirm-booking-btn"
                  >
                    {booking ? 'Booking...' : 'Confirm Booking'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '60px', color: 'var(--ink-muted)' }}>
              <Armchair size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
              <h3 style={{ marginBottom: '8px' }}>Select a Day</h3>
              <p>Choose a day from the left panel to see available seats</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
