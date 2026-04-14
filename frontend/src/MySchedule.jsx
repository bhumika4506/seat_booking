import React, { useState, useEffect } from 'react';
import { getMemberSchedule, getSeats, bookSeat, releaseSeat } from './api';
import { formatDisplay, dayName, formatDate, getSquadColor } from './utils';
import { addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Armchair, Calendar, CheckCircle2, XCircle, Palmtree } from 'lucide-react';
import { useToast } from './Toast';

export default function MySchedule({ weekStart, currentMember }) {
  const [schedule, setSchedule] = useState(null);
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [localWeek, setLocalWeek] = useState(weekStart);
  const [selectedSeat, setSelectedSeat] = useState({});
  const [booking, setBooking] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setLocalWeek(weekStart);
  }, [weekStart]);

  useEffect(() => {
    if (!currentMember) return;
    setLoading(true);
    Promise.all([
      getMemberSchedule(currentMember.id, localWeek),
      getSeats()
    ])
      .then(([s, allSeats]) => {
        setSchedule(s);
        setSeats(allSeats);
      })
      .catch(() => toast('Failed to load schedule', 'error'))
      .finally(() => setLoading(false));
  }, [localWeek, currentMember]);

  const navWeek = (dir) => {
    const d = new Date(localWeek + 'T00:00:00');
    setLocalWeek(formatDate(addDays(d, dir * 7)));
  };

  const refresh = () => {
    if (!currentMember) return;
    getMemberSchedule(currentMember.id, localWeek).then(setSchedule);
  };

  const handleBook = async (date) => {
    const seatId = selectedSeat[date];
    if (!seatId) {
      toast('Please select a seat first', 'warning');
      return;
    }
    setBooking(true);
    try {
      await bookSeat({ member_id: currentMember.id, seat_id: seatId, date });
      toast('Seat booked successfully!', 'success');
      refresh();
    } catch (e) {
      toast(e.response?.data?.detail || 'Booking failed', 'error');
    } finally {
      setBooking(false);
    }
  };

  const handleRelease = async (date) => {
    try {
      await releaseSeat({ member_id: currentMember.id, date });
      toast('Seat released', 'success');
      refresh();
    } catch (e) {
      toast(e.response?.data?.detail || 'Release failed', 'error');
    }
  };

  if (!currentMember) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
        <h2 style={{ marginBottom: '8px' }}>👤 Select a Member</h2>
        <p style={{ color: 'var(--ink-muted)' }}>Use the member selector in the top bar to pick your profile</p>
      </div>
    );
  }

  if (loading) return <div className="spinner-wrap"><div className="spinner"></div></div>;
  if (!schedule) return null;

  const designatedCount = schedule.schedule.filter(d => d.is_designated && !d.is_holiday).length;
  const bookedCount = schedule.schedule.filter(d => d.booking).length;

  return (
    <div>
      <div className="week-nav">
        <button className="btn btn-ghost" onClick={() => navWeek(-1)}><ChevronLeft size={20} /></button>
        <h3>Week of {formatDisplay(localWeek)}</h3>
        <button className="btn btn-ghost" onClick={() => navWeek(1)}><ChevronRight size={20} /></button>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div className="badge badge-blue" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
          <Calendar size={14} /> Designated: {designatedCount} days
        </div>
        <div className="badge badge-green" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
          <Armchair size={14} /> Booked: {bookedCount} seats
        </div>
        <div className="badge badge-orange" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
          Remaining: {Math.max(designatedCount - bookedCount, 0)}
        </div>
      </div>

      {/* Day Cards */}
      <div className="day-cards">
        {schedule.schedule.map((day, i) => (
          <div
            className={`day-card ${day.is_holiday ? 'holiday' : ''}`}
            key={day.date}
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <div className="day-card-header">
              <h4>{dayName(day.date)}</h4>
              <span className="day-date">{formatDisplay(day.date)}</span>
            </div>

            {!day.is_holiday && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Designation Status */}
                <div>
                  {day.is_designated ? (
                    <span className="badge badge-green">
                      <CheckCircle2 size={12} /> Designated Day
                    </span>
                  ) : (
                    <span className="badge badge-orange">
                      <XCircle size={12} /> Non-Designated
                    </span>
                  )}
                </div>

                {/* Vacation Status */}
                {day.vacation && (
                  <div className="badge badge-purple">
                    <Palmtree size={12} /> On Vacation
                  </div>
                )}

                {/* Booking Status */}
                {day.booking ? (
                  <div>
                    <div style={{ fontSize: '0.88rem', marginBottom: '8px' }}>
                      <strong>Seat:</strong>{' '}
                      <span style={{
                        padding: '4px 10px', borderRadius: '6px',
                        background: getSquadColor(schedule.squad.id), color: '#fff',
                        fontWeight: 700, fontSize: '0.82rem'
                      }}>
                        {day.booking.seat?.id}
                      </span>
                      {day.booking.seat?.is_floater && (
                        <span className="badge badge-teal" style={{ marginLeft: '6px' }}>Floater</span>
                      )}
                    </div>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleRelease(day.date)}
                    >
                      Release Seat
                    </button>
                  </div>
                ) : !day.vacation ? (
                  <div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select
                        className="select-input"
                        value={selectedSeat[day.date] || ''}
                        onChange={(e) => setSelectedSeat({ ...selectedSeat, [day.date]: e.target.value })}
                        style={{ flex: 1 }}
                      >
                        <option value="">Select seat...</option>
                        {seats
                          .filter(s => day.is_designated || s.is_floater)
                          .map(s => (
                            <option key={s.id} value={s.id}>
                              {s.id} {s.is_floater ? '(Floater)' : '(Fixed)'}
                            </option>
                          ))}
                      </select>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleBook(day.date)}
                        disabled={!selectedSeat[day.date] || booking}
                      >
                        Book
                      </button>
                    </div>
                    {!day.is_designated && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: '6px' }}>
                        Only floater seats available (non-designated day)
                      </p>
                    )}
                  </div>
                ) : null}

                {/* Block Info */}
                {day.block && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--yellow)' }}>
                    🔒 Blocked seat: {day.block.seat?.id}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
