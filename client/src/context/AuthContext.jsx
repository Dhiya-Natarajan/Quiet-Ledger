import { createContext, useContext, useState, useEffect } from 'react';
import { fetchMe } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('ql_token') || null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: if we have a token, fetch the user from /auth/me to rehydrate state
  useEffect(() => {
    const storedToken = localStorage.getItem('ql_token');
    if (storedToken) {
      fetchMe(storedToken)
        .then(data => {
          // backend returns { user: {...} } or just the user object
          const u = data.user || data;
          setUser(u);
          setToken(storedToken);
        })
        .catch(() => {
          // Token is invalid/expired — clear it
          localStorage.removeItem('ql_token');
          setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(newToken) {
    localStorage.setItem('ql_token', newToken);
    setToken(newToken);
    try {
      const data = await fetchMe(newToken);
      const u = data.user || data;
      setUser(u);
    } catch (e) {
      console.error('Failed to fetch user after login', e);
    }
  }

  function logout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem('ql_token');
  }

  if (loading) {
    return null; // Wait until we know if the user is logged in
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
