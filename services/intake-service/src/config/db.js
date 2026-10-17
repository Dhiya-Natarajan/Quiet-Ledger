const { Pool } = require('pg');

let isPostgresConnected = false;
let realPool = null;

try {
  realPool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/intake_db',
    connectionTimeoutMillis: 2000,
  });
} catch (_) {}

class MemoryIntakeDB {
  constructor() {
    this.reportIdSeq = 1;
    this.messageIdSeq = 1;
    this.auditIdSeq = 1;

    this.reports = [];
    this.reportMessages = [];
    this.auditLogs = [];
  }

  query(text, params = []) {
    const q = text.trim();

    // 1. INSERT INTO reports
    if (q.startsWith('INSERT INTO reports')) {
      const [
        reporter_id, title, type, org_id, station_id,
        is_anonymous, tracking_token, description, lat, lng, org_status_verified
      ] = params;

      const newReport = {
        id: this.reportIdSeq++,
        reporter_id: Number(reporter_id),
        title: title || description.slice(0, 80),
        type,
        org_id: org_id ? Number(org_id) : null,
        station_id: station_id ? Number(station_id) : null,
        is_anonymous: Boolean(is_anonymous),
        tracking_token,
        description,
        lat: lat || null,
        lng: lng || null,
        org_status_verified: Boolean(org_status_verified),
        status: 'submitted',
        created_at: new Date(),
      };
      this.reports.unshift(newReport);
      return { rows: [newReport] };
    }

    // 2. SELECT * FROM reports WHERE reporter_id = $1
    if (q.includes('FROM reports WHERE reporter_id = $1')) {
      const repId = Number(params[0]);
      const results = this.reports.filter((r) => r.reporter_id === repId);
      return { rows: results };
    }

    // 3. SELECT * FROM reports WHERE org_id=$1
    if (q.includes('FROM reports WHERE org_id=$1')) {
      const orgId = Number(params[0]);
      const results = this.reports.filter((r) => r.org_id === orgId);
      return { rows: results };
    }

    // 4. SELECT * FROM reports WHERE station_id=$1
    if (q.includes('FROM reports WHERE station_id=$1')) {
      const stnId = Number(params[0]);
      const results = this.reports.filter((r) => r.station_id === stnId);
      return { rows: results };
    }

    // 5. SELECT * FROM reports WHERE id=$1 or reporter_id, is_anonymous FROM reports WHERE id=$1
    if (q.includes('FROM reports WHERE id=$1') || q.includes('FROM reports WHERE id = $1')) {
      const id = Number(params[0]);
      const match = this.reports.find((r) => r.id === id);
      return { rows: match ? [match] : [] };
    }

    // 6. SELECT * FROM reports ORDER BY created_at DESC
    if (q.includes('FROM reports ORDER BY created_at DESC')) {
      return { rows: [...this.reports] };
    }

    // 7. UPDATE reports SET status=$1 WHERE id=$2
    if (q.startsWith('UPDATE reports SET status')) {
      const status = params[0];
      const id = Number(params[1]);
      const report = this.reports.find((r) => r.id === id);
      if (report) report.status = status;
      return { rows: report ? [report] : [] };
    }

    // 7b. UPDATE reports SET is_unmasked = true
    if (q.startsWith('UPDATE reports SET is_unmasked')) {
      const [reason, unmasked_by, unmasked_at, id] = params;
      const report = this.reports.find((r) => r.id === Number(id));
      if (report) {
        report.is_unmasked = true;
        report.break_glass_reason = reason;
        report.break_glass_by = unmasked_by;
        report.break_glass_at = unmasked_at;
      }
      return { rows: report ? [report] : [] };
    }

    // 8. INSERT INTO report_messages
    if (q.startsWith('INSERT INTO report_messages')) {
      const [report_id, sender_user_id, body] = params;
      const newMsg = {
        id: this.messageIdSeq++,
        report_id: Number(report_id),
        sender_user_id: Number(sender_user_id),
        body,
        created_at: new Date(),
      };
      this.reportMessages.push(newMsg);
      return { rows: [newMsg] };
    }

    // 9. SELECT * FROM report_messages WHERE report_id=$1
    if (q.includes('FROM report_messages WHERE report_id=$1')) {
      const repId = Number(params[0]);
      const msgs = this.reportMessages.filter((m) => m.report_id === repId);
      return { rows: msgs };
    }

    // 10. INSERT INTO audit_log
    if (q.startsWith('INSERT INTO audit_log')) {
      const [report_id, actor_user_id, action, details] = params;
      const newAudit = {
        id: this.auditIdSeq++,
        report_id: report_id ? Number(report_id) : null,
        actor_user_id: Number(actor_user_id),
        action,
        details: typeof details === 'string' ? JSON.parse(details) : details,
        created_at: new Date(),
      };
      this.auditLogs.unshift(newAudit);
      return { rows: [newAudit] };
    }

    // 11. SELECT * FROM audit_log ORDER BY created_at DESC
    if (q.includes('FROM audit_log')) {
      return { rows: [...this.auditLogs] };
    }

    console.warn(`[MemoryIntakeDB] Unhandled query: ${q}`);
    return { rows: [] };
  }
}

const memoryDB = new MemoryIntakeDB();

(async () => {
  if (realPool) {
    try {
      const client = await realPool.connect();
      client.release();
      isPostgresConnected = true;
      console.log(' Successfully connected to PostgreSQL (intake_db).');
    } catch (_) {
      isPostgresConnected = false;
      console.log('⚠️  PostgreSQL is not running on localhost:5432.');
      console.log('✨ Activated In-Memory Intake Database Engine: ready for instant report processing!');
    }
  }
})();

module.exports = {
  query: async (text, params) => {
    if (isPostgresConnected && realPool) {
      try {
        return await realPool.query(text, params);
      } catch (err) {
        console.warn('[intake-service pg error, falling back to memory db]:', err.message);
        return memoryDB.query(text, params);
      }
    }
    return memoryDB.query(text, params);
  },
};
