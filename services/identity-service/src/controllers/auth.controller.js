const pool = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/hash');
const { signToken } = require('../utils/jwt');

const VALID_ROLES = ['citizen', 'organisation', 'police', 'platform_admin'];

async function register(req, res) {
  try {
    const { name, email, password, role, org_id, orgId, station_id, stationId, phone_number } = req.body;
    const resolvedOrgId = org_id || orgId;
    const resolvedStationId = station_id || stationId;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Name, email, password and role are required' });
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    if (role === 'organisation' && !resolvedOrgId) {
      return res.status(400).json({ message: 'Please select your organisation from the dropdown' });
    }
    if (role === 'police' && !resolvedStationId) {
      return res.status(400).json({ message: 'Please select your police station from the dropdown' });
    }

    // Check email uniqueness
    const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ message: 'Email is already registered' });
    }

    // Check username uniqueness
    const nameCheck = await pool.query('SELECT id FROM users WHERE name = $1', [name]);
    if (nameCheck.rows.length > 0) {
      return res.status(409).json({ message: 'That username is already taken. Please choose another.' });
    }

    // Verify organisation if role is organisation
    if (role === 'organisation') {
      const orgCheck = await pool.query('SELECT id, status FROM organisations WHERE id = $1', [resolvedOrgId]);
      if (orgCheck.rows.length === 0) {
        return res.status(400).json({ message: 'Selected organisation not found' });
      }
      if (orgCheck.rows[0].status !== 'approved') {
        return res.status(400).json({ message: 'Selected organisation is pending approval by admin' });
      }
    }

    // Verify police station if role is police
    if (role === 'police') {
      const stnCheck = await pool.query('SELECT id, status FROM police_stations WHERE id = $1', [resolvedStationId]);
      if (stnCheck.rows.length === 0) {
        return res.status(400).json({ message: 'Selected police station not found' });
      }
      if (stnCheck.rows[0].status !== 'approved') {
        return res.status(400).json({ message: 'Selected police station is pending approval by admin' });
      }
    }

    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, org_id, station_id, phone_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, email, role, org_id, station_id`,
      [
        name,
        email,
        passwordHash,
        role,
        role === 'organisation' ? resolvedOrgId : null,
        role === 'police' ? resolvedStationId : null,
        phone_number || null,
      ]
    );

    const user = result.rows[0];
    const token = signToken({
      id: user.id,
      role: user.role,
      org_id: user.org_id,
      station_id: user.station_id,
      orgId: user.org_id,
      stationId: user.station_id,
    });

    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Registration failed' });
  }
}

async function login(req, res) {
  try {
    const { email, username, password } = req.body;
    const loginIdentifier = (email || username || '').trim();

    if (!loginIdentifier || !password) {
      return res.status(400).json({ message: 'Username/email and password are required' });
    }

    // Allow login by email OR display name / username
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR name = $1',
      [loginIdentifier]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ message: 'Invalid username/email or password' });
    }

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid username/email or password' });
    }

    const token = signToken({
      id: user.id,
      role: user.role,
      org_id: user.org_id,
      station_id: user.station_id,
      orgId: user.org_id,
      stationId: user.station_id,
    });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Login failed' });
  }
}

async function me(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, org_id, station_id FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Fetch user error:', err);
    res.status(500).json({ message: 'Failed to fetch user' });
  }
}

module.exports = { register, login, me };
