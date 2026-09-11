require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured in production.');
}
const JWT_SECRET = process.env.JWT_SECRET || 'btrcp-development-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);
const databaseFile = path.resolve(ROOT, process.env.DATABASE_FILE || './data/btrcp.sqlite');
fs.mkdirSync(path.dirname(databaseFile), { recursive: true });

const db = new Database(databaseFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(ROOT, 'schema.sql'), 'utf8'));

const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || true,
  credentials: false
}));
app.use(express.json({ limit: '25mb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' }
});

const today = () => new Date().toISOString().slice(0, 10);
const id = prefix => `${prefix}-${crypto.randomInt(10000, 99999)}`;
const parseJson = (value, fallback) => {
  try { return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; }
};
const json = value => JSON.stringify(value || {});
const bool = value => Boolean(value);

function userFromRow(row) {
  if (!row) return null;
  return {
    id: row.id, type: row.type, role: row.role, name: row.name, email: row.email,
    phone: row.phone, lga: row.lga, cac: row.cac, nin: row.nin,
    representativeName: row.representative_name,
    documents: parseJson(row.documents_json, {}),
    deviceSuspended: bool(row.device_suspended),
    suspensionReason: row.suspension_reason,
    suspensionDate: row.suspension_date
  };
}
function licenseFromRow(row) {
  return {
    id: row.id, companyId: row.company_id, companyName: row.company_name, lga: row.lga,
    cac: row.cac, status: row.status, issueDate: row.issue_date, expiryDate: row.expiry_date,
    barcode: row.barcode, representativeName: row.representative_name,
    documents: parseJson(row.documents_json, {}), complianceFlagged: bool(row.compliance_flagged),
    flagReason: row.flag_reason
  };
}
function deviceFromRow(row) {
  return {
    id: row.id, model: row.model, cat: row.category, imei: row.imei, idType: row.id_type,
    condition: row.condition, warrantyDays: row.warranty_days, owner: row.owner,
    companyId: row.company_id, companyName: row.company_name, linkedCustomerId: row.linked_customer_id,
    customerName: row.customer_name, purchaseDate: row.purchase_date, status: row.status,
    regDate: row.reg_date, fee: row.fee, transferHistory: parseJson(row.transfer_history_json, [])
  };
}
function publicUser(row) {
  const user = userFromRow(row);
  if (user) delete user.documents;
  return user;
}
function tokenFor(user) {
  return jwt.sign({ sub: user.id, type: user.type, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
function audit(actorId, action, entityType, entityId, metadata) {
  db.prepare(`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata_json)
    VALUES (?, ?, ?, ?, ?)`).run(actorId || null, action, entityType || null, entityId || null, json(metadata));
}

function seed() {
  if (db.prepare('SELECT COUNT(*) AS count FROM users').get().count === 0) {
    const insert = db.prepare(`INSERT INTO users
      (id, type, role, name, email, phone, password_hash, lga, cac, nin, representative_name)
      VALUES (@id, @type, @role, @name, @email, @phone, @password_hash, @lga, @cac, @nin, @representative_name)`);
    [
      ['ACC-001', 'admin', 'master_admin', 'BITDA Administrator', 'admin@bitda.gov', '08000000000', '12345678901', '', ''],
      ['ACC-002', 'company', null, 'Ultradigital Technologies Ltd', 'company@ultradigital.ng', '08011112222', '23456789012', 'RC-184920', 'Terver Shija'],
      ['ACC-003', 'customer', null, 'John Demo', 'customer@demo.ng', '08033334444', '34567890123', '', '']
    ].forEach(([userId, type, role, name, email, phone, nin, cac, representativeName]) => insert.run({
      id: userId, type, role, name, email, phone, nin, cac, representative_name: representativeName,
      password_hash: bcrypt.hashSync(type === 'admin' ? 'admin123' : type === 'company' ? 'company123' : 'customer123', BCRYPT_ROUNDS),
      lga: 'Makurdi'
    }));
  }
  if (db.prepare('SELECT COUNT(*) AS count FROM licenses').get().count === 0) {
    const insert = db.prepare(`INSERT INTO licenses
      (id, company_id, company_name, lga, cac, status, issue_date, expiry_date, barcode, representative_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    insert.run('BITDA-2026-1001', 'ACC-002', 'Ultradigital Technologies Ltd', 'Makurdi', 'RC-184920', 'Active', '2026-01-15', '2027-01-15', 'BTRCP-ULTR-2026', 'Terver Shija');
    insert.run('BITDA-2026-1002', null, 'Benue Gadgets & Telecom Systems', 'Gboko', 'RC-928104', 'Active', '2026-02-10', '2027-02-10', 'BTRCP-BGTS-2026', '');
    insert.run('BITDA-2026-1003', null, 'Food Basket Electronics', 'Otukpo', 'BN-304918', 'Active', '2026-02-18', '2027-02-18', 'BTRCP-FOOD-2026', '');
    insert.run('BITDA-2026-1004', null, 'Katsina-Ala Tech Hub', 'Katsina-Ala', 'RC-402911', 'Pending Activation', null, null, null, '');
  }
  if (db.prepare('SELECT COUNT(*) AS count FROM businesses').get().count === 0) {
    const insert = db.prepare(`INSERT INTO businesses (id, name, category, lga, fee, status, date, cac)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    [
      ['BITDA-2026-1001', 'Ultradigital Technologies Ltd', 'Company Operational License', 'Makurdi', 'Verified & Active', '2026-01-15', 'RC-184920'],
      ['BITDA-2026-1002', 'Benue Gadgets & Telecom Systems', 'Company Operational License', 'Gboko', 'Verified & Active', '2026-02-10', 'RC-928104'],
      ['BITDA-2026-1003', 'Food Basket Electronics', 'Individual Operator License', 'Otukpo', 'Verified & Active', '2026-02-18', 'BN-304918'],
      ['BITDA-2026-1004', 'Katsina-Ala Tech Hub', 'Company Operational License', 'Katsina-Ala', 'Pending Audit', '2026-03-01', 'RC-402911'],
      ['BITDA-2026-1005', 'Apex Micro Hardware Dealers', 'OEM Partner Cert', 'Makurdi', 'Substandard Penalty Flagged', '2026-03-05', 'RC-102948']
    ].forEach(([businessId, name, category, lga, status, date, cac]) => insert.run(businessId, name, category, lga, 50000, status, date, cac));
  }
  if (db.prepare('SELECT COUNT(*) AS count FROM devices').get().count === 0) {
    const insert = db.prepare(`INSERT INTO devices
      (id, model, category, imei, id_type, condition, warranty_days, owner, company_id, company_name,
       linked_customer_id, customer_name, purchase_date, status, reg_date, fee)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    insert.run('DEV-88210', 'Samsung Galaxy S23 Ultra', 'Mobile Phone', '358910112233445', 'IMEI', 'Brand New', 365, 'Benue Gadgets Hub', 'ACC-002', 'Ultradigital Technologies Ltd', null, null, null, 'Clean & Registered', '2026-01-20', 1000);
    insert.run('DEV-88211', 'Dell Latitude 5420 Laptop', 'Laptop / Computer', 'SN-DL90128401', 'Serial Number', 'Brand New', 365, 'Ultradigital Ltd', 'ACC-002', 'Ultradigital Technologies Ltd', 'ACC-003', 'John Demo', '2026-02-15', 'Clean & Registered', '2026-01-22', 1000);
    insert.run('DEV-88212', 'Mikrotik Cloud Router', 'Networking', '354920192019283', 'IMEI', 'Brand New', 365, 'Food Basket Electronics', null, 'Food Basket Electronics', null, null, null, 'Clean & Registered', '2026-02-01', 1000);
    insert.run('DEV-88213', 'iPhone 14 Pro Max', 'Mobile Phone', '351029384756102', 'IMEI', 'Used', 14, 'Private Citizen', null, 'Benue Gadgets Hub', 'ACC-003', 'John Demo', '2026-01-10', 'FLAGGED STOLEN', '2026-01-05', 1000);
  }
  if (db.prepare('SELECT COUNT(*) AS count FROM complaints').get().count === 0) {
    const insert = db.prepare('INSERT INTO complaints (id, type, reporter, target, date, status) VALUES (?, ?, ?, ?, ?, ?)');
    insert.run('TCK-901', 'Substandard Product Sold', 'Terrence Suswam', 'Apex Micro Hardware Dealers', '2026-02-20', 'Penalty ₦500k Issued');
    insert.run('TCK-902', 'Stolen / Lost Device', 'Amina Ibrahim', 'IMEI 351029384756102', '2026-02-28', 'Blacklisted on CEIR');
  }
}
seed();

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
    if (!row) return res.status(401).json({ error: 'Account no longer exists.' });
    req.user = row;
    next();
  } catch (_) {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
}
function requireAdmin(req, res, next) {
  if (req.user.type !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
  next();
}
function requireMaster(req, res, next) {
  if (req.user.type !== 'admin' || req.user.role !== 'master_admin') return res.status(403).json({ error: 'Master admin access required.' });
  next();
}
function requireLicenseAdmin(req, res, next) {
  if (req.user.type !== 'admin' || !['master_admin', 'license_renewal'].includes(req.user.role)) {
    return res.status(403).json({ error: 'License administrator access required.' });
  }
  next();
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'btrcp', database: path.basename(databaseFile) }));

app.post('/api/auth/login', authLimiter, (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) return res.status(401).json({ error: 'Invalid email or password.' });
  audit(row.id, 'login', 'user', row.id);
  res.json({ token: tokenFor(row), user: publicUser(row) });
});

app.post('/api/auth/register', authLimiter, (req, res) => {
  const type = req.body.type === 'company' ? 'company' : 'customer';
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = String(req.body.phone || '').trim();
  const nin = String(req.body.nin || '').trim();
  const password = String(req.body.password || '');
  if (!name || !email || !phone || !/^\d{11}$/.test(nin) || password.length < 6) return res.status(400).json({ error: 'Name, email, phone, valid 11-digit NIN and a 6-character password are required.' });
  if (db.prepare('SELECT id FROM users WHERE email = ? OR nin = ?').get(email, nin)) return res.status(409).json({ error: 'Email or NIN is already registered.' });
  const userId = id('ACC');
  const lga = String(req.body.lga || 'Makurdi');
  const cac = String(req.body.cac || '');
  const representativeName = String(req.body.representativeName || '');
  const documents = req.body.documents && typeof req.body.documents === 'object' ? req.body.documents : {};
  if (type === 'company' && (!cac || !representativeName || Object.keys(documents).length < 8)) {
    return res.status(400).json({ error: 'Company CAC, representative and all required documents are required.' });
  }
  const create = db.transaction(() => {
    db.prepare(`INSERT INTO users
      (id, type, name, email, phone, password_hash, lga, cac, nin, representative_name, documents_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(userId, type, name, email, phone,
      bcrypt.hashSync(password, BCRYPT_ROUNDS), lga, cac, nin, representativeName, json(documents));
    if (type === 'company') {
      const licenseId = `BITDA-${new Date().getFullYear()}-${crypto.randomInt(1000, 9999)}`;
      db.prepare(`INSERT INTO licenses
        (id, company_id, company_name, lga, cac, status, representative_name, documents_json)
        VALUES (?, ?, ?, ?, ?, 'Pending Activation', ?, ?)`).run(licenseId, userId, name, lga, cac, representativeName, json(documents));
    }
  });
  create();
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  audit(userId, 'register', 'user', userId, { type });
  res.status(201).json({ token: tokenFor(row), user: publicUser(row) });
});

app.post('/api/auth/recover', authLimiter, (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = String(req.body.phone || '').trim();
  const nextPassword = String(req.body.newPassword || '');
  const row = db.prepare('SELECT * FROM users WHERE email = ? AND phone = ?').get(email, phone);
  if (!row || nextPassword.length < 6) return res.status(400).json({ error: 'Email, phone number and a password of at least 6 characters are required.' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(nextPassword, BCRYPT_ROUNDS), row.id);
  audit(row.id, 'password_recovery', 'user', row.id);
  res.json({ message: 'Password reset successfully.' });
});

app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

app.post('/api/auth/change-password', auth, (req, res) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');
  if (!bcrypt.compareSync(currentPassword, req.user.password_hash)) return res.status(400).json({ error: 'Current password is incorrect.' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must contain at least 6 characters.' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, BCRYPT_ROUNDS), req.user.id);
  audit(req.user.id, 'password_change', 'user', req.user.id);
  res.json({ message: 'Password changed successfully.' });
});

app.get('/api/bootstrap', auth, (req, res) => {
  const accountRows = db.prepare('SELECT * FROM users ORDER BY created_at').all();
  const licenses = db.prepare('SELECT * FROM licenses ORDER BY created_at').all().map(licenseFromRow);
  const devices = db.prepare('SELECT * FROM devices ORDER BY rowid DESC').all().map(deviceFromRow);
  const businesses = db.prepare('SELECT * FROM businesses ORDER BY rowid DESC').all().map(row => ({
    id: row.id, name: row.name, cat: row.category, lga: row.lga, fee: row.fee, status: row.status, date: row.date, cac: row.cac
  }));
  const complaints = db.prepare('SELECT * FROM complaints ORDER BY rowid DESC').all().map(row => ({
    id: row.id, type: row.type, reporter: row.reporter, target: row.target, date: row.date, status: row.status, description: row.description
  }));
  const transfers = db.prepare('SELECT * FROM transfers ORDER BY rowid DESC').all().map(row => ({
    id: row.id, deviceId: row.device_id, deviceModel: row.device_model, deviceImei: row.device_imei,
    senderId: row.sender_id, senderName: row.sender_name, recipientId: row.recipient_id,
    recipientName: row.recipient_name, date: row.date, fee: row.fee, status: row.status
  }));
  const transactions = db.prepare('SELECT * FROM transactions ORDER BY rowid DESC').all().map(row => ({
    id: row.id, type: row.type, amount: row.amount, date: row.date, lga: row.lga, entityId: row.entity_id
  }));
  res.json({ user: publicUser(req.user), accounts: accountRows.map(publicUser), licenses, devices, businesses, complaints, transfers, transactions });
});

app.post('/api/admin/accounts', auth, requireMaster, (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const role = ['license_renewal', 'public_verification'].includes(req.body.role) ? req.body.role : null;
  if (!name || !email || password.length < 6 || !role) return res.status(400).json({ error: 'Name, email, password and a valid role are required.' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'Email is already registered.' });
  const userId = id('ACC');
  db.prepare(`INSERT INTO users (id, type, role, name, email, password_hash, nin)
    VALUES (?, 'admin', ?, ?, ?, ?, ?)`).run(userId, role, name, email, bcrypt.hashSync(password, BCRYPT_ROUNDS), `ADMIN${crypto.randomInt(10000000, 99999999)}`);
  audit(req.user.id, 'create_admin', 'user', userId, { role });
  res.status(201).json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(userId)) });
});

app.patch('/api/admin/accounts/:id/role', auth, requireMaster, (req, res) => {
  const role = ['master_admin', 'license_renewal', 'public_verification'].includes(req.body.role) ? req.body.role : null;
  if (!role) return res.status(400).json({ error: 'Invalid administrator role.' });
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'You cannot change your own role.' });
  const result = db.prepare(`UPDATE users SET role = ? WHERE id = ? AND type = 'admin'`).run(role, req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Admin account not found.' });
  audit(req.user.id, 'change_admin_role', 'user', req.params.id, { role });
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)) });
});

