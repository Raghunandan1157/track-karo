-- Track_karo database schema (Neon Postgres)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS branches (
  id serial PRIMARY KEY,
  name text NOT NULL,
  address text,
  lat double precision,
  lng double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  userid text NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','branch_manager','field_officer')),
  branch_id int REFERENCES branches(id) ON DELETE SET NULL,
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_userid_lower ON users (lower(userid));

CREATE TABLE IF NOT EXISTS device_tokens (
  id serial PRIMARY KEY,
  user_id int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id serial PRIMARY KEY,
  name text NOT NULL,
  village text,
  phone text,
  branch_id int REFERENCES branches(id) ON DELETE SET NULL,
  lat double precision,
  lng double precision,
  located_at timestamptz,
  located_by int REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customers_name_lower ON customers (lower(name) text_pattern_ops);

-- one row per field officer per working day; also holds the live position
CREATE TABLE IF NOT EXISTS duty_days (
  id serial PRIMARY KEY,
  officer_id int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day date NOT NULL,
  started_at timestamptz,
  ended_at timestamptz,
  distance_m double precision NOT NULL DEFAULT 0,
  anchor_lat double precision,
  anchor_lng double precision,
  last_lat double precision,
  last_lng double precision,
  last_point_at timestamptz,
  battery int,
  location_on boolean NOT NULL DEFAULT true,
  no_signal_alerted boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (officer_id, day)
);

-- every GPS point with its timestamp (route replay + distance)
CREATE TABLE IF NOT EXISTS location_points (
  id bigserial PRIMARY KEY,
  officer_id int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day date NOT NULL,
  ts timestamptz NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy real,
  speed real,
  heading real,
  battery smallint
);
CREATE UNIQUE INDEX IF NOT EXISTS location_points_officer_ts ON location_points (officer_id, ts);
CREATE INDEX IF NOT EXISTS location_points_officer_day ON location_points (officer_id, day, ts);

-- locations (centers / villages) the branch manager gives an officer for a day, with a geofence
CREATE TABLE IF NOT EXISTS assignments (
  id serial PRIMARY KEY,
  officer_id int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id int,
  day date NOT NULL,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'center' CHECK (kind IN ('center','village')),
  address text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  radius_m int NOT NULL DEFAULT 60,
  created_by int,
  missed_alerted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assignments_officer_day ON assignments (officer_id, day);

-- time spent inside an assignment's geofence
CREATE TABLE IF NOT EXISTS visits (
  id serial PRIMARY KEY,
  assignment_id int NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  officer_id int NOT NULL,
  day date NOT NULL,
  enter_at timestamptz NOT NULL,
  exit_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS visits_assignment ON visits (assignment_id);

-- declared lunch breaks (button in the app)
CREATE TABLE IF NOT EXISTS breaks (
  id serial PRIMARY KEY,
  officer_id int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day date NOT NULL,
  kind text NOT NULL DEFAULT 'lunch',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  lat double precision,
  lng double precision,
  alerted boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS breaks_officer_day ON breaks (officer_id, day);

-- "variable task": officer captures the live location of an existing customer
CREATE TABLE IF NOT EXISTS customer_visits (
  id serial PRIMARY KEY,
  customer_id int NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  officer_id int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day date NOT NULL,
  ts timestamptz NOT NULL DEFAULT now(),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy real
);
CREATE INDEX IF NOT EXISTS customer_visits_officer_day ON customer_visits (officer_id, day);

-- location on/off log
CREATE TABLE IF NOT EXISTS officer_events (
  id serial PRIMARY KEY,
  officer_id int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day date NOT NULL,
  type text NOT NULL,
  ts timestamptz NOT NULL DEFAULT now(),
  lat double precision,
  lng double precision
);
CREATE INDEX IF NOT EXISTS officer_events_officer_day ON officer_events (officer_id, day);

CREATE TABLE IF NOT EXISTS alerts (
  id serial PRIMARY KEY,
  type text NOT NULL,
  target_role text NOT NULL,           -- 'admin' or 'branch_manager'
  officer_id int REFERENCES users(id) ON DELETE CASCADE,
  branch_id int,
  title text NOT NULL,
  body text,
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS alerts_created ON alerts (created_at DESC);

-- groups of officers standing together during office hours
CREATE TABLE IF NOT EXISTS meetings (
  id serial PRIMARY KEY,
  day date NOT NULL,
  lat double precision,
  lng double precision,
  officer_ids int[] NOT NULL,
  started_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  alerted boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);

-- assignment + visit summary. "visited" = at least 2 minutes inside the geofence.
CREATE OR REPLACE VIEW assignment_status AS
SELECT a.id, a.officer_id, u.name AS officer_name, a.branch_id, a.day, a.name, a.kind, a.address,
       a.lat, a.lng, a.radius_m, a.missed_alerted,
       COALESCE(v.secs, 0) AS secs, v.first_enter_at, v.last_exit_at,
       (COALESCE(v.secs, 0) >= 120) AS visited
FROM assignments a
JOIN users u ON u.id = a.officer_id
LEFT JOIN (
  SELECT assignment_id, sum(extract(epoch FROM exit_at - enter_at)) AS secs,
         min(enter_at) AS first_enter_at, max(exit_at) AS last_exit_at
  FROM visits GROUP BY assignment_id
) v ON v.assignment_id = a.id;

-- ---------- database push: every change is announced on the "track_events" channel ----------
CREATE OR REPLACE FUNCTION notify_duty() RETURNS trigger AS $$
DECLARE u record; st text;
BEGIN
  SELECT name, branch_id INTO u FROM users WHERE id = NEW.officer_id;
  st := CASE
    WHEN NEW.ended_at IS NOT NULL THEN 'day_ended'
    WHEN NOT NEW.location_on THEN 'location_off'
    WHEN EXISTS (SELECT 1 FROM breaks b WHERE b.officer_id = NEW.officer_id AND b.day = NEW.day AND b.ended_at IS NULL) THEN 'on_lunch'
    ELSE 'on_duty' END;
  PERFORM pg_notify('track_events', json_build_object('t', 'location', 'branch_id', u.branch_id, 'd',
    json_build_object('officer_id', NEW.officer_id, 'name', u.name, 'lat', NEW.last_lat, 'lng', NEW.last_lng,
      'ts', NEW.last_point_at, 'status', st, 'distance_m', round(NEW.distance_m), 'branch_id', u.branch_id,
      'battery', NEW.battery))::text);
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS duty_notify ON duty_days;
CREATE TRIGGER duty_notify AFTER INSERT OR UPDATE ON duty_days FOR EACH ROW EXECUTE FUNCTION notify_duty();

CREATE OR REPLACE FUNCTION notify_customer() RETURNS trigger AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.lat IS DISTINCT FROM OLD.lat OR NEW.lng IS DISTINCT FROM OLD.lng
     OR NEW.located_at IS DISTINCT FROM OLD.located_at) THEN
    PERFORM pg_notify('track_events', json_build_object('t', 'customer', 'branch_id', NEW.branch_id, 'd',
      json_build_object('id', NEW.id, 'name', NEW.name, 'village', NEW.village, 'lat', NEW.lat, 'lng', NEW.lng,
        'located_at', NEW.located_at, 'branch_id', NEW.branch_id))::text);
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS customer_notify ON customers;
CREATE TRIGGER customer_notify AFTER INSERT OR UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION notify_customer();

CREATE OR REPLACE FUNCTION notify_alert() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('track_events', json_build_object('t', 'alert', 'branch_id', NEW.branch_id,
    'target_role', NEW.target_role, 'd',
    json_build_object('id', NEW.id, 'type', NEW.type, 'title', NEW.title, 'body', left(NEW.body, 500),
      'officer_id', NEW.officer_id,
      'officer_name', (SELECT name FROM users WHERE id = NEW.officer_id),
      'branch_id', NEW.branch_id,
      'branch_name', (SELECT name FROM branches WHERE id = NEW.branch_id),
      'data', NEW.data, 'created_at', NEW.created_at, 'read_at', NEW.read_at))::text);
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS alert_notify ON alerts;
CREATE TRIGGER alert_notify AFTER INSERT ON alerts FOR EACH ROW EXECUTE FUNCTION notify_alert();

-- ---------- seed ----------
INSERT INTO settings (key, value) VALUES
  ('office_start', '"09:30"'), ('office_end', '"18:30"'), ('lunch_allowed_min', '60'), ('stop_min', '20'),
  ('geofence_radius_m', '60'), ('meeting_min_officers', '3'), ('meeting_radius_m', '50'),
  ('meeting_min_minutes', '15'), ('no_signal_min', '10')
ON CONFLICT (key) DO NOTHING;

-- admin login (password stored only as a bcrypt hash)
INSERT INTO users (userid, name, password_hash, role)
SELECT 'Ganesh', 'Ganesh', crypt('123', gen_salt('bf', 10)), 'admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE lower(userid) = 'ganesh');
