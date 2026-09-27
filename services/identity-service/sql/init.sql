-- Run this in pgAdmin, inside the identity_db database's Query Tool

CREATE TYPE role AS ENUM ('citizen', 'organisation', 'police', 'platform_admin');
CREATE TYPE tenant_status AS ENUM ('pending', 'approved');

CREATE TABLE organisations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  status tenant_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE police_stations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  status tenant_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Note: org_id / station_id below do NOT use REFERENCES, since organisations
-- and police_stations live in the same database as users here — that's fine,
-- they're all owned by identity-service. What you should never do is add a
-- REFERENCES pointing at a table in intake_db; cross-database foreign keys
-- aren't possible in Postgres anyway, and cross-service ones are a design smell.
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role role NOT NULL,
  org_id INTEGER REFERENCES organisations(id),
  station_id INTEGER REFERENCES police_stations(id),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Sample data to test with
INSERT INTO organisations (name, status) VALUES ('Acme Corp', 'approved');
INSERT INTO police_stations (name, lat, lng, status) VALUES ('Manipal Town PS', 13.3467, 74.7869, 'approved');
