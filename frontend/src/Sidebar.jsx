import React from 'react';
import {
  LayoutDashboard, Map, CalendarDays, User, Armchair,
  ShieldCheck, Palmtree, Users, PanelLeftClose, PanelLeft
} from 'lucide-react';
import { getSquadColor, getInitials } from './utils';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'floorplan', label: 'Floor Plan', icon: Map },
  { id: 'weekview', label: 'Week View', icon: CalendarDays },
  { id: 'myschedule', label: 'My Schedule', icon: User },
  { id: 'bookseat', label: 'Book a Seat', icon: Armchair },
  { id: 'blockseat', label: 'Block Seat', icon: ShieldCheck },
  { id: 'vacation', label: 'Vacation', icon: Palmtree },
  { id: 'squads', label: 'Squads', icon: Users },
];

export default function Sidebar({ page, setPage, collapsed, setCollapsed, currentMember }) {
  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-logo">
        <div className="logo-icon">💺</div>
        {!collapsed && (
          <h1>Seat<span>Flow</span></h1>
        )}
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              onClick={() => setPage(item.id)}
              id={`nav-${item.id}`}
            >
              <Icon size={20} />
              {!collapsed && <span>{item.label}</span>}
            </div>
          );
        })}
      </nav>

      {currentMember && (
        <div className="sidebar-member">
          <div
            className="member-avatar"
            style={{
              background: getSquadColor(currentMember.squad_id),
              color: '#fff',
            }}
          >
            {getInitials(currentMember.name)}
          </div>
          {!collapsed && (
            <div className="sidebar-member-info">
              <div className="member-name">{currentMember.name}</div>
              <div className="member-squad">{currentMember.squad_id?.replace('_', ' ')}</div>
            </div>
          )}
        </div>
      )}

      <div className="sidebar-toggle">
        <button onClick={() => setCollapsed(!collapsed)} id="sidebar-toggle-btn">
          {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>
    </div>
  );
}
