const crypto = require('crypto');
const pool = require('../config/db');
const { checkOrgApproved, checkStationApproved } = require('../clients/identityClient');

function generateTrackingToken() {
  return crypto.randomBytes(16).toString('hex');
}

async function createReport(req, res) {
  try {
    const { type, orgId, stationId, isAnonymous, description, lat, lng } = req.body;
    const reporterId = req.user.id;

    if (!type || !description) {
      return res.status(400).json({ error: 'type and description are required' });
    }
    if (!['external', 'internal'].includes(type)) {
      return res.status(400).json({ error: 'type must be external or internal' });
    }
    if (type === 'internal' && !orgId) {
      return res.status(400).json({ error: 'orgId is required for internal reports' });
    }
    if (type === 'external' && !stationId) {
      return res.status(400).json({ error: 'stationId is required for external reports' });
    }

    let verified = false;

    if (type === 'internal') {
      const approved = await checkOrgApproved(orgId);
      if (approved === false) {
        // identity-service reached us and said no — this is a real rejection,
        // not a failure, so we do NOT fail open here.
        return res.status(400).json({ error: 'Organisation is not approved to receive reports' });
      }
      verified = approved === true; // true if verified; false (unverified) if identity-service was unreachable
    } else {
      const approved = await checkStationApproved(stationId);
      if (approved === false) {
        return res.status(400).json({ error: 'Police station is not approved to receive reports' });
      }
      verified = approved === true;
    }

    const trackingToken = isAnonymous ? generateTrackingToken() : null;

    const result = await pool.query(
      `INSERT INTO reports
        (reporter_id, type, org_id, station_id, is_anonymous, tracking_token, description, lat, lng, org_status_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        reporterId,
        type,
        orgId || null,
        stationId || null,
        !!isAnonymous,
        trackingToken,
        description,
        lat || null,
        lng || null,
        verified,
      ]
    );

    res.status(201).json({ report: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create report' });
  }
}

async function getMyReports(req, res) {
  try {
    const result = await pool.query(
      'SELECT * FROM reports WHERE reporter_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ reports: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
}

async function getAssignedReports(req, res) {
  try {
    const { role, orgId, stationId } = req.user;
    let result;

    if (role === 'organisation') {
      result = await pool.query(
        'SELECT * FROM reports WHERE org_id = $1 ORDER BY created_at DESC',
        [orgId]
      );
    } else if (role === 'police') {
      result = await pool.query(
        'SELECT * FROM reports WHERE station_id = $1 ORDER BY created_at DESC',
        [stationId]
      );
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Never expose reporter_id to a handler if the reporter chose anonymity.
    const sanitized = result.rows.map((r) =>
      r.is_anonymous ? { ...r, reporter_id: null } : r
    );

    res.json({ reports: sanitized });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch assigned reports' });
  }
}

module.exports = { createReport, getMyReports, getAssignedReports };
