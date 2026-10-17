import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  fetchMyNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../api/communication';

export default function NotificationBell() {
  const { user, token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Target User IDs for communication service:
  // Citizen: [String(user.id)]
  // Organisation Handler: [String(user.id), `org-${user.orgId || user.org_id}`]
  // Police Handler: [String(user.id), `station-${user.stationId || user.station_id}`]
  // Admin: [String(user.id), 'platform-admins']
  const targetUserIds = React.useMemo(() => {
    if (!user) return [];
    const ids = [String(user.id)];
    if (user.role === 'organisation' && (user.orgId || user.org_id)) {
      ids.push(`org-${user.orgId || user.org_id}`);
    }
    if (user.role === 'police' && (user.stationId || user.station_id)) {
      ids.push(`station-${user.stationId || user.station_id}`);
    }
    if (user.role === 'platform_admin') {
      ids.push('platform-admins');
    }
    return ids;
  }, [user]);

  async function refresh() {
    if (!token || targetUserIds.length === 0) return;
    try {
      const results = await Promise.all(
        targetUserIds.map((id) =>
          Promise.all([fetchMyNotifications(token, id), fetchUnreadCount(token, id)])
        )
      );

      const seen = new Set();
      const mergedFeed = [];
      let totalUnread = 0;

      for (const [feed, count] of results) {
        totalUnread += (typeof count === 'number' ? count : 0);
        if (Array.isArray(feed)) {
          for (const item of feed) {
            if (!seen.has(item.id)) {
              seen.add(item.id);
              mergedFeed.push(item);
            }
          }
        }
      }

      mergedFeed.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setNotifications(mergedFeed);
      setUnreadCount(totalUnread);
    } catch (_) {}
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [token, targetUserIds]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleMarkRead(id, e) {
    e.stopPropagation();
    await markNotificationRead(token, id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }

  async function handleMarkAllRead() {
    await Promise.all(targetUserIds.map((id) => markAllNotificationsRead(token, id)));
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  if (!user) return null;

  return (
    <div className="notification-bell-container" ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className="btn-bell"
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open) refresh();
        }}
        style={{
          background: 'transparent',
          border: '1px solid var(--border, #333)',
          borderRadius: '50%',
          width: '36px',
          height: '36px',
          cursor: 'pointer',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text, #fff)',
          fontSize: '1rem',
        }}
        title="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              backgroundColor: '#e53e3e',
              color: '#fff',
              borderRadius: '9999px',
              fontSize: '0.65rem',
              fontWeight: 700,
              padding: '2px 5px',
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="notification-dropdown"
          style={{
            position: 'absolute',
            right: 0,
            top: '44px',
            width: '320px',
            maxHeight: '400px',
            backgroundColor: 'var(--surface, #1e1e24)',
            border: '1px solid var(--border, #3a3a46)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              borderBottom: '1px solid var(--border, #3a3a46)',
              backgroundColor: 'var(--surface2, #262630)',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
              Notifications {unreadCount > 0 && `(${unreadCount})`}
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent, #6366f1)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted, #888)', fontSize: '0.8rem' }}>
                No notifications yet.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={(e) => !n.read && handleMarkRead(n.id, e)}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border, #2a2a36)',
                    backgroundColor: n.read ? 'transparent' : 'rgba(99, 102, 241, 0.08)',
                    cursor: n.read ? 'default' : 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor:
                          n.type === 'BREAK_GLASS_ALERT'
                            ? '#e53e3e'
                            : n.type === 'STATUS_CHANGED'
                            ? '#d69e2e'
                            : '#4f46e5',
                        color: '#fff',
                        fontWeight: 600,
                      }}
                    >
                      {n.type || 'ALERT'}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--muted, #777)' }}>
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#fff', marginBottom: '2px' }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted, #aaa)', lineHeight: 1.3 }}>
                    {n.message}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
