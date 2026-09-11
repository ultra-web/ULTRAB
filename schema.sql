PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('admin', 'company', 'customer')),
  role TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  phone TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  lga TEXT NOT NULL DEFAULT 'Makurdi',
  cac TEXT NOT NULL DEFAULT '',
  nin TEXT NOT NULL UNIQUE,
  representative_name TEXT,
  documents_json TEXT NOT NULL DEFAULT '{}',
  device_suspended INTEGER NOT NULL DEFAULT 0,
  suspension_reason TEXT NOT NULL DEFAULT '',
  suspension_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS licenses (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  lga TEXT NOT NULL,
  cac TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pending Activation',
  issue_date TEXT,
  expiry_date TEXT,
  barcode TEXT,
  representative_name TEXT NOT NULL DEFAULT '',
  documents_json TEXT NOT NULL DEFAULT '{}',
  compliance_flagged INTEGER NOT NULL DEFAULT 0,
  flag_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  lga TEXT NOT NULL,
  fee INTEGER NOT NULL DEFAULT 50000,
  status TEXT NOT NULL,
  date TEXT,
  cac TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  model TEXT NOT NULL,
  category TEXT NOT NULL,
  imei TEXT NOT NULL UNIQUE,
  id_type TEXT NOT NULL DEFAULT 'IMEI',
  condition TEXT NOT NULL DEFAULT 'Brand New',
  warranty_days INTEGER NOT NULL DEFAULT 365 CHECK (warranty_days IN (14, 365)),
  owner TEXT NOT NULL,
  company_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  company_name TEXT,
  linked_customer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  customer_name TEXT,
  purchase_date TEXT,
  status TEXT NOT NULL DEFAULT 'Clean & Registered',
  reg_date TEXT NOT NULL,
  fee INTEGER NOT NULL DEFAULT 1000,
  transfer_history_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS complaints (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  reporter TEXT NOT NULL,
  target TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS transfers (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  device_model TEXT NOT NULL,
  device_imei TEXT NOT NULL,
  sender_id TEXT NOT NULL REFERENCES users(id),
  sender_name TEXT NOT NULL,
  recipient_id TEXT NOT NULL REFERENCES users(id),
  recipient_name TEXT NOT NULL,
  date TEXT NOT NULL,
  fee INTEGER NOT NULL DEFAULT 2000,
  status TEXT NOT NULL DEFAULT 'Completed'
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  date TEXT NOT NULL,
  lga TEXT NOT NULL,
  entity_id TEXT
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_devices_company ON devices(company_id);
CREATE INDEX IF NOT EXISTS idx_devices_customer ON devices(linked_customer_id);
CREATE INDEX IF NOT EXISTS idx_devices_imei ON devices(imei);
CREATE INDEX IF NOT EXISTS idx_licenses_company ON licenses(company_id);
