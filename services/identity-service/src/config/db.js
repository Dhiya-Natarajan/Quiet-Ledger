const { Pool } = require('pg');

let isPostgresConnected = false;
let realPool = null;

try {
  realPool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/identity_db',
    connectionTimeoutMillis: 2000,
  });
} catch (_) {}

// In-Memory store for development/simulation when PostgreSQL is not running
class MemoryIdentityDB {
  constructor() {
    this.userIdSeq = 1;
    this.orgIdSeq = 2;
    this.stationIdSeq = 2;

    this.organisations = [
      { id: 1, name: 'Acme Corp', status: 'approved', contact_email: 'compliance@acmecorp.com', contact_phone: '+1234567890' },
    ];

    this.policeStations = [
      { id: 1, name: 'Manipal Town PS', lat: 13.3467, lng: 74.7869, status: 'approved', contact_email: 'station@police.gov', contact_phone: '+1987654321' },
    ];

    this.users = [];
  }

  query(text, params = []) {
    const q = text.trim();

    // 1. SELECT * / id FROM users WHERE email = $1
    if (q.includes('FROM users WHERE email = $1') && !q.includes('OR name')) {
      const email = params[0]?.toLowerCase();
      const match = this.users.find((u) => u.email.toLowerCase() === email);
      if (!match) return { rows: [] };
      if (q.includes('SELECT id FROM users')) {
        return { rows: [{ id: match.id }] };
      }
      return { rows: [match] };
    }

    // 1b. UPDATE users SET reset_code ...
    if (q.startsWith('UPDATE users SET reset_code')) {
      const [reset_code, reset_expires_at, email] = params;
      const match = this.users.find((u) => u.email.toLowerCase() === email?.toLowerCase());
      if (match) {
        match.reset_code = reset_code;
        match.reset_expires_at = reset_expires_at;
      }
      return { rows: match ? [match] : [] };
    }

    // 1c. UPDATE users SET password_hash ...
    if (q.startsWith('UPDATE users SET password_hash')) {
      const [password_hash, email] = params;
      const match = this.users.find((u) => u.email.toLowerCase() === email?.toLowerCase());
      if (match) {
        match.password_hash = password_hash;
        match.reset_code = null;
        match.reset_expires_at = null;
      }
      return { rows: match ? [match] : [] };
    }

    // 2. SELECT id FROM users WHERE name = $1
    if (q.includes('FROM users WHERE name = $1') && !q.includes('OR email')) {
      const name = params[0]?.toLowerCase();
      const match = this.users.find((u) => u.name.toLowerCase() === name);
      return { rows: match ? [{ id: match.id }] : [] };
    }

    // 3. SELECT * FROM users WHERE email = $1 OR name = $1 (Login)
    if (q.includes('FROM users WHERE email = $1 OR name = $1')) {
      const iden = params[0]?.toLowerCase();
      const match = this.users.find(
        (u) => u.email.toLowerCase() === iden || u.name.toLowerCase() === iden
      );
      return { rows: match ? [match] : [] };
    }

    // 4. SELECT ... FROM users WHERE id = $1
    if (q.includes('FROM users WHERE id = $1')) {
      const id = Number(params[0]);
      const match = this.users.find((u) => u.id === id);
      return { rows: match ? [match] : [] };
    }

    // 5. INSERT INTO users
    if (q.startsWith('INSERT INTO users')) {
      const [name, email, password_hash, role, org_id, station_id, phone_number] = params;
      const newUser = {
        id: this.userIdSeq++,
        name,
        email,
        password_hash,
        role,
        org_id: org_id ? Number(org_id) : null,
        station_id: station_id ? Number(station_id) : null,
        phone_number: phone_number || null,
        created_at: new Date(),
      };
      this.users.push(newUser);
      return {
        rows: [{
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          org_id: newUser.org_id,
          station_id: newUser.station_id,
        }],
      };
    }

    // 6. Organisations check: SELECT ... FROM organisations WHERE id = $1
    if (q.includes('FROM organisations WHERE id = $1')) {
      const id = Number(params[0]);
      const org = this.organisations.find((o) => o.id === id);
      return { rows: org ? [org] : [] };
    }

    // 7. Police Stations check: SELECT ... FROM police_stations WHERE id = $1
    if (q.includes('FROM police_stations WHERE id = $1')) {
      const id = Number(params[0]);
      const stn = this.policeStations.find((s) => s.id === id);
      return { rows: stn ? [stn] : [] };
    }

    // 8. Approved organisations
    if (q.includes("FROM organisations WHERE status = 'approved'")) {
      const approved = this.organisations.filter((o) => o.status === 'approved');
      return { rows: approved };
    }

    // 9. Approved stations
    if (q.includes("FROM police_stations WHERE status = 'approved'")) {
      const approved = this.policeStations.filter((s) => s.status === 'approved');
      return { rows: approved };
    }

    // 10. All organisations
    if (q.includes('FROM organisations')) {
      return { rows: [...this.organisations] };
    }

    // 11. All stations
    if (q.includes('FROM police_stations')) {
      return { rows: [...this.policeStations] };
    }

    // 12. Request Org: INSERT INTO organisations
    if (q.startsWith('INSERT INTO organisations')) {
      const [name, contact_email, contact_phone] = params;
      const newOrg = {
        id: this.orgIdSeq++,
        name,
        contact_email: contact_email || null,
        contact_phone: contact_phone || null,
        status: 'pending',
        created_at: new Date(),
      };
      this.organisations.push(newOrg);
      return { rows: [newOrg] };
    }

    // 13. Request Station: INSERT INTO police_stations
    if (q.startsWith('INSERT INTO police_stations')) {
      const [name, contact_email, contact_phone] = params;
      const newStation = {
        id: this.stationIdSeq++,
        name,
        contact_email: contact_email || null,
        contact_phone: contact_phone || null,
        lat: 13.3467,
        lng: 74.7869,
        status: 'pending',
        created_at: new Date(),
      };
      this.policeStations.push(newStation);
      return { rows: [newStation] };
    }

    // 14. Update Org Status
    if (q.startsWith('UPDATE organisations SET status')) {
      const id = Number(params[params.length - 1]);
      const status = params[0];
      const org = this.organisations.find((o) => o.id === id);
      if (org) org.status = status;
      return { rows: org ? [org] : [] };
    }

    // 15. Update Station Status
    if (q.startsWith('UPDATE police_stations SET status')) {
      const id = Number(params[params.length - 1]);
      const status = params[0];
      const stn = this.policeStations.find((s) => s.id === id);
      if (stn) stn.status = status;
      return { rows: stn ? [stn] : [] };
    }

    console.warn(`[MemoryIdentityDB] Unhandled query: ${q}`);
    return { rows: [] };
  }
}

const memoryDB = new MemoryIdentityDB();

// Test connection on module load
(async () => {
  if (realPool) {
    try {
      const client = await realPool.connect();
      client.release();
      isPostgresConnected = true;
      console.log(' Successfully connected to PostgreSQL (identity_db).');
    } catch (_) {
      isPostgresConnected = false;
      console.log('⚠️  PostgreSQL is not running on localhost:5432.');
      console.log('✨ Activated In-Memory Identity Database Engine: ready for instant registration & login!');
    }
  }
})();

module.exports = {
  query: async (text, params) => {
    if (isPostgresConnected && realPool) {
      try {
        return await realPool.query(text, params);
      } catch (err) {
        console.warn('[identity-service pg error, falling back to memory db]:', err.message);
        return memoryDB.query(text, params);
      }
    }
    return memoryDB.query(text, params);
  },
};
