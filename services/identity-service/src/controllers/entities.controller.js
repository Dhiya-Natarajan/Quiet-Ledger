const pool = require('../config/db');

async function getApprovedOrgs(req, res) {
  try {
    const r = await pool.query(`SELECT id, name, contact_email FROM organisations WHERE status = 'approved' ORDER BY name`);
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }); }
}

async function requestOrg(req, res) {
  const { name, contact_email, contact_phone } = req.body;
  if (!name) return res.status(400).json({ message: 'name is required' });
  try {
    const r = await pool.query(
      `INSERT INTO organisations (name, contact_email, contact_phone, status) VALUES ($1,$2,$3,'pending') RETURNING *`,
      [name, contact_email || null, contact_phone || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }); }
}

async function getApprovedStations(req, res) {
  try {
    const r = await pool.query(`SELECT id, name, contact_email FROM police_stations WHERE status = 'approved' ORDER BY name`);
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }); }
}

async function requestStation(req, res) {
  const { name, contact_email, contact_phone } = req.body;
  if (!name) return res.status(400).json({ message: 'name is required' });
  try {
    const r = await pool.query(
      `INSERT INTO police_stations (name, contact_email, contact_phone, status) VALUES ($1,$2,$3,'pending') RETURNING *`,
      [name, contact_email || null, contact_phone || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }); }
}

async function getAllOrgs(req, res) {
  try {
    const r = await pool.query(`SELECT * FROM organisations ORDER BY status, name`);
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }); }
}

async function updateOrgStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  if (!['approved', 'rejected', 'pending'].includes(status))
    return res.status(400).json({ message: 'Invalid status' });
  try {
    let query, params;
    if (status === 'approved') {
      query = `UPDATE organisations SET status='approved', approved_at=NOW(), approved_by_user_id=$1 WHERE id=$2 RETURNING *`;
      params = [req.user.id, id];
    } else {
      query = `UPDATE organisations SET status=$1 WHERE id=$2 RETURNING *`;
      params = [status, id];
    }
    const r = await pool.query(query, params);
    if (!r.rows.length) return res.status(404).json({ message: 'Organisation not found' });
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }); }
}

async function getAllStations(req, res) {
  try {
    const r = await pool.query(`SELECT * FROM police_stations ORDER BY status, name`);
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }); }
}

async function updateStationStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  if (!['approved', 'rejected', 'pending'].includes(status))
    return res.status(400).json({ message: 'Invalid status' });
  try {
    let query, params;
    if (status === 'approved') {
      query = `UPDATE police_stations SET status='approved', approved_at=NOW(), approved_by_user_id=$1 WHERE id=$2 RETURNING *`;
      params = [req.user.id, id];
    } else {
      query = `UPDATE police_stations SET status=$1 WHERE id=$2 RETURNING *`;
      params = [status, id];
    }
    const r = await pool.query(query, params);
    if (!r.rows.length) return res.status(404).json({ message: 'Police station not found' });
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }); }
}

module.exports = { getApprovedOrgs, requestOrg, getApprovedStations, requestStation, getAllOrgs, updateOrgStatus, getAllStations, updateStationStatus };