app.post('/api/licenses', auth, requireLicenseAdmin, (req, res) => {
  const name = String(req.body.name || '').trim();
  const category = String(req.body.category || req.body.cat || 'Company Operational License').trim();
  const lga = String(req.body.lga || 'Makurdi').trim();
  const cac = String(req.body.cac || 'RC-PENDING').trim();
  if (!name || !lga) return res.status(400).json({ error: 'Business name and LGA are required.' });
  const licenseId = `BITDA-${new Date().getFullYear()}-${crypto.randomInt(1000, 9999)}`;
  const issueDate = today();
  const expiry = new Date();
  expiry.setFullYear(expiry.getFullYear() + 1);
  const expiryDate = expiry.toISOString().slice(0, 10);
  const barcode = `BTRCP-${name.replace(/[^A-Z]/gi, '').toUpperCase().slice(0, 4)}-${new Date().getFullYear()}`;
  const create = db.transaction(() => {
    db.prepare(`INSERT INTO licenses
      (id, company_name, lga, cac, status, issue_date, expiry_date, barcode)
      VALUES (?, ?, ?, ?, 'Active', ?, ?, ?)`).run(licenseId, name, lga, cac, issueDate, expiryDate, barcode);
    db.prepare(`INSERT INTO businesses (id, name, category, lga, fee, status, date, cac)
      VALUES (?, ?, ?, ?, 50000, 'Verified & Active', ?, ?)`).run(licenseId, name, category, lga, issueDate, cac);
    db.prepare(`INSERT INTO transactions (id, type, amount, date, lga, entity_id)
      VALUES (?, 'company_registration', 50000, ?, ?, ?)`).run(id('TX'), issueDate, lga, licenseId);
  });
  create();
  audit(req.user.id, 'create_license', 'license', licenseId);
  res.status(201).json({ license: licenseFromRow(db.prepare('SELECT * FROM licenses WHERE id = ?').get(licenseId)) });
});

