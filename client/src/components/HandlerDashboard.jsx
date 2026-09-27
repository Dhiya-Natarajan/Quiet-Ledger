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
  const { token } = useAuth();
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
      setReports(data);
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

  return (
    <>
      <Navbar />
      <div className="dashboard-container">
        <h1 className="dashboard-title">Handler Dashboard</h1>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="handler-layout">
          <div className="report-queue">
            <div className="queue-header">
              <h2>Assigned Cases</h2>
              <button className="btn-outline" onClick={loadReports}>Refresh</button>
            </div>
            {loading && <p className="muted">Loading...</p>}
            {!loading && reports.length === 0 && <p className="muted">No cases assigned yet.</p>}
            {reports.map(r => (
              <div
                key={r.id}
                className={`report-card clickable ${activeReport?.id === r.id ? 'selected' : ''}`}
                onClick={() => setActiveReport(r)}
              >
                <div className="report-header">
                  <span className="report-title">{r.title}</span>
                  <span className={`status-pill ${statusColors[r.status] || ''}`}>{r.status}</span>
                </div>
                <p className="report-meta">ID: {r.id}</p>
              </div>
            ))}
          </div>
          <div className="report-detail">
            {!activeReport ? (
              <p className="muted" style={{ padding: '2rem' }}>Select a case to view details</p>
            ) : (
              <>
                <div className="card">
                  <h2>{activeReport.title}</h2>
                  <p>{activeReport.description}</p>
                  <div className="status-row">
                    <span className={`status-pill ${statusColors[activeReport.status] || ''}`}>
                      {activeReport.status}
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
