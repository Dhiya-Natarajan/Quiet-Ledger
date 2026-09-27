import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  return (
    <header className="app-header">
      <div className="header-brand">🔒 Quiet Ledger</div>
      {user && (
        <div className="header-user">
          <span className="user-badge">{user.name}</span>
          <span className="role-badge">{user.role}</span>
          <button className="btn-outline" onClick={logout}>Log out</button>
        </div>
      )}
    </header>
  );
}
