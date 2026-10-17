import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import CitizenDashboard from './components/CitizenDashboard';
import HandlerDashboard from './components/HandlerDashboard';
import AdminDashboard from './components/AdminDashboard';

function RoleDashboard() {
  const { user, token } = useAuth();

  // Token exists but user not loaded yet — wait
  if (token && !user) {
    return <div style={{ padding: '2rem', color: '#7a819a' }}>Loading...</div>;
  }

  if (!user) return <Navigate to="/login" />;

  if (user.role === 'citizen') return <CitizenDashboard />;
  if (user.role === 'platform_admin') return <AdminDashboard />;
  // organisation / police handlers
  return <HandlerDashboard />;
}

function PrivateRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <RoleDashboard />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
