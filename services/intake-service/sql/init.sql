-- Run this in pgAdmin, inside the intake_db database's Query Tool

-- Note: reporter_id, org_id, station_id are plain integers here, NOT foreign
-- keys pointing at identity_db's tables. That's intentional in a microservice
-- design: a database can't reference a table in a different database, and
-- more importantly, intake-service shouldn't be coupled to identity-service's
-- internal schema. Referential integrity for these is enforced in application
-- code (checking with identity-service over REST), not by Postgres.

CREATE TABLE reports (
  id SERIAL PRIMARY KEY,
  reporter_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('external', 'internal')),
  org_id INTEGER,
  station_id INTEGER,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  tracking_token TEXT,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'under_review', 'resolved', 'closed')),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  description TEXT NOT NULL,
  org_status_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES reports(id),
  sender_role TEXT NOT NULL,
  sender_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  actor_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  target_id INTEGER,
  details TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
