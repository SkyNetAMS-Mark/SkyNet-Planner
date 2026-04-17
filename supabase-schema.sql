-- SkyNet Belgium Parcel Delivery System
-- Database Schema for Supabase PostgreSQL
-- Run this script in your Supabase SQL Editor

-- Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create Custom Types (only if they don't exist)
DO $$ BEGIN
    CREATE TYPE vehicle_type AS ENUM ('owned', 'external');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE driver_status AS ENUM ('active', 'inactive');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE parcel_status AS ENUM ('pending', 'slot_selected', 'in_transit', 'delivered', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE admin_role AS ENUM ('admin', 'manager', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Core Tables

-- 1. Drivers Table
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  vehicle_type vehicle_type NOT NULL DEFAULT 'external',
  vehicle_registration TEXT,
  status driver_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_drivers_status ON drivers(status);
CREATE INDEX idx_drivers_email ON drivers(email);

COMMENT ON TABLE drivers IS 'Delivery drivers, both owned and external contractors';

-- 2. Regions Table
CREATE TABLE regions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#6366F1',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_regions_active ON regions(is_active);

COMMENT ON TABLE regions IS 'Geographic delivery regions (e.g., Brussels, North)';

-- 3. Postal Codes Table
CREATE TABLE postal_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code INTEGER NOT NULL UNIQUE CHECK (code >= 1000 AND code <= 9999),
  region_id UUID NOT NULL REFERENCES regions(id) ON DELETE RESTRICT,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_postal_codes_code ON postal_codes(code);
CREATE INDEX idx_postal_codes_region ON postal_codes(region_id);

COMMENT ON TABLE postal_codes IS 'Belgian postal codes (1000-9999) mapped to delivery regions';

-- 4. Delivery Periods Table
CREATE TABLE delivery_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

CREATE INDEX idx_delivery_periods_sort ON delivery_periods(sort_order);

COMMENT ON TABLE delivery_periods IS 'Delivery time periods (e.g., Morning 08:00-12:00)';

-- 5. Region Schedules Table
CREATE TABLE region_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
  period_id UUID NOT NULL REFERENCES delivery_periods(id) ON DELETE RESTRICT,
  max_deliveries INTEGER NOT NULL CHECK (max_deliveries > 0),
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_region_schedule UNIQUE (region_id, day_of_week, period_id)
);

CREATE INDEX idx_region_schedules_region ON region_schedules(region_id);
CREATE INDEX idx_region_schedules_day ON region_schedules(day_of_week);
CREATE INDEX idx_region_schedules_period ON region_schedules(period_id);
CREATE INDEX idx_region_schedules_driver ON region_schedules(driver_id);
CREATE INDEX idx_region_schedules_lookup ON region_schedules(region_id, day_of_week, period_id);

COMMENT ON TABLE region_schedules IS 'Defines when regions are serviced and capacity limits';
COMMENT ON COLUMN region_schedules.day_of_week IS '1=Monday, 2=Tuesday, ..., 7=Sunday';

-- 6. Senders Table
CREATE TABLE senders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_senders_company ON senders(company_name);
CREATE INDEX idx_senders_active ON senders(is_active);

COMMENT ON TABLE senders IS 'E-commerce companies that send parcels through SkyNet';

-- 7. Parcels Table
CREATE TABLE parcels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tracking_number TEXT NOT NULL UNIQUE,
  sender_id UUID NOT NULL REFERENCES senders(id) ON DELETE RESTRICT,
  receiver_name TEXT NOT NULL,
  receiver_email TEXT NOT NULL,
  receiver_phone TEXT NOT NULL,
  receiver_address TEXT NOT NULL,
  receiver_postal_code INTEGER NOT NULL CHECK (receiver_postal_code >= 1000 AND receiver_postal_code <= 9999),
  region_id UUID REFERENCES regions(id) ON DELETE RESTRICT,
  delivery_date DATE NOT NULL,
  selected_slot_id UUID REFERENCES region_schedules(id) ON DELETE SET NULL,
  status parcel_status NOT NULL DEFAULT 'pending',
  secret_token TEXT NOT NULL UNIQUE,
  token_used BOOLEAN NOT NULL DEFAULT false,
  token_expires_at TIMESTAMPTZ,
  notes TEXT,
  weight_kg DECIMAL(10,2),
  dimensions_cm TEXT,
  special_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  slot_selected_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

CREATE INDEX idx_parcels_tracking ON parcels(tracking_number);
CREATE INDEX idx_parcels_token ON parcels(secret_token);
CREATE INDEX idx_parcels_status ON parcels(status);
CREATE INDEX idx_parcels_delivery_date ON parcels(delivery_date);
CREATE INDEX idx_parcels_postal_code ON parcels(receiver_postal_code);
CREATE INDEX idx_parcels_region ON parcels(region_id);
CREATE INDEX idx_parcels_slot ON parcels(selected_slot_id);
CREATE INDEX idx_parcels_sender ON parcels(sender_id);

COMMENT ON TABLE parcels IS 'Individual parcel deliveries';

-- 8. Parcel History Table
CREATE TABLE parcel_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  notes TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_parcel_history_parcel ON parcel_history(parcel_id);
CREATE INDEX idx_parcel_history_created ON parcel_history(created_at DESC);

COMMENT ON TABLE parcel_history IS 'Audit trail of all parcel status changes';

-- 9. Admin Users Table
CREATE TABLE admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role admin_role NOT NULL DEFAULT 'viewer',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_users_role ON admin_users(role);
CREATE INDEX idx_admin_users_active ON admin_users(is_active);

COMMENT ON TABLE admin_users IS 'Admin dashboard users with role-based access';

-- Functions and Triggers

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_regions_updated_at BEFORE UPDATE ON regions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_postal_codes_updated_at BEFORE UPDATE ON postal_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_delivery_periods_updated_at BEFORE UPDATE ON delivery_periods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_region_schedules_updated_at BEFORE UPDATE ON region_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_senders_updated_at BEFORE UPDATE ON senders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parcels_updated_at BEFORE UPDATE ON parcels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-generate tracking numbers
CREATE OR REPLACE FUNCTION generate_tracking_number()
RETURNS TEXT AS $$
DECLARE
  new_tracking TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    new_tracking := 'SKY' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    SELECT EXISTS(SELECT 1 FROM parcels WHERE tracking_number = new_tracking) INTO exists;
    IF NOT exists THEN
      RETURN new_tracking;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_tracking_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tracking_number IS NULL OR NEW.tracking_number = '' THEN
    NEW.tracking_number := generate_tracking_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_parcel_tracking_number BEFORE INSERT ON parcels
  FOR EACH ROW EXECUTE FUNCTION set_tracking_number();

-- Auto-generate secret tokens
CREATE OR REPLACE FUNCTION generate_secret_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'base64');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_secret_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.secret_token IS NULL OR NEW.secret_token = '' THEN
    NEW.secret_token := generate_secret_token();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_parcel_secret_token BEFORE INSERT ON parcels
  FOR EACH ROW EXECUTE FUNCTION set_secret_token();

-- Auto-assign region from postal code
CREATE OR REPLACE FUNCTION assign_region_from_postal_code()
RETURNS TRIGGER AS $$
BEGIN
  SELECT region_id INTO NEW.region_id
  FROM postal_codes
  WHERE code = NEW.receiver_postal_code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assign_parcel_region BEFORE INSERT OR UPDATE ON parcels
  FOR EACH ROW EXECUTE FUNCTION assign_region_from_postal_code();

-- Log parcel status changes
CREATE OR REPLACE FUNCTION log_parcel_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO parcel_history (parcel_id, status, notes)
    VALUES (NEW.id, NEW.status, 'Status changed to ' || NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_parcel_status AFTER INSERT OR UPDATE ON parcels
  FOR EACH ROW EXECUTE FUNCTION log_parcel_status_change();

-- Views

-- Available Slots View
CREATE OR REPLACE VIEW available_slots AS
SELECT 
  rs.id,
  rs.region_id,
  r.name as region_name,
  rs.day_of_week,
  rs.period_id,
  dp.name as period_name,
  dp.start_time,
  dp.end_time,
  rs.max_deliveries,
  rs.driver_id,
  d.name as driver_name,
  rs.is_active
FROM region_schedules rs
JOIN regions r ON rs.region_id = r.id
JOIN delivery_periods dp ON rs.period_id = dp.id
LEFT JOIN drivers d ON rs.driver_id = d.id
WHERE rs.is_active = true
  AND r.is_active = true
  AND dp.is_active = true;

-- Parcel Dashboard View
CREATE OR REPLACE VIEW parcel_dashboard AS
SELECT 
  p.id,
  p.tracking_number,
  p.receiver_name,
  p.receiver_postal_code,
  p.delivery_date,
  p.status,
  p.token_used,
  s.company_name as sender_name,
  r.name as region_name,
  rs.day_of_week,
  dp.name as period_name,
  p.created_at,
  p.updated_at
FROM parcels p
JOIN senders s ON p.sender_id = s.id
LEFT JOIN regions r ON p.region_id = r.id
LEFT JOIN region_schedules rs ON p.selected_slot_id = rs.id
LEFT JOIN delivery_periods dp ON rs.period_id = dp.id;

-- Slot Capacity View
CREATE OR REPLACE VIEW slot_capacity AS
SELECT 
  rs.id as slot_id,
  rs.region_id,
  r.name as region_name,
  rs.day_of_week,
  rs.period_id,
  dp.name as period_name,
  rs.max_deliveries,
  COUNT(p.id) as current_count,
  rs.max_deliveries - COUNT(p.id) as available_capacity,
  ROUND((COUNT(p.id)::DECIMAL / rs.max_deliveries) * 100, 2) as utilization_percentage
FROM region_schedules rs
JOIN regions r ON rs.region_id = r.id
JOIN delivery_periods dp ON rs.period_id = dp.id
LEFT JOIN parcels p ON p.selected_slot_id = rs.id 
  AND p.status NOT IN ('delivered', 'cancelled', 'failed')
WHERE rs.is_active = true
GROUP BY rs.id, rs.region_id, r.name, rs.day_of_week, rs.period_id, dp.name, rs.max_deliveries;

-- Seed Data

-- Insert default delivery periods
INSERT INTO delivery_periods (name, start_time, end_time, sort_order) VALUES
  ('Morning', '08:00:00', '12:00:00', 1),
  ('Afternoon', '12:00:00', '17:00:00', 2),
  ('Evening', '17:00:00', '21:00:00', 3);

-- Insert sample regions
INSERT INTO regions (name, description, color) VALUES
  ('Brussels', 'Brussels Capital Region', '#6366F1'),
  ('Flanders North', 'Northern Flanders region', '#10B981'),
  ('Flanders South', 'Southern Flanders region', '#F59E0B'),
  ('Wallonia', 'Wallonia region', '#EF4444');

-- Note: You'll need to manually insert postal codes or use a bulk import
-- Example for Brussels postal codes (1000-1299):
-- INSERT INTO postal_codes (code, region_id, city)
-- SELECT 
--   code,
--   (SELECT id FROM regions WHERE name = 'Brussels'),
--   'Brussels'
-- FROM generate_series(1000, 1299) AS code;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'SkyNet database schema created successfully!';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Import postal codes for your regions';
  RAISE NOTICE '2. Create your first admin user in Supabase Auth';
  RAISE NOTICE '3. Add the user to admin_users table';
  RAISE NOTICE '4. Configure region schedules';
END $$;