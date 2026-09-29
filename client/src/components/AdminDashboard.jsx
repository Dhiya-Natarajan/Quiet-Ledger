import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchAllOrganisations, fetchAllStations, updateOrgStatus, updateStationStatus } from '../api/auth';
import { fetchAuditLogs, breakGlass, fetchAssignedReports } from '../api/reports';
import Navbar from './Navbar';

function formatDisclosureText(d) {
  if (!d) return '';
  const auth = d.authorization || {};
  const ctx = d.context || {};
  const idn = d.unsealed_identity || {};

  const authTime = auth.timestamp ? new Date(auth.timestamp).toLocaleString() : '';
  const subTime = ctx.originally_submitted ? new Date(ctx.originally_submitted).toLocaleString() : '';

  return `BREAK-GLASS DISCLOSURE — Report #${d.report_id}

-- Disclosure Authorization --
Requested By: Platform Admin (admin_id: ${auth.admin_id}, "${auth.admin_name}")
Reason for Disclosure: "${auth.reason}"
Disclosure Timestamp: ${authTime}

-- Report Context --
Title: ${ctx.title}
Description: ${ctx.description}
Type: ${ctx.type} (Target: ${ctx.target})
Filed As: ${ctx.filed_as}
Tracking Token: ${ctx.tracking_token}
Originally Submitted: ${subTime}
Current Status: ${ctx.current_status}

-- Unsealed Identity --
Reporter: ${idn.role ? idn.role.charAt(0).toUpperCase() + idn.role.slice(1) : 'Citizen'}, User ID ${idn.reporter_id}
Name: ${idn.name}
Email: ${idn.email}${idn.phone_number ? `\nPhone: ${idn.phone_number}` : ''}`;
}

