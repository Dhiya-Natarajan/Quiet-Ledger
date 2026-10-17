const pool = require('../config/db');

async function getOrgStatus(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, name, status, contact_email, contact_phone FROM organisations WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organisation not found' });
    }
    const org = result.rows[0];
    res.json({
      id: Number(org.id),
      name: org.name,
      status: org.status,
      contact_email: org.contact_email,
      contact_phone: org.contact_phone,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch organisation status' });
  }
}

async function getStationStatus(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, name, status, contact_email, contact_phone FROM police_stations WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Police station not found' });
    }
    const station = result.rows[0];
    res.json({
      id: Number(station.id),
      name: station.name,
      status: station.status,
      contact_email: station.contact_email,
      contact_phone: station.contact_phone,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch station status' });
  }
}

async function getUserById(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT id, name, email, role, phone_number FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
}

module.exports = { getOrgStatus, getStationStatus, getUserById };
