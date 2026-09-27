const pool = require('../config/db');

// These are "internal" endpoints — meant to be called by other services
// (intake-service), not by the frontend. In production these would sit
// behind a network boundary (private subnet, service mesh, or an internal
// API key) so the public internet can't reach them. Out of scope for now,
// but worth flagging in your Future Scope slide.

async function getOrgStatus(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT status FROM organisations WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organisation not found' });
    }
    res.json({ id: Number(id), status: result.rows[0].status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch organisation status' });
  }
}

async function getStationStatus(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT status FROM police_stations WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Police station not found' });
    }
    res.json({ id: Number(id), status: result.rows[0].status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch station status' });
  }
}

module.exports = { getOrgStatus, getStationStatus };