export default function AdminDashboard() {
  const { token } = useAuth();
  const [tab, setTab] = useState('orgs');
  const [orgs, setOrgs] = useState([]);
  const [stations, setStations] = useState([]);
  const [reports, setReports] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Break-glass state
  const [bgReportId, setBgReportId] = useState('');
  const [bgReason, setBgReason] = useState('');
  const [bgSubmitting, setBgSubmitting] = useState(false);
  const [disclosureData, setDisclosureData] = useState(null);
  const [copied, setCopied] = useState(false);

  async function loadOrgs() {
    setLoading(true);
    try {
      const data = await fetchAllOrganisations(token);
      setOrgs(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load organisations');
    } finally {
      setLoading(false);
    }
  }

  async function loadStations() {
    setLoading(true);
    try {
      const data = await fetchAllStations(token);
      setStations(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load stations');
    } finally {
      setLoading(false);
    }
  }

  async function loadReports() {
    setLoading(true);
    try {
      const data = await fetchAssignedReports(token);
      setReports(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }

  async function loadAuditLogs() {
    setLoading(true);
    try {
      const data = await fetchAuditLogs(token);
      setAuditLogs(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setError('');
    setSuccessMsg('');
    if (tab === 'orgs') loadOrgs();
    else if (tab === 'stations') loadStations();
    else if (tab === 'breakglass') {
      loadReports();
    } else if (tab === 'audit') loadAuditLogs();
  }, [tab]);

  async function handleOrgStatus(id, status) {
    try {
      await updateOrgStatus(token, id, status);
      setSuccessMsg(`Organisation marked as ${status}`);
      loadOrgs();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update organisation');
    }
  }

  async function handleStationStatus(id, status) {
    try {
      await updateStationStatus(token, id, status);
      setSuccessMsg(`Police station marked as ${status}`);
      loadStations();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update police station');
    }
  }

  async function handleBreakGlass(e) {
    e.preventDefault();
    if (!bgReportId) {
      setError('Please select or specify a Report ID');
      return;
    }
    if (!bgReason.trim()) {
      setError('Justification reason is mandatory for break-glass protocol');
      return;
    }

    setBgSubmitting(true);
    setError('');
    setSuccessMsg('');
    setDisclosureData(null);
    setCopied(false);

    try {
      const res = await breakGlass(token, bgReportId, bgReason.trim());
      setSuccessMsg(`Break-glass emergency disclosure completed for Report #${bgReportId}`);
      if (res && res.disclosure) {
        setDisclosureData(res.disclosure);
      }
      setBgReason('');
      loadReports();
    } catch (e) {
      setError(e.response?.data?.message || 'Break-glass request failed');
    } finally {
      setBgSubmitting(false);
    }
  }

  function handleCopyDisclosure() {
    if (!disclosureData) return;
    const text = formatDisclosureText(disclosureData);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const statusBadge = (status) => {
    const cls = status === 'approved' ? 'status-resolved' : status === 'pending' ? 'status-submitted' : 'status-closed';
    return <span className={`status-pill ${cls}`}>{status}</span>;
  };

  const reportStatusColors = {
    submitted: 'status-submitted',
    under_review: 'status-review',
    resolved: 'status-resolved',
    closed: 'status-closed',
  };

  return (
    <>
      <Navbar />
      <div className="dashboard-container">
        <h1 className="dashboard-title">Platform Admin Dashboard</h1>

        <div className="tab-bar">
          <button
            type="button"
            className={tab === 'orgs' ? 'tab active' : 'tab'}
            onClick={() => setTab('orgs')}
          >
            Organisations
          </button>
          <button
            type="button"
            className={tab === 'stations' ? 'tab active' : 'tab'}
            onClick={() => setTab('stations')}
          >
            Police Stations
          </button>
          <button
            type="button"
            className={tab === 'breakglass' ? 'tab active' : 'tab'}
            onClick={() => setTab('breakglass')}
          >
            Break-Glass Protocol
          </button>
          <button
            type="button"
            className={tab === 'audit' ? 'tab active' : 'tab'}
            onClick={() => setTab('audit')}
          >
            Audit Trail
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {successMsg && <div className="alert alert-success">{successMsg}</div>}

        {/* ORGANISATIONS TAB */}
        {tab === 'orgs' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <p className="muted" style={{ margin: 0 }}>Review, approve, or reject organisation registrations.</p>
              <button type="button" className="btn-outline" onClick={loadOrgs}>Refresh</button>
            </div>
            {loading && <p className="muted">Loading organisations...</p>}
            {!loading && orgs.length === 0 && <p className="muted">No organisations registered yet.</p>}
            {orgs.map(o => (
              <div key={o.id} className="report-card" style={{ marginBottom: '0.75rem' }}>
                <div className="report-header">
                  <span className="report-title">{o.name} <small style={{ color: 'var(--muted)', fontWeight: 400 }}>(ID: {o.id})</small></span>
                  {statusBadge(o.status)}
                </div>
                <p className="report-meta">Email: {o.contact_email || 'N/A'} {o.contact_phone && `• Phone: ${o.contact_phone}`}</p>
                {o.status === 'pending' && (
                  <div className="action-buttons">
                    <button type="button" className="btn-primary" onClick={() => handleOrgStatus(o.id, 'approved')}>Approve</button>
                    <button type="button" className="btn-danger" onClick={() => handleOrgStatus(o.id, 'rejected')}>Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* POLICE STATIONS TAB */}
        {tab === 'stations' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <p className="muted" style={{ margin: 0 }}>Review, approve, or reject police station listings.</p>
              <button type="button" className="btn-outline" onClick={loadStations}>Refresh</button>
            </div>
            {loading && <p className="muted">Loading police stations...</p>}
            {!loading && stations.length === 0 && <p className="muted">No police stations registered yet.</p>}
            {stations.map(s => (
              <div key={s.id} className="report-card" style={{ marginBottom: '0.75rem' }}>
                <div className="report-header">
                  <span className="report-title">{s.name} <small style={{ color: 'var(--muted)', fontWeight: 400 }}>(ID: {s.id})</small></span>
                  {statusBadge(s.status)}
                </div>
                <p className="report-meta">Email: {s.contact_email || 'N/A'} {s.contact_phone && `• Phone: ${s.contact_phone}`}</p>
                {s.status === 'pending' && (
                  <div className="action-buttons">
                    <button type="button" className="btn-primary" onClick={() => handleStationStatus(s.id, 'approved')}>Approve</button>
                    <button type="button" className="btn-danger" onClick={() => handleStationStatus(s.id, 'rejected')}>Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* BREAK-GLASS TAB */}
        {tab === 'breakglass' && (
          <div>
            <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
              <h2 style={{ color: 'var(--danger)', margin: 0, marginBottom: '0.5rem' }}>Emergency Break-Glass Protocol</h2>
              <p className="muted" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                Break-glass allows Platform Administrators to override confidentiality seals and unseal a report's true reporter identity in emergencies.
                <strong> Every request is permanently recorded in the Audit Trail with your Admin ID, timestamp, and mandatory justification.</strong>
              </p>
            </div>

            {/* Structured Break-Glass Disclosure Output (Appears above form when active) */}
            {disclosureData && (
              <div className="disclosure-panel">
                <div className="disclosure-top-bar">
                  <div className="disclosure-title-group">
                    <span className="disclosure-badge">Confidential Disclosure Unsealed</span>
                    <h2 style={{ margin: 0, fontSize: '1.35rem', color: '#fff' }}>
                      Break-Glass Disclosure — Report #{disclosureData.report_id}
                    </h2>
                  </div>
                  <div className="disclosure-actions">
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={handleCopyDisclosure}
                    >
                      {copied ? 'Copied Summary' : 'Copy Summary'}
                    </button>
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => setDisclosureData(null)}
                    >
                      Close
                    </button>
                  </div>
                </div>

                {/* Section 1: Unsealed Real Identity */}
                <div className="unsealed-identity-card">
                  <div className="disclosure-section-title" style={{ color: 'var(--danger)' }}>
                    <span>Unsealed Reporter Identity</span>
                    <span className="status-pill status-closed" style={{ marginLeft: 'auto', fontSize: '0.72rem' }}>
                      Seal Overridden
                    </span>
                  </div>

                  <div className="identity-row">
                    <div className="identity-avatar">
                      {(disclosureData.unsealed_identity?.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
                        {disclosureData.unsealed_identity?.name || 'Unknown Name'}
                      </div>
                      <div className="muted" style={{ fontSize: '0.85rem' }}>
                        Role: {disclosureData.unsealed_identity?.role || 'Citizen'} • User ID: #{disclosureData.unsealed_identity?.reporter_id}
                      </div>
                    </div>
                  </div>

                  <div className="disclosure-grid" style={{ marginTop: '1rem' }}>
                    <div className="disclosure-item">
                      <span className="disclosure-item-label">Verified Email</span>
                      <span className="disclosure-item-value">{disclosureData.unsealed_identity?.email || 'N/A'}</span>
                    </div>
                    <div className="disclosure-item">
                      <span className="disclosure-item-label">Contact Phone</span>
                      <span className="disclosure-item-value">{disclosureData.unsealed_identity?.phone_number || 'Not provided'}</span>
                    </div>
                    <div className="disclosure-item">
                      <span className="disclosure-item-label">Original Anonymity Flag</span>
                      <span className="disclosure-item-value">
                        {disclosureData.context?.filed_as === 'Anonymous' ? 'Filed Anonymously (Shield overridden)' : 'Filed Openly'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 2: Authorization */}
                <div className="disclosure-section-card">
                  <div className="disclosure-section-title">
                    <span>Disclosure Authorization</span>
                  </div>
                  <div className="disclosure-grid">
                    <div className="disclosure-item">
                      <span className="disclosure-item-label">Authorized By</span>
                      <span className="disclosure-item-value">
                        Platform Admin ({disclosureData.authorization?.admin_name || 'Admin'}, ID #{disclosureData.authorization?.admin_id})
                      </span>
                    </div>
                    <div className="disclosure-item">
                      <span className="disclosure-item-label">Disclosure Timestamp</span>
                      <span className="disclosure-item-value">
                        {new Date(disclosureData.authorization?.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div style={{ marginTop: '0.85rem' }}>
                    <span className="disclosure-item-label">Reason for Emergency Disclosure</span>
                    <div className="justification-box">
                      "{disclosureData.authorization?.reason}"
                    </div>
                  </div>
                </div>

                {/* Section 3: Report Context */}
                <div className="disclosure-section-card">
                  <div className="disclosure-section-title">
                    <span>Report Context & Content</span>
                  </div>
                  <div className="disclosure-grid">
                    <div className="disclosure-item">
                      <span className="disclosure-item-label">Report Title</span>
                      <span className="disclosure-item-value">{disclosureData.context?.title}</span>
                    </div>
                    <div className="disclosure-item">
                      <span className="disclosure-item-label">Target Channel</span>
                      <span className="disclosure-item-value">{disclosureData.context?.target} ({disclosureData.context?.type})</span>
                    </div>
                    <div className="disclosure-item">
                      <span className="disclosure-item-label">Current Status</span>
                      <span className="disclosure-item-value">
                        <span className={`status-pill ${reportStatusColors[disclosureData.context?.current_status] || ''}`}>
                          {disclosureData.context?.current_status}
                        </span>
                      </span>
                    </div>
                    <div className="disclosure-item">
                      <span className="disclosure-item-label">Tracking Token</span>
                      <span className="disclosure-item-value" style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>
                        {disclosureData.context?.tracking_token}
                      </span>
                    </div>
                    <div className="disclosure-item">
                      <span className="disclosure-item-label">Originally Submitted</span>
                      <span className="disclosure-item-value">
                        {new Date(disclosureData.context?.originally_submitted).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div style={{ marginTop: '0.85rem' }}>
                    <span className="disclosure-item-label">Report Description</span>
                    <div className="description-box">
                      {disclosureData.context?.description}
                    </div>
                  </div>
                </div>

                {/* Audit Confirmation Bar pointing to the Audit Trail tab */}
                <div className="audit-notice-bar">
                  <span>
                    Immutable entry written to <strong>Audit Trail</strong> (Record ID #{disclosureData.audit_entry?.id || '—'})
                  </span>
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
                    onClick={() => setTab('audit')}
                  >
                    View in Audit Trail Tab
                  </button>
                </div>
              </div>
            )}

            {/* List of active reports */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2>System Reports (Select a Report to Disclose)</h2>
                <button type="button" className="btn-outline" onClick={loadReports}>Refresh Reports</button>
              </div>

              {loading && <p className="muted">Loading reports list...</p>}
              {!loading && reports.length === 0 && (
                <p className="muted">No reports exist in the intake database yet.</p>
              )}

              <div className="report-list">
                {reports.map(r => (
                  <div
                    key={r.id}
                    className={`report-card ${String(bgReportId) === String(r.id) ? 'selected' : ''}`}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <div>
                      <div className="report-header" style={{ marginBottom: '0.2rem' }}>
                        <span className="report-title">
                          <strong style={{ color: 'var(--accent)' }}>#{r.id}</strong> — {r.title || 'Untitled Report'}
                        </span>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          {r.is_anonymous && (
                            <span className="status-pill" style={{ background: 'rgba(122,129,154,0.2)', color: '#7a819a' }}>Anonymous</span>
                          )}
                          <span className={`status-pill ${reportStatusColors[r.status] || ''}`}>{r.status}</span>
                        </div>
                      </div>
                      <p className="report-meta" style={{ margin: 0 }}>
                        Target: {r.type === 'external' ? `Police Station #${r.station_id || 'N/A'}` : `Organisation #${r.org_id || 'N/A'}`} • Filed on {new Date(r.created_at).toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ whiteSpace: 'nowrap', marginLeft: '1rem' }}
                      onClick={() => {
                        setBgReportId(r.id);
                        setError('');
                        setSuccessMsg(`Report #${r.id} selected. Provide justification reason below to break glass.`);
                      }}
                    >
                      {String(bgReportId) === String(r.id) ? 'Selected' : 'Select Report'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Break Glass Action Form */}
            <div className="card">
              <h2>Request Emergency Unseal & Disclosure</h2>
              <form onSubmit={handleBreakGlass} className="form-stack">
                <label>
                  Target Report
                  <select
                    value={bgReportId}
                    onChange={e => {
                      setBgReportId(e.target.value);
                    }}
                    required
                  >
                    <option value="">-- Choose a Report from the system --</option>
                    {reports.map(r => (
                      <option key={r.id} value={r.id}>
                        Report #{r.id} - {r.title || 'Untitled'} ({r.type} | {r.status})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Reason for Disclosure (Mandatory & Audited)
                  <textarea
                    value={bgReason}
                    onChange={e => setBgReason(e.target.value)}
                    placeholder="Enter formal justification (e.g. Reporter messaged handler stating credible threat of physical harm from a named coworker. Escalating to police requires reporter's real identity for protective order filing)..."
                    rows={4}
                    required
                  />
                </label>

                <div>
                  <button className="btn-danger" type="submit" disabled={bgSubmitting || !bgReportId}>
                    {bgSubmitting ? 'Authorizing & Unsealing...' : `Authorize Break Glass for Report #${bgReportId || '...'}`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* AUDIT TRAIL TAB */}
        {tab === 'audit' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <p className="muted" style={{ margin: 0 }}>Immutable record of all sensitive actions, status modifications, and break-glass events.</p>
              <button type="button" className="btn-outline" onClick={loadAuditLogs}>Refresh</button>
            </div>
            {loading && <p className="muted">Loading audit records...</p>}
            {auditLogs.length === 0 && !loading && <p className="muted">No audit entries yet.</p>}
            <div className="audit-table-wrapper">
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Actor</th>
                    <th>Report Target</th>
                    <th>Audit Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(log => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString()}</td>
                      <td>
                        <span className={`status-pill ${log.action === 'break_glass_disclosure' ? 'status-closed' : 'status-review'}`}>
                          {log.action}
                        </span>
                      </td>
                      <td>User #{log.actor_user_id}</td>
                      <td>{log.report_id ? `Report #${log.report_id}` : '—'}</td>
                      <td className="audit-details">
                        {typeof log.details === 'object'
                          ? (log.details.summary || JSON.stringify(log.details, null, 1))
                          : log.details}
                      </td>
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
