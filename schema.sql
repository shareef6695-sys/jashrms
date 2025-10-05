-- Roles, users, sessions
CREATE TABLE IF NOT EXISTS roles ( id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL );
CREATE TABLE IF NOT EXISTS users ( id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role_id INT NOT NULL REFERENCES roles(id), employee_id INT, created_at TIMESTAMPTZ DEFAULT now() );
CREATE TABLE IF NOT EXISTS sessions ( token TEXT PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL );

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY, code TEXT UNIQUE, name_en TEXT NOT NULL, name_ar TEXT, nationality TEXT,
  iqama_no TEXT, iqama_expiry DATE, saudi_id_no TEXT, passport_no TEXT, passport_expiry DATE,
  gosi_status TEXT CHECK (gosi_status IN ('saudi','expatriate','none')) DEFAULT 'none',
  iban TEXT, bank_name TEXT, start_date DATE, base_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  housing_allowance NUMERIC(12,2) NOT NULL DEFAULT 0, status TEXT DEFAULT 'active'
);

-- Settings
CREATE TABLE IF NOT EXISTS settings ( id SERIAL PRIMARY KEY, key TEXT UNIQUE NOT NULL, value JSONB NOT NULL );

-- Payroll
CREATE TABLE IF NOT EXISTS payroll_periods ( id SERIAL PRIMARY KEY, yyyymm CHAR(6) UNIQUE NOT NULL, status TEXT DEFAULT 'draft', value_date DATE );
CREATE TABLE IF NOT EXISTS payroll_lines (
  id SERIAL PRIMARY KEY, period_id INT NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE, employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  earnings JSONB NOT NULL DEFAULT '{"basic":0,"housing":0,"overtime":0,"other":0}',
  deductions JSONB NOT NULL DEFAULT '{"gosi":0,"loans":0,"absences":0,"other":0}',
  gosi_base NUMERIC(12,2) NOT NULL DEFAULT 0, net_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  wps_status TEXT DEFAULT 'pending', failure_reason TEXT, UNIQUE(period_id, employee_id)
);

-- WPS & holidays
CREATE TABLE IF NOT EXISTS wps_files ( id SERIAL PRIMARY KEY, period_id INT REFERENCES payroll_periods(id) ON DELETE CASCADE, header_total NUMERIC(14,2) NOT NULL, file_path TEXT, generated_at TIMESTAMPTZ DEFAULT now() );
CREATE TABLE IF NOT EXISTS holidays ( id SERIAL PRIMARY KEY, date DATE UNIQUE NOT NULL, name TEXT );

-- Attendance/shifts/OT
CREATE TABLE IF NOT EXISTS shifts ( id SERIAL PRIMARY KEY, name TEXT NOT NULL, code TEXT UNIQUE, start_time TIME NOT NULL, end_time TIME NOT NULL, overnight BOOLEAN DEFAULT FALSE, break_minutes INT DEFAULT 60, weekly_off INT[] DEFAULT '{5,6}', active BOOLEAN DEFAULT TRUE );
CREATE TABLE IF NOT EXISTS shift_assignments ( id SERIAL PRIMARY KEY, employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE, shift_id INT NOT NULL REFERENCES shifts(id), effective_from DATE NOT NULL, effective_to DATE, UNIQUE(employee_id, effective_from) );
CREATE TABLE IF NOT EXISTS overtime_rules ( id SERIAL PRIMARY KEY, effective_from DATE NOT NULL, name TEXT NOT NULL, cfg JSONB NOT NULL, pay_cfg JSONB DEFAULT '{"basis":"basic","hour_divisor":240,"regular_multiplier":1.25,"weekend_multiplier":1.5,"holiday_multiplier":2.0,"night_multiplier":1.25}' );
CREATE TABLE IF NOT EXISTS attendance_logs ( id SERIAL PRIMARY KEY, employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE, ts TIMESTAMPTZ NOT NULL DEFAULT now(), action TEXT CHECK (action IN ('check_in','check_out')) NOT NULL, source TEXT, note TEXT );
CREATE INDEX IF NOT EXISTS idx_att_emp_ts ON attendance_logs(employee_id, ts);
CREATE TABLE IF NOT EXISTS timesheets (
  id SERIAL PRIMARY KEY, employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE, work_date DATE NOT NULL, shift_id INT REFERENCES shifts(id),
  scheduled_minutes INT DEFAULT 0, worked_minutes INT DEFAULT 0, night_minutes INT DEFAULT 0, late_minutes INT DEFAULT 0, early_leave_minutes INT DEFAULT 0,
  ot_regular_minutes INT DEFAULT 0, ot_weekend_minutes INT DEFAULT 0, ot_holiday_minutes INT DEFAULT 0,
  ot_regular_amount NUMERIC(12,2) DEFAULT 0, ot_weekend_amount NUMERIC(12,2) DEFAULT 0, ot_holiday_amount NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'posted', UNIQUE(employee_id, work_date)
);
CREATE TABLE IF NOT EXISTS ot_caps_audit (
  id BIGSERIAL PRIMARY KEY, employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE, work_date DATE NOT NULL, policy_snapshot JSONB NOT NULL,
  before_regular INT NOT NULL, before_weekend INT NOT NULL, before_holiday INT NOT NULL, after_regular INT NOT NULL, after_weekend INT NOT NULL, after_holiday INT NOT NULL,
  week_used_before INT, created_at TIMESTAMPTZ DEFAULT now(), UNIQUE(employee_id, work_date)
);

-- Defaults
INSERT INTO roles (name) VALUES ('admin'),('hr_ops'),('payroll'),('manager'),('employee') ON CONFLICT DO NOTHING;
INSERT INTO settings(key, value) VALUES
 ('wps_bank_config', jsonb_build_object('destId','BANKSWITCH','estbId','MOL-ESTB-1234','bankAccount','SA1234567890000000000','currency','SAR'))
 ON CONFLICT (key) DO NOTHING;
INSERT INTO settings(key, value) VALUES
 ('payroll_policy', jsonb_build_object('include_ot_in_gosi_base', false, 'week_start_day','sun', 'ot_caps', jsonb_build_object('per_day_minutes',240,'per_week_minutes',720,'enforce',true,'excess_handling','truncate')))
 ON CONFLICT (key) DO NOTHING;
