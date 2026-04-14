import React, { useState, useEffect, useRef } from 'react';
import { getMembers, resetData } from './api';
import { getCurrentWeekStart, getSquadColor, getInitials } from './utils';
import { ToastProvider, useToast } from './Toast';
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';
import FloorPlan from './FloorPlan';
import WeekView from './WeekView';
import MySchedule from './MySchedule';
import BookSeat from './BookSeat';
import BlockSeat from './BlockSeat';
import Vacation from './Vacation';
import Squads from './Squads';
import { ChevronDown, RotateCcw, Search } from 'lucide-react';

function AppInner() {
  const [page, setPage] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [members, setMembers] = useState([]);
  const [currentMember, setCurrentMember] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [weekStart, setWeekStart] = useState(getCurrentWeekStart());
  const dropdownRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    getMembers()
      .then(m => {
        setMembers(m);
        if (m.length > 0) setCurrentMember(m[0]);
      })
      .catch(() => toast('Failed to load members', 'error'));
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.id.toLowerCase().includes(search.toLowerCase()) ||
    m.squad_id.toLowerCase().includes(search.toLowerCase())
  );

  const handleReset = async () => {
    if (!confirm('Reset all data? This will clear all bookings, vacations, and blocks.')) return;
    try {
      await resetData();
      toast('Data reset successfully', 'success');
      // Refresh
      const m = await getMembers();
      setMembers(m);
      if (m.length > 0) setCurrentMember(m[0]);
      setPage('dashboard');
    } catch (e) {
      toast('Reset failed', 'error');
    }
  };

  const PAGE_TITLES = {
    dashboard: 'Dashboard',
    floorplan: 'Floor Plan',
    weekview: 'Week View',
    myschedule: 'My Schedule',
    bookseat: 'Book a Seat',
    blockseat: 'Block Seat',
    vacation: 'Vacation',
    squads: 'Squads',
  };

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard weekStart={weekStart} />;
      case 'floorplan':
        return <FloorPlan weekStart={weekStart} currentMember={currentMember} />;
      case 'weekview':
        return <WeekView weekStart={weekStart} />;
      case 'myschedule':
        return <MySchedule weekStart={weekStart} currentMember={currentMember} />;
      case 'bookseat':
        return <BookSeat weekStart={weekStart} currentMember={currentMember} />;
      case 'blockseat':
        return <BlockSeat weekStart={weekStart} currentMember={currentMember} />;
      case 'vacation':
        return <Vacation weekStart={weekStart} currentMember={currentMember} />;
      case 'squads':
        return <Squads />;
      default:
        return <Dashboard weekStart={weekStart} />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar
        page={page}
        setPage={setPage}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        currentMember={currentMember}
      />

      <div className={`main-area ${collapsed ? 'collapsed' : ''}`}>
        <div className="topbar">
          <div className="topbar-left">
            <h2>{PAGE_TITLES[page] || 'SeatFlow'}</h2>
          </div>
          <div className="topbar-right">
            <button className="reset-btn" onClick={handleReset} id="reset-btn">
              <RotateCcw size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Reset
            </button>

            {/* Member Selector */}
            <div className="member-selector" ref={dropdownRef}>
              <button
                className="member-selector-btn"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                id="member-selector-btn"
              >
                {currentMember && (
                  <div
                    className="member-avatar"
                    style={{
                      background: getSquadColor(currentMember.squad_id),
                      color: '#fff',
                      width: '28px',
                      height: '28px',
                      fontSize: '0.7rem',
                    }}
                  >
                    {getInitials(currentMember.name)}
                  </div>
                )}
                <span>{currentMember ? currentMember.name : 'Select Member'}</span>
                <ChevronDown size={16} />
              </button>

              {dropdownOpen && (
                <div className="member-dropdown">
                  <div className="member-dropdown-search">
                    <input
                      type="text"
                      placeholder="Search members..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      autoFocus
                      id="member-search-input"
                    />
                  </div>
                  <div className="member-dropdown-list">
                    {filteredMembers.map(m => (
                      <div
                        key={m.id}
                        className={`member-option ${currentMember?.id === m.id ? 'selected' : ''}`}
                        onClick={() => {
                          setCurrentMember(m);
                          setDropdownOpen(false);
                          setSearch('');
                        }}
                      >
                        <div
                          className="member-avatar"
                          style={{
                            background: getSquadColor(m.squad_id),
                            color: '#fff',
                            width: '32px',
                            height: '32px',
                            fontSize: '0.72rem',
                          }}
                        >
                          {getInitials(m.name)}
                        </div>
                        <div className="member-option-info">
                          <div className="member-option-name">{m.name}</div>
                          <div className="member-option-squad">
                            {m.squad_id.replace('_', ' ')} · {m.id}
                          </div>
                        </div>
                      </div>
                    ))}
                    {filteredMembers.length === 0 && (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--ink-muted)' }}>
                        No members found
                      </div>
                    )}
                  </div>
                </div>
              )}
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
