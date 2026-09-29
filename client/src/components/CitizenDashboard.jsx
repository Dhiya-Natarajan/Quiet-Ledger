import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { createReport, fetchMyReports } from '../api/reports';
import { fetchApprovedOrganisations, fetchApprovedStations } from '../api/auth';
import Navbar from './Navbar';
import ChatThread from './ChatThread';

export default function CitizenDashboard() {
  const { token } = useAuth();
  const [tab, setTab] = useState('new');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Active chat report ID for collapsible message thread
  const [activeChatReportId, setActiveChatReportId] = useState(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reportType, setReportType] = useState('external'); // 'external' = police, 'internal' = org
  const [orgId, setOrgId] = useState('');
  const [stationId, setStationId] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Dropdown data
  const [orgs, setOrgs] = useState([]);
  const [stations, setStations] = useState([]);

  useEffect(() => {
    fetchApprovedOrganisations().then(data => setOrgs(Array.isArray(data) ? data : [])).catch(() => setOrgs([]));
    fetchApprovedStations().then(data => setStations(Array.isArray(data) ? data : [])).catch(() => setStations([]));
    loadReports();
  }, []);

  async function loadReports() {
    setLoading(true);
    setLoadError('');
    try {
      const data = await fetchMyReports(token);
      setReports(Array.isArray(data) ? data : []);
    } catch (e) {
      setLoadError(e.response?.data?.message || 'Could not load reports. Is the intake service running?');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitReport(e) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    setSuccessMsg('');
    try {
      await createReport(token, {
        title,
        description,
        type: reportType,
        orgId: reportType === 'internal' ? orgId : undefined,
        stationId: reportType === 'external' ? stationId : undefined,
        isAnonymous,
      });
      setTitle('');
      setDescription('');
      setOrgId('');
      setStationId('');
      setIsAnonymous(false);
      setSuccessMsg('Report submitted successfully!');
      loadReports();
      setTab('mine');
    } catch (e) {
      setSubmitError(e.response?.data?.message || 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  }

  const statusColors = {
    submitted: 'status-submitted',
    under_review: 'status-review',
    resolved: 'status-resolved',
    closed: 'status-closed',
  };

  return (
    <>
      <Navbar />
      <div className="dashboard-container">
        <h1 className="dashboard-title">Citizen Dashboard</h1>

        <div className="tab-bar">
          <button type="button" className={tab === 'new' ? 'tab active' : 'tab'} onClick={() => setTab('new')}>
            + File New Report
          </button>
          <button type="button" className={tab === 'mine' ? 'tab active' : 'tab'} onClick={() => setTab('mine')}>
            My Reports {reports.length > 0 && `(${reports.length})`}
          </button>
        </div>

        {tab === 'new' && (
          <div className="card">
            <h2>File a New Report</h2>
            {submitError && <div className="alert alert-error">{submitError}</div>}
            {successMsg && <div className="alert alert-success">{successMsg}</div>}
            <form onSubmit={handleSubmitReport} className="form-stack">

              <label>Title
                <input value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="Brief title of your report" required />
              </label>

              <label>Description
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Describe the incident in detail..." rows={5} required />
              </label>

              <label>Report Type
                <select value={reportType} onChange={e => setReportType(e.target.value)}>
                  <option value="external">External — Report to Police Station (crimes, public incidents)</option>
                  <option value="internal">Internal — Report to Organisation (workplace, HR, compliance)</option>
                </select>
                <span className="muted" style={{ fontSize: '0.8rem', marginTop: '0.3rem' }}>
                  {reportType === 'external'
                    ? 'Your report will be sent to the selected police station for investigation.'
                    : 'Your report will be sent to your organisation\'s compliance/HR team.'}
                </span>
              </label>

              {reportType === 'external' && (
                <label>Police Station
                  <select value={stationId} onChange={e => setStationId(e.target.value)} required>
                    <option value="">-- Select Police Station --</option>
                    {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
              )}

              {reportType === 'internal' && (
                <label>Organisation
                  <select value={orgId} onChange={e => setOrgId(e.target.value)} required>
                    <option value="">-- Select Organisation --</option>
                    {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </label>
              )}

              <div className="anon-row">
                <label className="anon-label">
                  <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} />
                  <span>Submit anonymously</span>
                </label>
                {isAnonymous && (
                  <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    Your identity will be hidden from the handler. A tracking token will be generated so you can follow up without revealing who you are.
                  </p>
                )}
              </div>

              <button className="btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </form>
          </div>
        )}

        {tab === 'mine' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <button type="button" className="btn-outline" onClick={loadReports} disabled={loading}>
                Refresh
              </button>
            </div>
            {loadError && <div className="alert alert-error">{loadError}</div>}
            {loading && <p className="muted">Loading your reports...</p>}
            {!loading && !loadError && reports.length === 0 && (
              <p className="muted">No reports yet. Use the "File New Report" tab to submit one.</p>
            )}
            <div className="report-list">
              {reports.map(r => (
                <div key={r.id} className="report-card">
                  <div className="report-header">
                    <span className="report-title">{r.title || r.description?.slice(0, 60)}</span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {r.is_anonymous && (
                        <span className="status-pill" style={{ background: 'rgba(122,129,154,0.2)', color: '#7a819a' }}>
                          Anonymous
                        </span>
                      )}
                      <span className={`status-pill ${statusColors[r.status] || ''}`}>{r.status}</span>
                    </div>
                  </div>
                  <p className="report-desc">{r.description}</p>
                  <p className="report-meta">
                    {r.type === 'external' ? 'Police report' : 'Org report'} &bull; Filed {new Date(r.created_at).toLocaleDateString()}
                    {r.tracking_token && <> &bull; Tracking: <code style={{ fontSize: '0.75rem' }}>{r.tracking_token}</code></>}
                  </p>

                  <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem' }}
                      onClick={() => setActiveChatReportId(activeChatReportId === r.id ? null : r.id)}
                    >
                      {activeChatReportId === r.id ? 'Hide Messages' : 'View / Send Messages'}
                    </button>
                  </div>

                  {activeChatReportId === r.id && (
                    <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                      <ChatThread reportId={r.id} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
