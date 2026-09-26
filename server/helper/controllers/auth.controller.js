const prisma = require('../config/db');
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

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        orgId: role === 'organisation' ? Number(orgId) : null,
        stationId: role === 'police' ? Number(stationId) : null,
      },
    });

    const token = signToken({
      id: user.id,
      role: user.role,
      orgId: user.orgId,
      stationId: user.stationId,
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

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken({
      id: user.id,
      role: user.role,
      orgId: user.orgId,
      stationId: user.stationId,
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
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, role: true, orgId: true, stationId: true },
  });
  res.json({ user });
}

module.exports = { register, login, me };