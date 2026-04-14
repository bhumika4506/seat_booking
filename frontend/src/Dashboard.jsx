import React, { useState, useEffect } from 'react';
import {
  TrendingUp, Armchair, Zap, Palmtree, ShieldCheck, LayoutGrid, ChevronLeft, ChevronRight
} from 'lucide-react';
import { getStats, getSquads } from './api';
import { formatDisplay, dayName, getCurrentWeekStart, formatDate, getMonday, getSquadColor } from './utils';
import { addDays } from 'date-fns';
import { useToast } from './Toast';

export default function Dashboard({ weekStart }) {
  const [stats, setStats] = useState(null);
  const [squads, setSquads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [localWeek, setLocalWeek] = useState(weekStart);
  const toast = useToast();

  useEffect(() => {
    setLocalWeek(weekStart);
  }, [weekStart]);

  useEffect(() => {
    setLoading(true);
    Promise.all([getStats(localWeek), getSquads()])
      .then(([s, sq]) => {
        setStats(s);
        setSquads(sq);
      })
      .catch(() => toast('Failed to load dashboard data', 'error'))
      .finally(() => setLoading(false));
  }, [localWeek]);

  const navWeek = (dir) => {
    const d = new Date(localWeek + 'T00:00:00');
    setLocalWeek(formatDate(addDays(d, dir * 7)));
  };

  // Determine designated days for each squad
  const getDesignatedDays = (squad) => {
    const weekDate = new Date(localWeek + 'T00:00:00');
    const isoWeek = getISOWeek(weekDate);
    const week = isoWeek % 2 === 1 ? 1 : 2;
    const batch = squad.batch;

    if (batch === 1) {
      return week === 1 ? [0, 1, 2] : [3, 4]; // Mon,Tue,Wed or Thu,Fri
    } else {
      return week === 1 ? [3, 4] : [0, 1, 2];
    }
  };

  // Simple ISO week number helper
  function getISOWeek(d) {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  }

  if (loading) {
    return <div className="spinner-wrap"><div className="spinner"></div></div>;
  }

  if (!stats) return null;

  const maxOccupancy = Math.max(...stats.daily.map(d => d.occupancy_pct || 0), 1);

  const STAT_CARDS = [
    { label: 'Utilization', value: `${stats.utilization_pct}%`, icon: TrendingUp, color: 'var(--accent)', bg: 'var(--accent-light)' },
    { label: 'Total Bookings', value: stats.total_bookings, icon: Armchair, color: 'var(--green)', bg: 'var(--green-light)' },
    { label: 'Floater Usage', value: stats.floater_usage, icon: Zap, color: 'var(--purple)', bg: 'var(--purple-light)' },
    { label: 'Vacation Releases', value: stats.vacation_releases, icon: Palmtree, color: 'var(--orange)', bg: 'var(--orange-light)' },
    { label: 'Blocked Seats', value: stats.blocked_seats, icon: ShieldCheck, color: 'var(--yellow)', bg: 'var(--yellow-light)' },
    { label: 'Total Seats', value: stats.total_seats, icon: LayoutGrid, color: 'var(--teal)', bg: 'var(--teal-light)' },
  ];

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  return (
    <div>
      <div className="week-nav">
        <button className="btn btn-ghost" onClick={() => navWeek(-1)}><ChevronLeft size={20} /></button>
        <h3>Week of {formatDisplay(localWeek)}</h3>
        <button className="btn btn-ghost" onClick={() => navWeek(1)}><ChevronRight size={20} /></button>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid">
        {STAT_CARDS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div className="stat-card" key={i} style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="stat-icon" style={{ background: s.bg, color: s.color }}>
                <Icon size={22} />
              </div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
              {s.label === 'Utilization' && (
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${stats.utilization_pct}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Occupancy Bar Chart */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h3>Daily Occupancy</h3>
        </div>
        <div className="bar-chart">
          {stats.daily.map((d, i) => (
            <div className="bar-item" key={i}>
              <div
                className="bar-fill"
                style={{
                  height: d.is_holiday ? '4px' : `${Math.max((d.occupancy_pct / Math.max(maxOccupancy, 1)) * 100, 4)}%`,
                  opacity: d.is_holiday ? 0.3 : 1,
                }}
              >
                {!d.is_holiday && <span className="bar-value">{d.occupancy_pct}%</span>}
              </div>
              <span className="bar-label">
                {d.is_holiday ? `${dayName(d.date)} 🚫` : dayName(d.date)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Squad Schedule Table */}
      <div className="card">
        <div className="card-header">
          <h3>Squad Designated Days</h3>
          <span className="badge badge-blue">
            {getISOWeek(new Date(localWeek + 'T00:00:00')) % 2 === 1 ? 'Week 1 (Odd)' : 'Week 2 (Even)'}
          </span>
        </div>
        <table className="schedule-table">
          <thead>
            <tr>
              <th>Squad</th>
              <th>Batch</th>
              {DAYS.map(d => <th key={d}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {squads.map(sq => {
              const designated = getDesignatedDays(sq);
              return (
                <tr key={sq.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        className="squad-color-dot"
                        style={{ background: getSquadColor(sq.id) }}
                      />
                      {sq.name}
                    </div>
                  </td>
                  <td><span className={`badge ${sq.batch === 1 ? 'badge-blue' : 'badge-purple'}`}>Batch {sq.batch}</span></td>
                  {[0, 1, 2, 3, 4].map(dow => (
                    <td key={dow}>
                      {designated.includes(dow) ? <span className="check-mark">✓</span> : '—'}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
