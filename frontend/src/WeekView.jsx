import React, { useState, useEffect } from 'react';
import { getWeekAllocation, getSquads } from './api';
import { formatDisplay, dayName, getSquadColor, formatDate, fullDayName } from './utils';
import { addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useToast } from './Toast';

export default function WeekView({ weekStart }) {
  const [allocation, setAllocation] = useState(null);
  const [squads, setSquads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [localWeek, setLocalWeek] = useState(weekStart);
  const toast = useToast();

  useEffect(() => {
    setLocalWeek(weekStart);
  }, [weekStart]);

  useEffect(() => {
    setLoading(true);
    Promise.all([getWeekAllocation(localWeek), getSquads()])
      .then(([a, s]) => {
        setAllocation(a);
        setSquads(s);
      })
      .catch(() => toast('Failed to load week view', 'error'))
      .finally(() => setLoading(false));
  }, [localWeek]);

  const navWeek = (dir) => {
    const d = new Date(localWeek + 'T00:00:00');
    setLocalWeek(formatDate(addDays(d, dir * 7)));
  };

  function getISOWeek(d) {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  }

  const getDesignatedDays = (squad) => {
    const weekDate = new Date(localWeek + 'T00:00:00');
    const isoWeek = getISOWeek(weekDate);
    const week = isoWeek % 2 === 1 ? 1 : 2;
    if (squad.batch === 1) return week === 1 ? [0, 1, 2] : [3, 4];
    return week === 1 ? [3, 4] : [0, 1, 2];
  };

  if (loading) return <div className="spinner-wrap"><div className="spinner"></div></div>;
  if (!allocation) return null;

  const dayKeys = Object.keys(allocation).sort();

  return (
    <div>
      <div className="week-nav">
        <button className="btn btn-ghost" onClick={() => navWeek(-1)}><ChevronLeft size={20} /></button>
        <h3>Week of {formatDisplay(localWeek)}</h3>
        <button className="btn btn-ghost" onClick={() => navWeek(1)}><ChevronRight size={20} /></button>
      </div>

      {/* Designated Days Matrix */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h3>Designated Days Matrix</h3>
          <span className="badge badge-blue">
            {getISOWeek(new Date(localWeek + 'T00:00:00')) % 2 === 1 ? 'Week 1 (Odd)' : 'Week 2 (Even)'}
          </span>
        </div>
        <table className="schedule-table">
          <thead>
            <tr>
              <th>Squad</th>
              {dayKeys.map(dk => (
                <th key={dk}>
                  {dayName(dk)}<br />
                  <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--ink-muted)' }}>
                    {formatDisplay(dk)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {squads.map(sq => {
              const designated = getDesignatedDays(sq);
              return (
                <tr key={sq.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="squad-color-dot" style={{ background: getSquadColor(sq.id) }} />
                      {sq.name}
                      <span className={`badge ${sq.batch === 1 ? 'badge-blue' : 'badge-purple'}`} style={{ fontSize: '0.65rem' }}>B{sq.batch}</span>
                    </div>
                  </td>
                  {[0, 1, 2, 3, 4].map(dow => (
                    <td key={dow} style={{ textAlign: 'center' }}>
                      {designated.includes(dow) ? (
                        <Check size={18} style={{ color: 'var(--green)' }} />
                      ) : (
                        <span style={{ color: 'var(--surface-3)' }}>—</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Day Cards with Bookings */}
      <h3 style={{ marginBottom: '16px' }}>Daily Bookings</h3>
      <div className="day-cards">
        {dayKeys.map((dk, i) => {
          const day = allocation[dk];
          const bookings = Object.values(day.seats).filter(s => s.status === 'booked');
          const blocks = Object.values(day.seats).filter(s => s.status === 'blocked');

          return (
            <div className={`day-card ${day.is_holiday ? 'holiday' : ''}`} key={dk} style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="day-card-header">
                <h4>{dayName(dk)}</h4>
                <span className="day-date">{formatDisplay(dk)}</span>
              </div>
              {!day.is_holiday && (
                <>
                  <div style={{ marginBottom: '12px' }}>
                    <span className="badge badge-green" style={{ marginRight: '6px' }}>{bookings.length} booked</span>
                    {blocks.length > 0 && <span className="badge badge-yellow">{blocks.length} blocked</span>}
                  </div>
                  <div style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                    {bookings.slice(0, 8).map(s => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          background: getSquadColor(s.booking?.squad?.id), flexShrink: 0
                        }} />
                        <span style={{ fontWeight: 600 }}>{s.id}</span>
                        <span style={{ color: 'var(--ink-muted)' }}>{s.booking?.member?.name}</span>
                      </div>
                    ))}
                    {bookings.length > 8 && (
                      <span style={{ color: 'var(--ink-muted)', fontStyle: 'italic' }}>
                        +{bookings.length - 8} more
                      </span>
                    )}
                    {bookings.length === 0 && (
                      <span style={{ color: 'var(--ink-muted)' }}>No bookings yet</span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
