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

    // Dispatch welcome email via Communication Service (fail-open)
    (async () => {
      try {
        if (user.email) {
          const commsUrl = process.env.COMMUNICATION_SERVICE_URL || 'http://localhost:4003';
          await fetch(`${commsUrl}/messages/email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: user.email,
              subject: `[QuietLedger] Welcome to QuietLedger, ${user.name}!`,
              body: `Hello ${user.name},\n\nYour account has been registered with role "${user.role.toUpperCase()}".\nEvery case on record, every identity off record.\n\nAccess the portal: http://localhost:5173`,
            }),
          });
          console.log(`[IdentityService] Sent welcome email to ${user.email}`);
        }
      } catch (commsErr) {
        console.warn('[fail-open] Welcome email alert failed:', commsErr.message);
      }
    })();
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

    // Dispatch security login alert email via Communication Service (fail-open)
    (async () => {
      try {
        if (user.email) {
          const commsUrl = process.env.COMMUNICATION_SERVICE_URL || 'http://localhost:4003';
          const nowStr = new Date().toLocaleString();
          await fetch(`${commsUrl}/messages/email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: user.email,
              subject: `[QuietLedger] Security Alert: Successful Login to your Account`,
              body: `Hello ${user.name},\n\nYou have successfully logged into your QuietLedger account on ${nowStr}.\nRole: ${user.role.toUpperCase()}.\n\nIf this was not you, please contact a Platform Administrator immediately.\nEvery case on record, every identity off record.`,
            }),
          });
          console.log(`[IdentityService] Sent login notification email to ${user.email}`);
        }
      } catch (commsErr) {
        console.warn('[fail-open] Login email alert failed:', commsErr.message);
      }
    })();
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

async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ message: 'No registered account found with that email address.' });
    }

    // Generate secure 6-digit OTP code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes validity

    await pool.query(
      'UPDATE users SET reset_code = $1, reset_expires_at = $2 WHERE email = $3',
      [resetCode, expiresAt, cleanEmail]
    );

    // Dispatch OTP email via Communication Service
    (async () => {
      try {
        const commsUrl = process.env.COMMUNICATION_SERVICE_URL || 'http://localhost:4003';
        await fetch(`${commsUrl}/messages/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: cleanEmail,
            subject: `[QuietLedger] Password Reset Code: ${resetCode}`,
            body: `Hello ${user.name},\n\nYou requested to reset your password for your QuietLedger account.\n\nYour 6-digit verification code is:\n\n${resetCode}\n\nThis verification code will expire in 15 minutes.\nIf you did not request a password reset, please ignore this email or notify an administrator.\n\nQuietLedger • Every case on record, every identity off record.`,
          }),
        });
        console.log(`[IdentityService] Sent password reset code to ${cleanEmail}`);
      } catch (commsErr) {
        console.warn('[fail-open] Password reset email dispatch failed:', commsErr.message);
      }
    })();

    res.json({ message: 'Verification code sent to your email address.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Failed to process forgot password request' });
  }
}

async function resetPassword(req, res) {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: 'Email, verification code, and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.reset_code || user.reset_code !== cleanCode) {
      return res.status(400).json({ message: 'Invalid or incorrect verification code' });
    }

    if (user.reset_expires_at && new Date(user.reset_expires_at) < new Date()) {
      return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
    }

    const newHash = await hashPassword(newPassword);
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_code = NULL, reset_expires_at = NULL WHERE email = $2',
      [newHash, cleanEmail]
    );

    // Dispatch confirmation email
    (async () => {
      try {
        const commsUrl = process.env.COMMUNICATION_SERVICE_URL || 'http://localhost:4003';
        const nowStr = new Date().toLocaleString();
        await fetch(`${commsUrl}/messages/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: cleanEmail,
            subject: `[QuietLedger] Security Notification: Password Changed Successfully`,
            body: `Hello ${user.name},\n\nYour QuietLedger account password was successfully updated on ${nowStr}.\n\nYou can now log in using your new password at: http://localhost:5173/login\n\nIf you did not perform this action, please alert your administrator immediately.\n\nQuietLedger • Every case on record, every identity off record.`,
          }),
        });
      } catch (commsErr) {
        console.warn('[fail-open] Password reset confirmation email failed:', commsErr.message);
      }
    })();

    res.json({ message: 'Password has been reset successfully! You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Failed to reset password' });
  }
}

module.exports = { register, login, me, forgotPassword, resetPassword };
