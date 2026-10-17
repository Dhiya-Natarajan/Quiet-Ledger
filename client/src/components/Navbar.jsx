import React from 'react';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { user, logout } = useAuth();
  return (
    <header className="app-header">
      <div className="header-brand">Quiet Ledger</div>
      {user && (
        <div className="header-user" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <NotificationBell />
          <span className="user-badge">{user.name}</span>
          <span className="role-badge">{user.role}</span>
          <button className="btn-outline" onClick={logout}>Log out</button>
        </div>
      )}
    </header>
  );
}
