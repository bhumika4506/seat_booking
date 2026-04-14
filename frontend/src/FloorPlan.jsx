import React, { useState, useEffect } from 'react';
import { getWeekAllocation, getHolidays } from './api';
import { formatDisplay, dayName, formatDate, getSquadColor } from './utils';
import { addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, CheckCircle, Ban } from 'lucide-react';
import { useToast } from './Toast';

export default function FloorPlan({ weekStart, currentMember, wsEvent }) {
  const [allocation, setAllocation] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [localWeek, setLocalWeek] = useState(weekStart);
  const [selectedDay, setSelectedDay] = useState(weekStart);
  const [floorTab, setFloorTab] = useState(1);
  const toast = useToast();

  const fetchData = () => {
    setLoading(true);
    Promise.all([getWeekAllocation(localWeek), getHolidays()])
      .then(([a, h]) => {
        setAllocation(a);
        setHolidays(h);
      })
      .catch(() => toast('Failed to load floor plan', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { setLocalWeek(weekStart); setSelectedDay(weekStart); }, [weekStart]);
  useEffect(() => { fetchData(); }, [localWeek]);
  useEffect(() => { if (wsEvent && wsEvent.type !== 'checkin_update') fetchData(); }, [wsEvent]);

  if (loading && !allocation) return <div className="spinner-wrap"><div className="spinner"></div></div>;
  if (!allocation) return null;

  const dayKeys = Object.keys(allocation).sort();
  const dayData = allocation[selectedDay];

  if (dayData && dayData.is_holiday) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
        <h2>🚫 {dayName(selectedDay)} is a Holiday</h2>
        <p>No seats available on holidays.</p>
      </div>
    );
  }

  // Filter seats by floor tab
  const floorSeats = dayData ? Object.values(dayData.seats).filter(s => s.floor === floorTab).sort((a,b) => a.number - b.number) : [];

  return (
    <div>
      <div className="week-nav">
        <button className="btn btn-ghost" onClick={() => {
          const d = new Date(localWeek + 'T00:00:00');
          const newWk = formatDate(addDays(d, -7));
          setLocalWeek(newWk);
          setSelectedDay(newWk);
        }}><ChevronLeft size={20} /></button>
        <h3>Week of {formatDisplay(localWeek)}</h3>
        <button className="btn btn-ghost" onClick={() => {
          const d = new Date(localWeek + 'T00:00:00');
          const newWk = formatDate(addDays(d, 7));
          setLocalWeek(newWk);
          setSelectedDay(newWk);
        }}><ChevronRight size={20} /></button>
      </div>

      <div className="filter-bar">
        {dayKeys.map(dk => (
          <button
            key={dk}
            className={`filter-chip ${selectedDay === dk ? 'active' : ''} ${allocation[dk].is_holiday ? 'danger' : ''}`}
            onClick={() => !allocation[dk].is_holiday && setSelectedDay(dk)}
          >
            {dayName(dk)} {allocation[dk].is_holiday ? '(Holiday)' : ''}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div className="filter-bar" style={{ marginBottom: 0 }}>
              <button className={`filter-chip ${floorTab === 1 ? 'active' : ''}`} onClick={() => setFloorTab(1)}>Floor 1</button>
              <button className={`filter-chip ${floorTab === 2 ? 'active' : ''}`} onClick={() => setFloorTab(2)}>Floor 2</button>
              <button className={`filter-chip ${floorTab === 3 ? 'active' : ''}`} onClick={() => setFloorTab(3)}>Floor 3</button>
            </div>
          </div>

          <div className="card">
            <div className="seat-grid">
              {floorSeats.map(seat => {
                const isAvail = seat.status === 'available';
                const isBlocked = seat.status === 'blocked';
                const isMaint = seat.status === 'maintenance';
                const isMine = seat.booking && currentMember && seat.booking.member.id === currentMember.id;

                let bgContent = null;
                if (!isAvail) {
                  if (isMaint) bgContent = { background: 'var(--red)', color: '#fff' };
                  else if (isBlocked) bgContent = { background: 'var(--orange-light)', border: '2px dashed var(--orange)', color: 'var(--orange)' };
                  else bgContent = { background: getSquadColor(seat.booking?.squad?.id) };
                }

                return (
                  <div
                    key={seat.id}
                    className={`seat-box ${isAvail ? 'available' : 'booked'}`}
                    style={bgContent || {}}
                    title={isAvail ? 'Available' : isMaint ? 'Maintenance' : isBlocked ? 'Blocked' : seat.booking?.member?.name}
                  >
                    <span className="seat-number">{seat.id}</span>
                    <span style={{ fontSize: '0.65rem' }}>Zone {seat.zone}</span>
                    {!isAvail && !isMaint && !isBlocked && (
                      <span className="seat-member">{seat.booking?.member?.name}</span>
                    )}
                    {isMaint && <Ban size={14} style={{ marginTop: '2px' }} />}
                    {isMine && !isMaint && <CheckCircle size={14} style={{ marginTop: '2px', color: '#fff' }} />}
                  </div>
                );
              })}
            </div>
            {floorSeats.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-muted)' }}>No seats on this floor.</div>}
          </div>
        </div>

        <div className="side-panel">
          <div className="card" style={{ marginBottom: '16px' }}>
            <h3>Legend</h3>
            <div className="legend-item"><div className="legend-box available"></div> Available</div>
            <div className="legend-item"><div className="legend-box floater"></div> Floater Seat</div>
            <div className="legend-item"><div className="legend-box" style={{ background: 'var(--orange-light)', border: '2px dashed var(--orange)' }}></div> Blocked</div>
            <div className="legend-item"><div className="legend-box" style={{ background: 'var(--red)' }}></div> Maintenance</div>
            <div className="legend-item"><div className="legend-box" style={{ background: 'var(--brand)' }}></div> Booked</div>
          </div>
          <div className="card">
            <h3>Designated Squads Today</h3>
            {dayData.designated_squads.length === 0 ? (
              <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem' }}>No squads designated today.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                {dayData.designated_squads.map(sq => (
                  <div key={sq.id} className="squad-badge" style={{ background: getSquadColor(sq.id) }}>
                    {sq.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