app.post('/api/devices', auth, (req, res) => {
  const isCompany = req.user.type === 'company';
  if (!isCompany && req.user.type !== 'admin') return res.status(403).json({ error: 'Only companies and administrators can register devices.' });
  const companyId = isCompany ? req.user.id : (req.body.companyId || null);
  if (isCompany) {
    const license = db.prepare('SELECT l.*, u.device_suspended FROM licenses l LEFT JOIN users u ON u.id = l.company_id WHERE l.company_id = ?').get(req.user.id);
    if (!license || license.status !== 'Active' || (license.expiry_date && license.expiry_date < today()) || license.device_suspended) return res.status(403).json({ error: 'An active, unsuspended company license is required.' });
  }
  const model = String(req.body.model || '').trim();
  const category = String(req.body.category || req.body.cat || '').trim();
  const imei = String(req.body.imei || '').trim();
  const condition = req.body.condition === 'Used' ? 'Used' : 'Brand New';
  if (!model || !category || !imei) return res.status(400).json({ error: 'Model, category and IMEI/serial number are required.' });
  if (db.prepare('SELECT id FROM devices WHERE imei = ?').get(imei)) return res.status(409).json({ error: 'That IMEI/serial number is already registered.' });
  const owner = isCompany ? req.user.name : String(req.body.owner || '').trim();
  const company = companyId ? db.prepare('SELECT * FROM users WHERE id = ?').get(companyId) : null;
  const deviceId = id('DEV');
  db.prepare(`INSERT INTO devices
    (id, model, category, imei, id_type, condition, warranty_days, owner, company_id, company_name, status, reg_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Clean & Registered', ?)`).run(
    deviceId, model, category, imei, req.body.idType || (category.includes('Mobile') ? 'IMEI' : 'Serial Number'),
    condition, condition === 'Used' ? 14 : 365, owner, companyId, company ? company.name : owner, today()
  );
  db.prepare(`INSERT INTO transactions (id, type, amount, date, lga, entity_id) VALUES (?, 'device_registration', 1000, ?, ?, ?)`)
    .run(id('TX'), today(), company ? company.lga : 'Makurdi', deviceId);
  audit(req.user.id, 'register_device', 'device', deviceId);
  res.status(201).json({ device: deviceFromRow(db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId)) });
});

