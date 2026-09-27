const crypto = require('crypto');
const pool = require('../config/db');
const { checkOrgApproved, checkStationApproved } = require('../clients/identityClient');

function generateTrackingToken() {
  return crypto.randomBytes(16).toString('hex');
}

const VALID_TRANSITIONS = {
  submitted: ['under_review'],
  under_review: ['resolved', 'closed'],
  resolved: ['closed'],
  closed: [],
};

async function createReport(req, res) {
  try {
    const { title, type, orgId, stationId, isAnonymous, description, lat, lng } = req.body;
    const reporterId = req.user.id;

    if (!description) return res.status(400).json({ message: 'description is required' });

    const resolvedType = type || 'external';
    if (!['external', 'internal'].includes(resolvedType))
      return res.status(400).json({ message: 'type must be external or internal' });

    let verified = false;
    if (resolvedType === 'internal' && orgId) {
      const approved = await checkOrgApproved(orgId);
      if (approved === false)
        return res.status(400).json({ message: 'Organisation is not approved to receive reports' });
      verified = approved === true;
    } else if (resolvedType === 'external' && stationId) {
      const approved = await checkStationApproved(stationId);
      if (approved === false)
        return res.status(400).json({ message: 'Police station is not approved to receive reports' });
      verified = approved === true;
    }

    const trackingToken = isAnonymous ? generateTrackingToken() : null;
    const result = await pool.query(
      `INSERT INTO reports
        (reporter_id, title, type, org_id, station_id, is_anonymous, tracking_token, description, lat, lng, org_status_verified)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [reporterId, title || description.slice(0, 80), resolvedType, orgId || null, stationId || null,
       !!isAnonymous, trackingToken, description, lat || null, lng || null, verified]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create report' });
  }
}

async function getMyReports(req, res) {
  try {
    const result = await pool.query(
      'SELECT * FROM reports WHERE reporter_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch reports' });
  }
}

async function getAssignedReports(req, res) {
  try {
    const { role, org_id, station_id } = req.user;
    let result;
    if (role === 'organisation') {
      result = await pool.query('SELECT * FROM reports WHERE org_id=$1 ORDER BY created_at DESC', [org_id]);
    } else if (role === 'police') {
      result = await pool.query('SELECT * FROM reports WHERE station_id=$1 ORDER BY created_at DESC', [station_id]);
    } else {
      result = await pool.query('SELECT * FROM reports ORDER BY created_at DESC');
    }
    const sanitized = result.rows.map(r => r.is_anonymous ? { ...r, reporter_id: null } : r);
    res.json(sanitized);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch assigned reports' });
  }
}

async function updateReportStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const report = await pool.query('SELECT * FROM reports WHERE id=$1', [id]);
    if (!report.rows.length) return res.status(404).json({ message: 'Report not found' });

    const current = report.rows[0].status;
    const allowed = VALID_TRANSITIONS[current] || [];
    if (!allowed.includes(status))
      return res.status(400).json({ message: `Cannot transition from ${current} to ${status}` });

    const updated = await pool.query(
      'UPDATE reports SET status=$1 WHERE id=$2 RETURNING *', [status, id]
    );
    await pool.query(
      `INSERT INTO audit_log (report_id, actor_user_id, action, details) VALUES ($1,$2,$3,$4)`,
      [id, req.user.id, 'status_change', JSON.stringify({ from: current, to: status })]
    );
    res.json(updated.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update status' });
  }
}

async function sendMessage(req, res) {
  try {
    const { id } = req.params;
    const { body } = req.body;
    if (!body) return res.status(400).json({ message: 'body is required' });
    const result = await pool.query(
      `INSERT INTO report_messages (report_id, sender_user_id, body) VALUES ($1,$2,$3) RETURNING *`,
      [id, req.user.id, body]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to send message' });
  }
}

async function getMessages(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT m.*, u.name AS sender_name FROM report_messages m
       LEFT JOIN users u ON u.id = m.sender_user_id
       WHERE m.report_id=$1 ORDER BY m.created_at ASC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
}

async function breakGlass(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ message: 'reason is required' });
    const report = await pool.query('SELECT * FROM reports WHERE id=$1', [id]);
    if (!report.rows.length) return res.status(404).json({ message: 'Report not found' });
    await pool.query(
      `INSERT INTO audit_log (report_id, actor_user_id, action, details) VALUES ($1,$2,'break_glass',$3)`,
      [id, req.user.id, JSON.stringify({ reason })]
    );
    res.json({ report: report.rows[0], access: 'granted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to access report' });
  }
}

async function getAuditLogs(req, res) {
  try {
    const result = await pool.query('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 500');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch audit logs' });
  }
}

module.exports = { createReport, getMyReports, getAssignedReports, updateReportStatus, sendMessage, getMessages, breakGlass, getAuditLogs };
