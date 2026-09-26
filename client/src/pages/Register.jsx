import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerUser } from '../api/auth';
import { useAuth } from '../context/AuthContext';

const inputStyle = { display: 'block', width: '100%', marginBottom: 10, padding: 8 };

export default function Register() {
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'citizen', orgId: '', stationId: '',
  });
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const data = await registerUser(form);
      login(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto' }}>
      <h2>Create an account</h2>
      <form onSubmit={handleSubmit}>
        <input placeholder="Name" value={form.name} onChange={(e) => update('name', e.target.value)} required style={inputStyle} />
        <input type="email" placeholder="Email" value={form.email} onChange={(e) => update('email', e.target.value)} required style={inputStyle} />
        <input type="password" placeholder="Password" value={form.password} onChange={(e) => update('password', e.target.value)} required style={inputStyle} />

        <select value={form.role} onChange={(e) => update('role', e.target.value)} style={inputStyle}>
          <option value="citizen">Citizen / Employee</option>
          <option value="organisation">Organisation (HR/Compliance)</option>
          <option value="police">Police Station</option>
          <option value="platform_admin">Platform Admin</option>
        </select>

        {/* TODO: replace with a dropdown fetched from GET /organisations once that
            endpoint exists. For now, enter the seeded id directly (e.g. 1). */}
        {form.role === 'organisation' && (
          <input placeholder="Organisation ID" value={form.orgId} onChange={(e) => update('orgId', e.target.value)} required style={inputStyle} />
        )}
        {form.role === 'police' && (
          <input placeholder="Police Station ID" value={form.stationId} onChange={(e) => update('stationId', e.target.value)} required style={inputStyle} />
        )}

        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" style={{ width: '100%', padding: 10 }}>Register</button>
      </form>
      <p>Already have an account? <a href="/login">Log in</a></p>
    </div>
  );
}