app.patch('/api/devices/:id/link', auth, (req, res) => {
  if (req.user.type !== 'company') return res.status(403).json({ error: 'Only the registering company can link this device.' });
  const customer = db.prepare(`SELECT * FROM users WHERE id = ? AND type = 'customer' AND nin = ?`).get(req.body.customerId, req.body.nin);
  const device = db.prepare('SELECT * FROM devices WHERE id = ? AND company_id = ?').get(req.params.id, req.user.id);
  if (!customer || !device) return res.status(404).json({ error: 'Device or verified customer was not found.' });
  const purchaseDate = String(req.body.purchaseDate || '');
  if (!purchaseDate) return res.status(400).json({ error: 'Purchase date is required.' });
  db.prepare('UPDATE devices SET linked_customer_id = ?, customer_name = ?, purchase_date = ? WHERE id = ?')
    .run(customer.id, customer.name, purchaseDate, device.id);
  audit(req.user.id, 'link_device', 'device', device.id, { customerId: customer.id });
  res.json({ device: deviceFromRow(db.prepare('SELECT * FROM devices WHERE id = ?').get(device.id)) });
});

app.patch('/api/devices/:id/unlink', auth, (req, res) => {
  const device = db.prepare('SELECT * FROM devices WHERE id = ? AND company_id = ?').get(req.params.id, req.user.id);
  if (!device) return res.status(404).json({ error: 'Device not found in your inventory.' });
  db.prepare('UPDATE devices SET linked_customer_id = NULL, customer_name = NULL, purchase_date = NULL WHERE id = ?').run(device.id);
  audit(req.user.id, 'unlink_device', 'device', device.id);
  res.json({ device: deviceFromRow(db.prepare('SELECT * FROM devices WHERE id = ?').get(device.id)) });
});

