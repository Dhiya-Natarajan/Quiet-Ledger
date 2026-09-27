import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchAllOrganisations, fetchAllStations, updateOrgStatus, updateStationStatus } from '../api/auth';
import { fetchAuditLogs, breakGlass } from '../api/reports';
import Navbar from './Navbar';

export default function AdminDashboard() {
  const { token } = useAuth();
  const [tab, setTab] = useState('orgs');
  const [orgs, setOrgs] = useState([]);
  const [stations, setStations] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [bgReportId, setBgReportId] = useState('');
  const [bgReason, setBgReason] = useState('');
  const [bgSubmitting, setBgSubmitting] = useState(false);

  async function loadOrgs() {
    setLoading(true);
    try { const data = await fetchAllOrganisations(token); setOrgs(data); }
    catch (e) { setError(e.response?.data?.message || 'Failed to load organisations'); }
    finally { setLoading(false); }
  }

  async function loadStations() {
    setLoading(true);
    try { const data = await fetchAllStations(token); setStations(data); }
    catch (e) { setError(e.response?.data?.message || 'Failed to load stations'); }
    finally { setLoading(false); }
  }

  async function loadAuditLogs() {
    setLoading(true);
    try { const data = await fetchAuditLogs(token); setAuditLogs(data); }
    catch (e) { setError(e.response?.data?.message || 'Failed to load audit logs'); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (tab === 'orgs') loadOrgs();
    else if (tab === 'stations') loadStations();
    else if (tab === 'audit') loadAuditLogs();
  }, [tab]);

  async function handleOrgStatus(id, status) {
    try { await updateOrgStatus(token, id, status); setSuccessMsg('Organisation ' + status); loadOrgs(); }
    catch (e) { setError(e.response?.data?.message || 'Failed to update'); }
  }

  async function handleStationStatus(id, status) {
    try { await updateStationStatus(token, id, status); setSuccessMsg('Station ' + status); loadStations(); }
    catch (e) { setError(e.response?.data?.message || 'Failed to update'); }
  }

  async function handleBreakGlass(e) {
    e.preventDefault();
    setBgSubmitting(true);
    setError(''); setSuccessMsg('');
    try {
      await breakGlass(token, bgReportId, bgReason);
      setSuccessMsg('Break-glass access granted for report ' + bgReportId);
      setBgReportId(''); setBgReason('');
    } catch (e) { setError(e.response?.data?.message || 'Break-glass failed'); }
    finally { setBgSubmitting(false); }
  }

  const statusBadge = (status) => {
    const cls = status === 'approved' ? 'status-resolved' : status === 'pending' ? 'status-submitted' : 'status-closed';
    return <span className={'status-pill ' + cls}>{status}</span>;
  };

  return (
    <>
      <Navbar />
      <div className="dashboard-container">
        <h1 className="dashboard-title">Admin Dashboard</h1>
        <div className="tab-bar">
          <button className={tab === 'orgs' ? 'tab active' : 'tab'} onClick={() => setTab('orgs')}>Organisations</button>
          <button className={tab === 'stations' ? 'tab active' : 'tab'} onClick={() => setTab('stations')}>Police Stations</button>
          <button className={tab === 'breakglass' ? 'tab active' : 'tab'} onClick={() => setTab('breakglass')}>Break-Glass</button>
          <button className={tab === 'audit' ? 'tab active' : 'tab'} onClick={() => setTab('audit')}>Audit Trail</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {successMsg && <div className="alert alert-success">{successMsg}</div>}

        {tab === 'orgs' && (
          <div>
            {loading && <p className="muted">Loading...</p>}
            {orgs.map(o => (
              <div key={o.id} className="report-card">
                <div className="report-header">
                  <span className="report-title">{o.name}</span>
                  {statusBadge(o.status)}
                </div>
                <p className="report-meta">{o.contact_email}</p>
                {o.status === 'pending' && (
                  <div className="action-buttons">
                    <button className="btn-primary" onClick={() => handleOrgStatus(o.id, 'approved')}>Approve</button>
                    <button className="btn-danger" onClick={() => handleOrgStatus(o.id, 'rejected')}>Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'stations' && (
          <div>
            {loading && <p className="muted">Loading...</p>}
            {stations.map(s => (
              <div key={s.id} className="report-card">
                <div className="report-header">
                  <span className="report-title">{s.name}</span>
                  {statusBadge(s.status)}
                </div>
                <p className="report-meta">{s.contact_email}</p>
                {s.status === 'pending' && (
                  <div className="action-buttons">
                    <button className="btn-primary" onClick={() => handleStationStatus(s.id, 'approved')}>Approve</button>
                    <button className="btn-danger" onClick={() => handleStationStatus(s.id, 'rejected')}>Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'breakglass' && (
          <div className="card">
            <h2>Break-Glass Access</h2>
            <p className="muted">Emergency access to any sealed report. All access is audited.</p>
            <form onSubmit={handleBreakGlass} className="form-stack">
              <label>Report ID
                <input value={bgReportId} onChange={e => setBgReportId(e.target.value)} placeholder="UUID of the report" required />
              </label>
              <label>Reason
                <textarea value={bgReason} onChange={e => setBgReason(e.target.value)} placeholder="Justification..." rows={4} required />
              </label>
              <button className="btn-danger" type="submit" disabled={bgSubmitting}>
                {bgSubmitting ? 'Accessing...' : 'Grant Break-Glass Access'}
              </button>
            </form>
          </div>
        )}

        {tab === 'audit' && (
          <div>
            {loading && <p className="muted">Loading...</p>}
            {auditLogs.length === 0 && !loading && <p className="muted">No audit entries yet.</p>}
            <div className="audit-table-wrapper">
              <table className="audit-table">
                <thead><tr><th>Time</th><th>Action</th><th>Actor</th><th>Report</th><th>Details</th></tr></thead>
                <tbody>
                  {auditLogs.map(log => (
                    <tr key={log.id}>
                      <td>{new Date(log.created_at).toLocaleString()}</td>
                      <td><span className="status-pill">{log.action}</span></td>
                      <td>{log.actor_user_id}</td>
                      <td>{log.report_id}</td>
                      <td className="audit-details">{JSON.stringify(log.details)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
