import React, { useState, useEffect } from 'react';
import { getMe, resetData } from './api';
import { getCurrentWeekStart, getSquadColor, getInitials } from './utils';
import { ToastProvider, useToast } from './Toast';
import { useWebSocket } from './useWebSocket';
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';
import FloorPlan from './FloorPlan';
import WeekView from './WeekView';
import MySchedule from './MySchedule';
import BookSeat from './BookSeat';
import BlockSeat from './BlockSeat';
import Vacation from './Vacation';
import Squads from './Squads';
import Login from './Login';
import Notifications from './Notifications';
import BookingHistory from './BookingHistory';
import CheckIn from './CheckIn';
import AdminPanel from './AdminPanel';
import { RotateCcw } from 'lucide-react';

function AppInner() {
  const [page, setPage] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [currentMember, setCurrentMember] = useState(null);
  const [weekStart, setWeekStart] = useState(getCurrentWeekStart());
  const [loading, setLoading] = useState(true);
  const [wsEvent, setWsEvent] = useState(null);
  const toast = useToast();

  const isConnected = useWebSocket((data) => {
    setWsEvent(data); // Pass down to children that care
  });

  useEffect(() => {
    const handleAuthError = () => {
      setCurrentMember(null);
    };
    window.addEventListener('auth-error', handleAuthError);
    return () => window.removeEventListener('auth-error', handleAuthError);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('seatflow_token');
    if (token) {
      getMe()
        .then(m => setCurrentMember(m))
        .catch(() => setCurrentMember(null))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('seatflow_token');
    setCurrentMember(null);
  };

  const handleReset = async () => {
    if (!confirm('Reset all data? This will clear all bookings, vacations, and blocks.')) return;
    try {
      await resetData();
      toast('Data reset successfully', 'success');
      setPage('dashboard');
    } catch (e) {
      toast('Reset failed', 'error');
    }
  };

  if (loading) {
    return <div className="spinner-wrap"><div className="spinner"></div></div>;
  }

  if (!currentMember) {
    return <Login onLoginSuccess={(m) => setCurrentMember(m)} />;
  }

  const PAGE_TITLES = {
    dashboard: 'Dashboard', floorplan: 'Floor Plan', weekview: 'Week View',
    myschedule: 'My Schedule', bookseat: 'Book a Seat', blockseat: 'Block Seat',
    vacation: 'Vacation', squads: 'Squads', history: 'Booking History',
    checkin: 'Check-In', admin: 'Admin Panel'
  };

  const renderPage = () => {
    const props = { weekStart, currentMember, wsEvent };
    switch (page) {
      case 'dashboard': return <Dashboard {...props} />;
      case 'floorplan': return <FloorPlan {...props} />;
      case 'weekview': return <WeekView {...props} />;
      case 'myschedule': return <MySchedule {...props} />;
      case 'bookseat': return <BookSeat {...props} />;
      case 'blockseat': return <BlockSeat {...props} />;
      case 'vacation': return <Vacation {...props} />;
      case 'squads': return <Squads />;
      case 'history': return <BookingHistory {...props} />;
      case 'checkin': return <CheckIn {...props} />;
      case 'admin': return currentMember.role === 'admin' ? <AdminPanel {...props} /> : <Dashboard {...props} />;
      default: return <Dashboard {...props} />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar
        page={page} setPage={setPage}
        collapsed={collapsed} setCollapsed={setCollapsed}
        currentMember={currentMember}
        onLogout={handleLogout}
      />

      <div className={`main-area ${collapsed ? 'collapsed' : ''}`}>
        <div className="topbar">
          <div className="topbar-left">
            <h2>{PAGE_TITLES[page] || 'SeatFlow'}</h2>
            {!isConnected && <span className="badge badge-orange" style={{ marginLeft: '12px' }}>Offline</span>}
          </div>
          <div className="topbar-right">
            {currentMember.role === 'admin' && (
              <button className="reset-btn" onClick={handleReset}>
                <RotateCcw size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                Reset
              </button>
            )}

            <Notifications currentMember={currentMember} wsEvent={wsEvent} />

            <div className="member-badge">
              <div
                className="member-avatar"
                style={{ background: getSquadColor(currentMember.squad_id), color: '#fff' }}
              >
                {getInitials(currentMember.name)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{currentMember.name}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', textTransform: 'capitalize' }}>
                  {currentMember.role} · {currentMember.squad_id.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="page-content">
          {renderPage()}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
