import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser, fetchApprovedOrganisations, fetchApprovedStations, requestOrganisation, requestStation } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

export default function Register() {
  const [form, setForm] = useState({
    name: '', email: '', password: '', phone_number: '', role: 'citizen', org_id: '', station_id: '',
  });
  const [orgs, setOrgs] = useState([]);
  const [stations, setStations] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Modal state for "not listed" request
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestType, setRequestType] = useState(''); // 'org' or 'station'
  const [reqForm, setReqForm] = useState({ name: '', contact_email: '', contact_phone: '' });
  const [reqSuccess, setReqSuccess] = useState('');
  const [reqError, setReqError] = useState('');
  const [reqSubmitting, setReqSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  // Load org/station lists when role changes
  useEffect(() => {
    if (form.role === 'organisation') {
      fetchApprovedOrganisations().then(setOrgs).catch(() => setOrgs([]));
    }
    if (form.role === 'police') {
      fetchApprovedStations().then(setStations).catch(() => setStations([]));
    }
  }, [form.role]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = { ...form };
      if (form.role !== 'organisation') delete payload.org_id;
      if (form.role !== 'police') delete payload.station_id;
      const data = await registerUser(payload);
      await login(data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  function openRequestModal(type) {
    setRequestType(type);
    setReqForm({ name: '', contact_email: '', contact_phone: '' });
    setReqSuccess('');
    setReqError('');
    setShowRequestModal(true);
  }

  async function handleRequestSubmit(e) {
    e.preventDefault();
    setReqSubmitting(true);
    setReqError('');
    try {
      if (requestType === 'org') {
        await requestOrganisation(reqForm);
      } else {
        await requestStation(reqForm);
      }
      setReqSuccess('Request submitted! An admin will review and approve it. Once approved, it will appear in the dropdown.');
    } catch (err) {
      setReqError(err.response?.data?.message || 'Failed to submit request');
    } finally {
      setReqSubmitting(false);
    }
  }

  const roleLabel = form.role === 'organisation' ? 'Organisation' : 'Police Station';

  return (
    <>
      <Navbar />
      <div className="auth-wrapper">
        <div className="auth-card" style={{ maxWidth: 520 }}>
          <h2>Create Account</h2>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleSubmit} className="form-stack">

            <label>Full Name
              <input value={form.name} onChange={e => update('name', e.target.value)}
                placeholder="Your full name" required />
            </label>

            <label>Email Address
              <input type="email" value={form.email} onChange={e => update('email', e.target.value)}
                placeholder="you@example.com" required />
            </label>

            <label>Phone Number
              <input type="tel" value={form.phone_number} onChange={e => update('phone_number', e.target.value)}
                placeholder="+91 98765 43210" />
            </label>

            <label>Password
              <input type="password" value={form.password} onChange={e => update('password', e.target.value)}
                placeholder="Min 8 characters" required />
            </label>

            <label>Role
              <select value={form.role} onChange={e => update('role', e.target.value)}>
                <option value="citizen">Citizen / Employee (files reports)</option>
                <option value="organisation">Organisation Handler (HR/Compliance — reviews reports sent to your org)</option>
                <option value="police">Police Station Handler (reviews reports sent to your station)</option>
                <option value="platform_admin">Platform Admin</option>
              </select>
            </label>

            {form.role === 'organisation' && (
              <div>
                <label>
                  Select Your Organisation
                  <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem', marginBottom: '0.4rem' }}>
                    Choose the organisation you work for as an HR/Compliance handler. Only approved organisations appear here.
                  </p>
                  <select value={form.org_id} onChange={e => update('org_id', e.target.value)} required>
                    <option value="">-- Select Organisation --</option>
                    {orgs.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </label>
                <button type="button" className="btn-outline" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}
                  onClick={() => openRequestModal('org')}>
                  + My organisation is not listed
                </button>
              </div>
            )}

            {form.role === 'police' && (
              <div>
                <label>
                  Select Your Police Station
                  <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem', marginBottom: '0.4rem' }}>
                    Choose the police station you work at. Only approved stations appear here.
                  </p>
                  <select value={form.station_id} onChange={e => update('station_id', e.target.value)} required>
                    <option value="">-- Select Police Station --</option>
                    {stations.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </label>
                <button type="button" className="btn-outline" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}
                  onClick={() => openRequestModal('station')}>
                  + My station is not listed
                </button>
              </div>
            )}

            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Register'}
            </button>
          </form>
          <div className="auth-footer">
            Already have an account? <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>

      {/* Not listed — Request modal */}
      {showRequestModal && (
        <div className="modal-overlay" onClick={() => setShowRequestModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Request New {roleLabel}</h3>
            <p className="muted" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
              Submit a request to add your {roleLabel.toLowerCase()} to the platform. An admin will review and approve it, after which it will appear in the dropdown above.
            </p>
            {reqSuccess ? (
              <>
                <div className="alert alert-success">{reqSuccess}</div>
                <button className="btn-outline" onClick={() => setShowRequestModal(false)}>Close</button>
              </>
            ) : (
              <form onSubmit={handleRequestSubmit} className="form-stack">
                {reqError && <div className="alert alert-error">{reqError}</div>}
                <label>{roleLabel} Name
                  <input value={reqForm.name} onChange={e => setReqForm(f => ({ ...f, name: e.target.value }))}
                    placeholder={requestType === 'org' ? 'e.g. Tata Consultancy Services' : 'e.g. Adyar Police Station'} required />
                </label>
                <label>Contact Email
                  <input type="email" value={reqForm.contact_email}
                    onChange={e => setReqForm(f => ({ ...f, contact_email: e.target.value }))}
                    placeholder="official@organisation.com" />
                </label>
                <label>Contact Phone
                  <input type="tel" value={reqForm.contact_phone}
                    onChange={e => setReqForm(f => ({ ...f, contact_phone: e.target.value }))}
                    placeholder="+91 44 1234 5678" />
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-primary" type="submit" disabled={reqSubmitting}>
                    {reqSubmitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                  <button type="button" className="btn-outline" onClick={() => setShowRequestModal(false)}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
