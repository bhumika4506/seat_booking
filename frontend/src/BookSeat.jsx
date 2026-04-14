import React, { useState, useEffect } from 'react';
import { getWeekAllocation, bookSeat as bookSeatApi, bookRecurring, getHolidays } from './api';
import { formatDisplay, dayName, formatDate, getSquadColor } from './utils';
import { addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, CheckCircle, Armchair, Repeat, Clock } from 'lucide-react';
import { useToast } from './Toast';

export default function BookSeat({ weekStart, currentMember, wsEvent }) {
  const [allocation, setAllocation] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [localWeek, setLocalWeek] = useState(weekStart);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(null);
  
  // New features state
  const [timeSlot, setTimeSlot] = useState('full_day');
  const [isRecurring, setIsRecurring] = useState(false);
  const [occurrences, setOccurrences] = useState(4);
  const [floorFilter, setFloorFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');

  const [booking, setBooking] = useState(false);
  const toast = useToast();

  const fetchData = () => {
    setLoading(true);
    Promise.all([getWeekAllocation(localWeek), getHolidays()])
      .then(([a, h]) => {
        setAllocation(a);
        setHolidays(h);
      })
      .catch(() => toast('Failed to load booking data', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { setLocalWeek(weekStart); }, [weekStart]);
  useEffect(() => { fetchData(); }, [localWeek]);
  useEffect(() => { if (wsEvent && wsEvent.type !== 'checkin_update') fetchData(); }, [wsEvent]);

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
      if (isRecurring) {
        await bookRecurring({ member_id: currentMember.id, seat_id: selectedSeat.id, start_date: selectedDay, time_slot: timeSlot, occurrences });
        toast(`Recurring booking set for ${occurrences} weeks!`, 'success');
      } else {
        await bookSeatApi({ member_id: currentMember.id, seat_id: selectedSeat.id, date: selectedDay, time_slot: timeSlot });
        toast('Seat booked successfully!', 'success');
      }
      setSelectedSeat(null);
      fetchData();
    } catch (e) {
      toast(e.response?.data?.detail || 'Booking failed', 'error');
    } finally {
      setBooking(false);
    }
  };

  if (!currentMember) return null;
  if (loading && !allocation) return <div className="spinner-wrap"><div className="spinner"></div></div>;
  if (!allocation) return null;

  const dayKeys = Object.keys(allocation).sort();

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

  const isDayDesignated = (dk) => {
    const dow = new Date(dk + 'T00:00:00').getDay() - 1;
    if (dow < 0) return false;
    return designatedDows.includes(dow);
  };

  let displaySeats = [];
  if (dayData) {
    const isDesig = isDayDesignated(selectedDay);
    displaySeats = Object.values(dayData.seats)
      .filter(s => {
        if (!isDesig && !s.is_floater) return false;
        if (floorFilter !== 'all' && s.floor !== parseInt(floorFilter)) return false;
        if (zoneFilter !== 'all' && s.zone !== zoneFilter) return false;
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
              const disabled = isHoliday;

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
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{dayName(dk)} · {formatDisplay(dk)}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: '2px' }}>
                      {isHoliday ? '🚫 Holiday' : isDayDesignated(dk) ? '✓ Designated' : '○ Non-Designated'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 2 & 3: Seat Selection */}
        <div>
          {selectedDay ? (
            <>
              {/* Sidebar Filters */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <select className="form-input" style={{ width: '120px' }} value={floorFilter} onChange={e => setFloorFilter(e.target.value)}>
                  <option value="all">All Floors</option>
                  <option value="1">Floor 1</option>
                  <option value="2">Floor 2</option>
                  <option value="3">Floor 3</option>
                </select>
                <select className="form-input" style={{ width: '120px' }} value={zoneFilter} onChange={e => setZoneFilter(e.target.value)}>
                  <option value="all">All Zones</option>
                  <option value="A">Zone A</option>
                  <option value="B">Zone B</option>
                  <option value="C">Zone C</option>
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff', padding: '0 8px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <Clock size={16} color="var(--ink-muted)" />
                  <select className="form-input" style={{ border: 'none', background: 'transparent' }} value={timeSlot} onChange={e => setTimeSlot(e.target.value)}>
                    <option value="full_day">Full Day</option>
                    <option value="morning">Morning (9AM - 1PM)</option>
                    <option value="afternoon">Afternoon (1PM - 6PM)</option>
                  </select>
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
                    const isAvail = seat.status === 'available' || 
                                   (seat.status === 'partial' && !seat.bookings.some(b => b.time_slot === timeSlot || b.time_slot === 'full_day'));
                    const isSelected = selectedSeat?.id === seat.id;

                    return (
                      <React.Fragment key={seat.id}>
                        {seat.number === 41 && isDayDesignated(selectedDay) && (
                          <div className="floater-zone-label">🔄 Floater Zone</div>
                        )}
                        <div
                          className={`seat-box ${isAvail ? 'available' : 'booked'} ${seat.is_floater ? 'floater' : ''} ${isSelected ? 'selected' : ''} ${!isAvail ? 'disabled' : ''}`}
                          style={!isAvail && seat.booking ? { background: getSquadColor(seat.booking.squad?.id) } : {}}
                          onClick={() => isAvail && setSelectedSeat(seat)}
                        >
                          <span className="seat-number">{seat.id}</span>
                          <span style={{ fontSize: '0.65rem', color: isAvail ? 'var(--ink-muted)' : 'rgba(255,255,255,0.7)' }}>Floor {seat.floor}</span>
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
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <strong>Book {selectedSeat.id} on {dayName(selectedDay)} {formatDisplay(selectedDay)}</strong>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} />
                        <Repeat size={14} /> Repeat Weekly
                      </label>
                    </div>
                    
                    {isRecurring && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                        <span style={{ fontSize: '0.85rem' }}>For</span>
                        <input type="number" min="2" max="10" value={occurrences} onChange={e => setOccurrences(parseInt(e.target.value) || 2)} className="form-input" style={{ width: '60px', padding: '4px' }} />
                        <span style={{ fontSize: '0.85rem' }}>weeks</span>
                      </div>
                    )}
                  </div>
                  <button className="btn btn-primary" onClick={handleBook} disabled={booking} id="confirm-booking-btn">
                    {booking ? 'Booking...' : (isRecurring ? `Book ${occurrences} Weeks` : 'Confirm Booking')}
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
