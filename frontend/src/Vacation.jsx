import React, { useState, useEffect } from 'react';
import { getMemberSchedule, markVacation, removeVacation } from './api';
import { formatDisplay, dayName, formatDate } from './utils';
import { addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Palmtree, Info, Trash2, Plus } from 'lucide-react';
import { useToast } from './Toast';

export default function Vacation({ weekStart, currentMember }) {
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [localWeek, setLocalWeek] = useState(weekStart);
  const [processing, setProcessing] = useState(null);
  const toast = useToast();

  useEffect(() => {
    setLocalWeek(weekStart);
  }, [weekStart]);

  useEffect(() => {
    if (!currentMember) return;
    setLoading(true);
    getMemberSchedule(currentMember.id, localWeek)
      .then(setSchedule)
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

  const handleMarkVacation = async (date) => {
    setProcessing(date);
    try {
      const res = await markVacation({ member_id: currentMember.id, date });
      toast(res.message, 'success');
      refresh();
    } catch (e) {
      toast(e.response?.data?.detail || 'Failed to mark vacation', 'error');
    } finally {
      setProcessing(null);
    }
  };

  const handleRemoveVacation = async (date) => {
    setProcessing(date);
    try {
      await removeVacation(currentMember.id, date);
      toast('Vacation removed', 'success');
      refresh();
    } catch (e) {
      toast(e.response?.data?.detail || 'Failed to remove vacation', 'error');
    } finally {
      setProcessing(null);
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
  if (!schedule) return null;

  return (
    <div>
      <h2 style={{ marginBottom: '20px' }}>
        <Palmtree size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
        Vacation Manager
      </h2>

      <div className="info-banner">
        <Info size={18} />
        <span>Marking a vacation on a booked day will <strong>automatically release</strong> your seat reservation.</span>
      </div>

      <div className="week-nav">
        <button className="btn btn-ghost" onClick={() => navWeek(-1)}><ChevronLeft size={20} /></button>
        <h3>Week of {formatDisplay(localWeek)}</h3>
        <button className="btn btn-ghost" onClick={() => navWeek(1)}><ChevronRight size={20} /></button>
      </div>

      <div className="day-cards">
        {schedule.schedule.map((day, i) => {
          const isHoliday = day.is_holiday;
          const isOnVacation = !!day.vacation;
          const hasBooking = !!day.booking;
          const isProcessing = processing === day.date;

          return (
            <div
              className={`day-card ${isHoliday ? 'holiday' : ''}`}
              key={day.date}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="day-card-header">
                <h4>{dayName(day.date)}</h4>
                <span className="day-date">{formatDisplay(day.date)}</span>
              </div>

              {!isHoliday && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Status badges — hide designation when on vacation */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {!isOnVacation && day.is_designated && <span className="badge badge-green">Designated</span>}
                    {!isOnVacation && !day.is_designated && <span className="badge badge-orange">Non-Designated</span>}
                    {hasBooking && !isOnVacation && (
                      <span className="badge badge-blue">
                        Seat {day.booking.seat?.id}
                      </span>
                    )}
                    {isOnVacation && <span className="badge" style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}>🌴 Vacation</span>}
                  </div>

                  {/* Vacation status */}
                  {isOnVacation ? (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px', borderRadius: '8px', background: 'var(--purple-light)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--purple)' }}>
                        <Palmtree size={16} />
                        <strong>On Vacation</strong>
                      </div>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleRemoveVacation(day.date)}
                        disabled={isProcessing}
                      >
                        <Trash2 size={14} />
                        {isProcessing ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleMarkVacation(day.date)}
                      disabled={isProcessing}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      <Plus size={14} />
                      {isProcessing ? 'Marking...' : 'Mark Vacation'}
                      {hasBooking && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--red)', marginLeft: '4px' }}>
                          (will release seat)
                        </span>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
