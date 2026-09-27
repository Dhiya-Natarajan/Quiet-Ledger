-- ============================================================
-- intake_db schema — run this in pgAdmin on intake_db
-- ============================================================

CREATE TABLE IF NOT EXISTS reports (
  id               SERIAL PRIMARY KEY,
  reporter_id      INTEGER NOT NULL,
  title            TEXT,
  type             TEXT NOT NULL DEFAULT 'external' CHECK (type IN ('external', 'internal')),
  org_id           INTEGER,
  station_id       INTEGER,
  is_anonymous     BOOLEAN NOT NULL DEFAULT false,
  tracking_token   TEXT,
  status           TEXT NOT NULL DEFAULT 'submitted'
                     CHECK (status IN ('submitted', 'under_review', 'resolved', 'closed')),
  lat              DOUBLE PRECISION,
  lng              DOUBLE PRECISION,
  description      TEXT NOT NULL,
  org_status_verified BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMP NOT NULL DEFAULT now()
);

-- Add title column if it already exists without it
ALTER TABLE reports ADD COLUMN IF NOT EXISTS title TEXT;

CREATE TABLE IF NOT EXISTS report_messages (
  id               SERIAL PRIMARY KEY,
  report_id        INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  sender_user_id   INTEGER NOT NULL,
  body             TEXT NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id               SERIAL PRIMARY KEY,
  report_id        INTEGER REFERENCES reports(id) ON DELETE SET NULL,
  actor_user_id    INTEGER NOT NULL,
  action           TEXT NOT NULL,
  details          JSONB,
  created_at       TIMESTAMP NOT NULL DEFAULT now()
);
