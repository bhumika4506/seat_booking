import React from 'react';
import { 
  LayoutDashboard, Grid, CalendarDays, User, 
  Armchair, Ban, Palmtree, Users, ChevronLeft,
  ChevronRight, LogOut, Clock, QrCode, Shield
} from 'lucide-react';

export default function Sidebar({ page, setPage, collapsed, setCollapsed, currentMember, onLogout }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'floorplan', label: 'Floor Plan', icon: <Grid size={20} /> },
    { id: 'weekview', label: 'Week View', icon: <CalendarDays size={20} /> },
    { id: 'squads', label: 'Squads Directory', icon: <Users size={20} /> },
  ];

  const personalItems = [
    { id: 'bookseat', label: 'Book a Seat', icon: <Armchair size={20} /> },
    { id: 'checkin', label: 'Check-In (QR)', icon: <QrCode size={20} /> },
    { id: 'myschedule', label: 'My Schedule', icon: <User size={20} /> },
    { id: 'history', label: 'Booking History', icon: <Clock size={20} /> },
    { id: 'blockseat', label: 'Block Seat', icon: <Ban size={20} /> },
    { id: 'vacation', label: 'Vacation', icon: <Palmtree size={20} /> },
  ];

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="logo-area">
          <Armchair size={24} color="var(--brand)" />
          {!collapsed && <h1>SeatFlow</h1>}
        </div>
        <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <div className="nav-group">
        {!collapsed && <div className="nav-group-title">Overview</div>}
        {navItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${page === item.id ? 'active' : ''}`}
            onClick={() => setPage(item.id)}
            title={collapsed ? item.label : ''}
          >
            {item.icon}
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </div>

      <div className="nav-group">
        {!collapsed && <div className="nav-group-title">Me</div>}
        {personalItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${page === item.id ? 'active' : ''}`}
            onClick={() => setPage(item.id)}
            title={collapsed ? item.label : ''}
          >
            {item.icon}
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </div>

      {currentMember?.role === 'admin' && (
        <div className="nav-group">
          {!collapsed && <div className="nav-group-title">Admin</div>}
          <button
            className={`nav-item ${page === 'admin' ? 'active' : ''} admin-nav`}
            onClick={() => setPage('admin')}
            title={collapsed ? 'Admin Panel' : ''}
          >
            <Shield size={20} />
            {!collapsed && <span>Admin Panel</span>}
          </button>
        </div>
      )}

      <div style={{ flex: 1 }}></div>

      <div className="nav-group" style={{ marginBottom: '20px' }}>
        <button className="nav-item text-danger" onClick={onLogout} title={collapsed ? 'Logout' : ''}>
          <LogOut size={20} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
}