app.patch('/api/devices/:id/flag', auth, (req, res) => {
  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found.' });
  const allowed = req.user.type === 'admin' || req.user.id === device.linked_customer_id || req.user.id === device.company_id;
  if (!allowed) return res.status(403).json({ error: 'You cannot flag this device.' });
  db.prepare(`UPDATE devices SET status = 'FLAGGED STOLEN' WHERE id = ?`).run(device.id);
  db.prepare(`INSERT INTO complaints (id, type, reporter, target, date, status)
    VALUES (?, 'Stolen / Lost Device', ?, ?, ?, 'Blacklisted on CEIR')`)
    .run(id('TCK'), req.user.name, `IMEI ${device.imei}`, today());
  db.prepare(`INSERT INTO transactions (id, type, amount, date, lga, entity_id) VALUES (?, 'phone_tracking', 500000, ?, 'Makurdi', ?)`)
    .run(id('TX'), today(), device.id);
  audit(req.user.id, 'flag_device', 'device', device.id);
  res.json({ device: deviceFromRow(db.prepare('SELECT * FROM devices WHERE id = ?').get(device.id)) });
});

app.patch('/api/licenses/:id/activate', auth, requireLicenseAdmin, (req, res) => {
  const license = db.prepare('SELECT * FROM licenses WHERE id = ?').get(req.params.id);
  if (!license) return res.status(404).json({ error: 'License not found.' });
  const issueDate = today();
  const expiry = new Date();
  expiry.setFullYear(expiry.getFullYear() + 1);
  const expiryDate = expiry.toISOString().slice(0, 10);
  const barcode = `BTRCP-${license.company_name.replace(/[^A-Z]/gi, '').toUpperCase().slice(0, 4)}-${new Date().getFullYear()}`;
  db.prepare(`UPDATE licenses SET status = 'Active', issue_date = ?, expiry_date = ?, barcode = ? WHERE id = ?`)
    .run(issueDate, expiryDate, barcode, license.id);
  db.prepare(`INSERT INTO transactions (id, type, amount, date, lga, entity_id) VALUES (?, 'company_registration', 50000, ?, ?, ?)`)
    .run(id('TX'), issueDate, license.lga, license.id);
  audit(req.user.id, 'activate_license', 'license', license.id);
  res.json({ license: licenseFromRow(db.prepare('SELECT * FROM licenses WHERE id = ?').get(license.id)) });
});

