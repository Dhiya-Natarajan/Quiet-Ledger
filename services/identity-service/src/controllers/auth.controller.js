const pool = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/hash');
const { signToken } = require('../utils/jwt');

const VALID_ROLES = ['citizen', 'organisation', 'police', 'platform_admin'];

async function register(req, res) {
  try {
    const { name, email, password, role, orgId, stationId } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'name, email, password and role are required' });
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    if (role === 'organisation' && !orgId) {
      return res.status(400).json({ error: 'orgId is required for role organisation' });
    }
    if (role === 'police' && !stationId) {
      return res.status(400).json({ error: 'stationId is required for role police' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await hashPassword(password);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, org_id, station_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, org_id, station_id`,
      [
        name,
        email,
        passwordHash,
        role,
        role === 'organisation' ? orgId : null,
        role === 'police' ? stationId : null,
      ]
    );

    const user = result.rows[0];
    const token = signToken({
      id: user.id,
      role: user.role,
      orgId: user.org_id,
      stationId: user.station_id,
    });

    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken({
      id: user.id,
      role: user.role,
      orgId: user.org_id,
      stationId: user.station_id,
    });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
}

async function me(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, org_id, station_id FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
}

module.exports = { register, login, me };
