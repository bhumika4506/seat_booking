import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trash2 } from 'lucide-react';
import { getNotifications, markNotificationsRead } from './api';
import { formatDisplay } from './utils';

export default function Notifications({ currentMember, wsEvent }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const dropdownRef = useRef(null);

  const fetchNotifs = () => {
    if (!currentMember) return;
    getNotifications(currentMember.id).then(setNotifications).catch(console.error);
  };

  useEffect(() => {
    fetchNotifs();
  }, [currentMember]);

  useEffect(() => {
    if (wsEvent) fetchNotifs();
  }, [wsEvent]);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleOpen = () => {
    setOpen(!open);
    if (!open && unreadCount > 0) {
      // Mark as read in background
      markNotificationsRead(currentMember.id).then(() => {
        setTimeout(fetchNotifs, 1500);
      });
    }
  };

  return (
    <div className="notif-container" ref={dropdownRef}>
      <button className="notif-btn" onClick={handleOpen}>
        <Bell size={20} />
        {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <h4>Notifications</h4>
          </div>
          <div className="notif-list">
            {notifications.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--ink-muted)' }}>No notifications</div>
            ) : (
              notifications.map(n => (
                <div key={n.id} className={`notif-item ${!n.read ? 'unread' : ''}`}>
                  <div className="notif-time">{new Date(n.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} · {formatDisplay(n.timestamp)}</div>
                  <div className="notif-message">{n.message}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