app.patch('/api/licenses/:id/suspension', auth, requireLicenseAdmin, (req, res) => {
  const license = db.prepare('SELECT * FROM licenses WHERE id = ?').get(req.params.id);
  if (!license || !license.company_id) return res.status(404).json({ error: 'Company license not found.' });
  const suspended = Boolean(req.body.suspended);
  const reason = suspended ? String(req.body.reason || '').trim() : '';
  if (suspended && !reason) return res.status(400).json({ error: 'A suspension reason is required.' });
  const date = suspended ? today() : null;
  db.prepare('UPDATE users SET device_suspended = ?, suspension_reason = ?, suspension_date = ? WHERE id = ?')
    .run(suspended ? 1 : 0, reason, date, license.company_id);
  db.prepare('UPDATE licenses SET compliance_flagged = ?, flag_reason = ? WHERE id = ?')
    .run(suspended ? 1 : 0, reason, license.id);
  audit(req.user.id, suspended ? 'suspend_company' : 'restore_company', 'license', license.id, { reason });
  res.json({ license: licenseFromRow(db.prepare('SELECT * FROM licenses WHERE id = ?').get(license.id)) });
});

app.get('/api/public/verify', (req, res) => {
  const query = String(req.query.q || '').trim();
  if (!query) return res.status(400).json({ error: 'A license, company, IMEI or serial number is required.' });
  const device = db.prepare(`SELECT * FROM devices WHERE lower(imei) = lower(?) OR lower(id) = lower(?)`).get(query, query);
  if (device) return res.json({ kind: 'device', record: deviceFromRow(device), flagged: device.status !== 'Clean & Registered' });
  const license = db.prepare(`SELECT * FROM licenses WHERE lower(id) LIKE lower(?) OR lower(company_name) LIKE lower(?)`).get(`%${query}%`, `%${query}%`);
  if (license) {
    const company = license.company_id ? db.prepare('SELECT * FROM users WHERE id = ?').get(license.company_id) : null;
    const flagged = Boolean(license.compliance_flagged || (company && company.device_suspended));
    return res.json({ kind: 'license', record: licenseFromRow(license), flagged });
  }
  const business = db.prepare(`SELECT * FROM businesses WHERE lower(id) LIKE lower(?) OR lower(name) LIKE lower(?)`).get(`%${query}%`, `%${query}%`);
  if (business) return res.json({ kind: 'business', record: { id: business.id, name: business.name, cat: business.category, lga: business.lga, status: business.status, cac: business.cac }, flagged: business.status.includes('Flagged') });
  res.status(404).json({ error: 'No active record was found.' });
});

app.get(['/', '/index.html'], (_req, res) => res.sendFile(path.join(ROOT, 'index.html')));
app.get('/btrcp-app.js', (_req, res) => {
  res.type('application/javascript').sendFile(path.join(ROOT, 'btrcp-app.js'));
});
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(PORT, () => {
  if (process.env.NODE_ENV !== 'test') console.log(`BTRCP server listening on http://localhost:${PORT}`);
});

module.exports = { app, db };
