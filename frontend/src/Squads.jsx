import React, { useState, useEffect } from 'react';
import { getSquads } from './api';
import { getSquadColor, getInitials } from './utils';
import { Users, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from './Toast';

export default function Squads() {
  const [squads, setSquads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSquad, setExpandedSquad] = useState(null);
  const toast = useToast();

  useEffect(() => {
    getSquads()
      .then(setSquads)
      .catch(() => toast('Failed to load squads', 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner-wrap"><div className="spinner"></div></div>;

  return (
    <div>
      <h2 style={{ marginBottom: '24px' }}>
        <Users size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
        Squad Directory
      </h2>

      <div className="squads-grid">
        {squads.map((sq, i) => {
          const color = getSquadColor(sq.id);
          const isExpanded = expandedSquad === sq.id;

          return (
            <div
              className="squad-card"
              key={sq.id}
              style={{ animationDelay: `${i * 0.06}s` }}
              onClick={() => setExpandedSquad(isExpanded ? null : sq.id)}
              id={`squad-card-${sq.id}`}
            >
              <div className="squad-card-header">
                <div className="squad-color-dot" style={{ background: color }} />
                <h3 style={{ flex: 1 }}>{sq.name}</h3>
                <span className={`badge ${sq.batch === 1 ? 'badge-blue' : 'badge-purple'}`}>
                  Batch {sq.batch}
                </span>
                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>

              {/* Stacked Avatars */}
              <div className="member-avatars-stack">
                {sq.members.slice(0, 6).map(m => (
                  <div
                    className="member-avatar"
                    key={m.id}
                    style={{ background: color, color: '#fff', width: '32px', height: '32px', fontSize: '0.7rem' }}
                    title={m.name}
                  >
                    {getInitials(m.name)}
                  </div>
                ))}
                {sq.members.length > 6 && (
                  <div
                    className="member-avatar"
                    style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)', width: '32px', height: '32px', fontSize: '0.7rem' }}
                  >
                    +{sq.members.length - 6}
                  </div>
                )}
              </div>

              <div style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', marginTop: '8px' }}>
                {sq.members.length} members
              </div>

              {/* Expanded Members */}
              {isExpanded && (
                <div className="squad-members-list" onClick={e => e.stopPropagation()}>
                  {sq.members.map(m => (
                    <div className="squad-member-row" key={m.id}>
                      <div
                        className="member-avatar"
                        style={{ background: color, color: '#fff', width: '30px', height: '30px', fontSize: '0.68rem' }}
                      >
                        {getInitials(m.name)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{m.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{m.email}</div>
                      </div>
                      <span className="member-id">{m.id}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
