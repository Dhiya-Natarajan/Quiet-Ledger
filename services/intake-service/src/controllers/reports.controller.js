const crypto = require('crypto');
const pool = require('../config/db');
const { checkOrgApproved, checkStationApproved, getUserById } = require('../clients/identityClient');

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
    const { role, org_id, station_id, orgId, stationId } = req.user;
    const resolvedOrgId = org_id || orgId;
    const resolvedStationId = station_id || stationId;

    let result;
    if (role === 'organisation') {
      result = await pool.query('SELECT * FROM reports WHERE org_id=$1 ORDER BY created_at DESC', [resolvedOrgId]);
    } else if (role === 'police') {
      result = await pool.query('SELECT * FROM reports WHERE station_id=$1 ORDER BY created_at DESC', [resolvedStationId]);
    } else {
      // platform_admin
      result = await pool.query('SELECT * FROM reports ORDER BY created_at DESC');
    }

    const reportsWithDetails = await Promise.all(
      result.rows.map(async (r) => {
        if (r.is_anonymous) {
          return {
            ...r,
            reporter_id: null,
            reporter: null,
          };
        }

        // When NOT anonymous, fetch the real personal details from identity-service
        let reporterInfo = null;
        if (r.reporter_id) {
          const u = await getUserById(r.reporter_id);
          if (u) {
            reporterInfo = {
              id: u.id,
              name: u.name,
              email: u.email,
              phone_number: u.phone_number,
              role: u.role,
            };
          }
        }

        return {
          ...r,
          reporter: reporterInfo,
        };
      })
    );

    res.json(reportsWithDetails);
  } catch (err) {
    console.error('getAssignedReports error:', err);
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
    if (!body || !body.trim()) return res.status(400).json({ message: 'body is required' });
    const result = await pool.query(
      `INSERT INTO report_messages (report_id, sender_user_id, body) VALUES ($1,$2,$3) RETURNING *`,
      [id, req.user.id, body.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('sendMessage error:', err);
    res.status(500).json({ message: 'Failed to send message' });
  }
}

async function getMessages(req, res) {
  try {
    const { id } = req.params;
    const reportRes = await pool.query('SELECT reporter_id, is_anonymous FROM reports WHERE id=$1', [id]);
    if (!reportRes.rows.length) return res.status(404).json({ message: 'Report not found' });
    const report = reportRes.rows[0];

    const result = await pool.query(
      `SELECT * FROM report_messages WHERE report_id=$1 ORDER BY created_at ASC`,
      [id]
    );

    const sanitized = result.rows.map(m => {
      const isMe = m.sender_user_id === req.user.id;
      let senderLabel;
      if (isMe) {
        senderLabel = 'You';
      } else if (m.sender_user_id === report.reporter_id) {
        senderLabel = report.is_anonymous ? 'Anonymous Reporter' : 'Reporter';
      } else {
        senderLabel = 'Officer / Handler';
      }
      return {
        ...m,
        is_me: isMe,
        sender_name: senderLabel,
      };
    });

    res.json(sanitized);
  } catch (err) {
    console.error('getMessages error:', err);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
}

async function breakGlass(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'Reason for disclosure is required' });
    }

    const reportRes = await pool.query('SELECT * FROM reports WHERE id=$1', [id]);
    if (!reportRes.rows.length) {
      return res.status(404).json({ message: 'Report not found' });
    }
    const report = reportRes.rows[0];

    // Fetch Admin details from identity-service
    const adminUser = await getUserById(req.user.id);
    const adminName = adminUser?.name || 'Platform Admin';

    // Fetch real Reporter identity from identity-service
    const reporterUser = await getUserById(report.reporter_id);

    const targetDesc = report.type === 'external'
      ? `Station ID ${report.station_id || 'N/A'}`
      : `Organisation ID ${report.org_id || 'N/A'}`;

    const auditDetailText = `Reason: ${reason.trim()}. Escalated to ${targetDesc}.`;

    // Insert into audit_log
    const auditRes = await pool.query(
      `INSERT INTO audit_log (report_id, actor_user_id, action, details)
       VALUES ($1, $2, 'break_glass_disclosure', $3)
       RETURNING *`,
      [id, req.user.id, JSON.stringify({ reason: reason.trim(), summary: auditDetailText })]
    );
    const auditEntry = auditRes.rows[0];

    const disclosure = {
      report_id: report.id,
      authorization: {
        admin_id: req.user.id,
        admin_name: adminName,
        reason: reason.trim(),
        timestamp: auditEntry.created_at,
      },
      context: {
        title: report.title || 'Untitled',
        description: report.description,
        type: report.type,
        target: targetDesc,
        filed_as: report.is_anonymous ? 'Anonymous' : 'Identified',
        tracking_token: report.tracking_token || 'N/A',
        originally_submitted: report.created_at,
        current_status: report.status,
      },
      unsealed_identity: {
        reporter_id: report.reporter_id,
        role: reporterUser?.role || 'citizen',
        name: reporterUser?.name || `[User #${report.reporter_id}]`,
        email: reporterUser?.email || `[User #${report.reporter_id} email]`,
        phone_number: reporterUser?.phone_number || null,
      },
      audit_entry: {
        id: auditEntry.id,
        actor_id: auditEntry.actor_user_id,
        action: auditEntry.action,
        target_id: report.id,
        details: auditDetailText,
        created_at: auditEntry.created_at,
      }
    };

    res.json({
      report,
      disclosure,
      access: 'granted',
    });
  } catch (err) {
    console.error('breakGlass error:', err);
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

module.exports = {
  createReport,
  getMyReports,
  getAssignedReports,
  updateReportStatus,
  sendMessage,
  getMessages,
  breakGlass,
  getAuditLogs,
};
