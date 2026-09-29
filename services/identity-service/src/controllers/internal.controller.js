const pool = require('../config/db');

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
