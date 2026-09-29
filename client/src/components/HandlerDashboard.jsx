import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchAssignedReports, updateReportStatus } from '../api/reports';
import ChatThread from './ChatThread';
import Navbar from './Navbar';

const VALID_NEXT = {
  submitted: ['under_review'],
  under_review: ['resolved', 'closed'],
  resolved: ['closed'],
  closed: [],
};

export default function HandlerDashboard() {
  const { token, user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeReport, setActiveReport] = useState(null);
  const [updating, setUpdating] = useState(false);

  async function loadReports() {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAssignedReports(token);
      setReports(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load assigned reports');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadReports(); }, []);

  async function handleStatusChange(reportId, newStatus) {
    setUpdating(true);
    try {
      await updateReportStatus(token, reportId, newStatus);
      await loadReports();
      if (activeReport?.id === reportId) {
        setActiveReport(prev => ({ ...prev, status: newStatus }));
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  }

  const statusColors = {
    submitted: 'status-submitted',
    under_review: 'status-review',
    resolved: 'status-resolved',
    closed: 'status-closed',
  };

  const dashboardTitle = user?.role === 'police'
    ? 'Police Station Handler Dashboard'
    : user?.role === 'organisation'
      ? 'Organisation Compliance Dashboard'
      : 'Handler Dashboard';

  return (
    <>
      <Navbar />
      <div className="dashboard-container">
        <h1 className="dashboard-title">{dashboardTitle}</h1>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="handler-layout">
          <div className="report-queue">
            <div className="queue-header">
              <h2>Assigned Cases ({reports.length})</h2>
              <button className="btn-outline" onClick={loadReports}>Refresh</button>
            </div>
            {loading && <p className="muted">Loading cases...</p>}
            {!loading && reports.length === 0 && <p className="muted">No cases assigned to your station/organisation yet.</p>}
            {reports.map(r => (
              <div
                key={r.id}
                className={`report-card clickable ${activeReport?.id === r.id ? 'selected' : ''}`}
                onClick={() => setActiveReport(r)}
              >
                <div className="report-header">
                  <span className="report-title">#{r.id} - {r.title}</span>
                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    {r.is_anonymous ? (
                      <span className="status-pill" style={{ background: 'rgba(122,129,154,0.2)', color: '#7a819a', fontSize: '0.72rem' }}>
                        Anonymous
                      </span>
                    ) : (
                      <span className="status-pill status-review" style={{ fontSize: '0.72rem' }}>
                        Identified
                      </span>
                    )}
                    <span className={`status-pill ${statusColors[r.status] || ''}`}>{r.status}</span>
                  </div>
                </div>
                <p className="report-meta">Filed {new Date(r.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>

          <div className="report-detail">
            {!activeReport ? (
              <p className="muted" style={{ padding: '2rem' }}>Select a case from the queue to view full details</p>
            ) : (
              <>
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <div>
                      <h2 style={{ margin: 0 }}>Report #{activeReport.id}: {activeReport.title}</h2>
                      <span className="muted" style={{ fontSize: '0.82rem' }}>
                        Filed on {new Date(activeReport.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span className={`status-pill ${statusColors[activeReport.status] || ''}`}>
                        {activeReport.status}
                      </span>
                    </div>
                  </div>

                  {/* Reporter Personal Details Section */}
                  {activeReport.is_anonymous ? (
                    <div style={{
                      background: 'var(--surface2)',
                      borderLeft: '4px solid var(--muted)',
                      padding: '0.85rem 1rem',
                      borderRadius: '0 6px 6px 0',
                      marginBottom: '1rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span className="status-pill" style={{ background: 'rgba(122,129,154,0.2)', color: '#7a819a', fontSize: '0.75rem' }}>
                          Anonymous Case
                        </span>
                      </div>
                      <p className="muted" style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.4' }}>
                        The reporter elected to file this case anonymously. Direct personal identity is shielded under confidentiality protocols. Use the Case Thread below to request follow-up information.
                      </p>
                    </div>
                  ) : (
                    <div style={{
                      background: 'rgba(91, 106, 240, 0.08)',
                      border: '1px solid rgba(91, 106, 240, 0.3)',
                      borderLeft: '4px solid var(--accent)',
                      padding: '1rem',
                      borderRadius: '0 6px 6px 0',
                      marginBottom: '1rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
                        <span className="status-pill status-review" style={{ fontSize: '0.75rem' }}>
                          Identified Complainant Details
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', fontSize: '0.88rem' }}>
                        <div>
                          <span className="muted" style={{ fontSize: '0.75rem', display: 'block' }}>Full Name</span>
                          <strong style={{ color: '#fff' }}>{activeReport.reporter?.name || `User #${activeReport.reporter_id}`}</strong>
                        </div>
                        <div>
                          <span className="muted" style={{ fontSize: '0.75rem', display: 'block' }}>Email Address</span>
                          <span style={{ color: '#fff' }}>{activeReport.reporter?.email || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="muted" style={{ fontSize: '0.75rem', display: 'block' }}>Contact Phone</span>
                          <span style={{ color: '#fff' }}>{activeReport.reporter?.phone_number || 'Not provided'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ marginBottom: '1rem' }}>
                    <span className="muted" style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
                      Incident Description
                    </span>
                    <div style={{
                      background: 'var(--surface2)',
                      padding: '0.85rem 1rem',
                      borderRadius: '6px',
                      marginTop: '0.35rem',
                      fontSize: '0.92rem',
                      lineHeight: '1.5',
                      border: '1px solid var(--border)'
                    }}>
                      {activeReport.description}
                    </div>
                  </div>

                  <div className="status-row" style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                    <div>
                      <span className="muted" style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.35rem' }}>
                        Investigation Status Actions:
                      </span>
                      <div className="action-buttons">
                        {(VALID_NEXT[activeReport.status] || []).map(next => (
                          <button
                            key={next}
                            className="btn-primary"
                            onClick={() => handleStatusChange(activeReport.id, next)}
                            disabled={updating}
                          >
                            Move to: {next.replace('_', ' ')}
                          </button>
                        ))}
                        {(VALID_NEXT[activeReport.status] || []).length === 0 && (
                          <span className="muted" style={{ fontSize: '0.85rem' }}>This case is finalized ({activeReport.status}).</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <ChatThread reportId={activeReport.id} />
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
