// ============ BTRCP APP LOGIC ============
/* global Chart, JsBarcode */
const LOGO_URL = 'https://media.base44.com/images/public/6a982bffaaaeb48d23873477/a85cf77ed_image.png';
const BENUE_LGAS = ["Makurdi","Gboko","Otukpo","Katsina-Ala","Ukum","Vandeikya","Agatu","Apa","Buruku","Obi","Ogbadigbo","Oju","Ohimini","Okpokwu","Ado","Konshisha","Kwande","Logo","Tarka","Guma","Gwer East","Gwer West","Ohaukwu"];
const COMPANY_DOC_FIELDS = [
    { key: 'cacCert', label: 'CAC Certificate of Incorporation' },
    { key: 'memart', label: 'Memorandum & Articles of Association (MEMART)' },
    { key: 'co7', label: 'CAC Status Report / Particulars of Directors (Form CO7)' },
    { key: 'vatCert', label: 'VAT Registration Certificate' },
    { key: 'tcc', label: 'Tax Clearance Certificate (TCC)' },
    { key: 'profile', label: 'Comprehensive Company Profile' },
    { key: 'proofAddress', label: 'Proof of Office Address' },
    { key: 'passport', label: 'Passport Photograph of Representative' }
];
const REVENUE_CATEGORIES = {
    device_registration: { label: 'Device Registration', color: '#D4AF37', amount: 1000 },
    company_registration: { label: 'Company Registration', color: '#006837', amount: 50000 },
    phone_tracking: { label: 'Phone Tracking (Penalties)', color: '#dc2626', amount: 500000 },
    license_renewal: { label: 'License Renewal', color: '#2563eb', amount: 50000 },
    device_transfer: { label: 'Device Transfer', color: '#7c3aed', amount: 2000 }
};

const STORE_KEYS = { accounts: 'btrcp_accounts', devices: 'btrcp_devices', businesses: 'btrcp_businesses', complaints: 'btrcp_complaints', session: 'btrcp_session', licenses: 'btrcp_licenses', transfers: 'btrcp_transfers', transactions: 'btrcp_transactions' };

function loadStore(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch(e) { return fallback; }
}
function saveStore(key, data) { try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) { console.warn('Storage full:', e.message); } }

function simpleHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
    return 'h' + Math.abs(h).toString(16);
}

// ============ NIN VERIFICATION ============
function validateNIN(nin) {
    if (!nin) return { valid: false, message: 'NIN is required.' };
    if (!/^\d{11}$/.test(nin)) return { valid: false, message: 'NIN must be exactly 11 digits.' };
    if (/^(\d)\1{10}$/.test(nin)) return { valid: false, message: 'Invalid NIN: all digits are identical.' };
    let sum = 0;
    for (let i = 0; i < 11; i++) { sum += parseInt(nin[i]) * ((i % 3) + 1); }
    if (sum % 10 === 0) return { valid: false, message: 'Invalid NIN: failed verification checksum.' };
    const exists = accounts.find(a => a.nin === nin);
    if (exists) return { valid: false, message: 'This NIN is already registered to another account.' };
    return { valid: true, message: 'NIN verified successfully.' };
}

function verifyNIN(inputId, statusId) {
    const nin = document.getElementById(inputId).value.trim();
    const status = document.getElementById(statusId);
    const result = validateNIN(nin);
    status.classList.remove('hidden');
    if (result.valid) {
        status.className = 'mt-1 p-2 rounded text-xs bg-emerald-50 border border-emerald-300 text-emerald-800';
        status.innerHTML = '<i class="fa-solid fa-circle-check"></i> ' + result.message;
    } else {
        status.className = 'mt-1 p-2 rounded text-xs bg-red-50 border border-red-300 text-red-700';
        status.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> ' + result.message;
    }
    return result.valid;
}

// ============ SEED DATA ============
let accounts = loadStore(STORE_KEYS.accounts, null);
if (!accounts) {
    accounts = [
        { id: 'ACC-001', type: 'admin', role: 'master_admin', name: 'BITDA Administrator', email: 'admin@bitda.gov', phone: '08000000000', password: simpleHash('admin123'), lga: 'Makurdi', cac: '', nin: '12345678901' },
        { id: 'ACC-002', type: 'company', name: 'Ultradigital Technologies Ltd', email: 'company@ultradigital.ng', phone: '08011112222', password: simpleHash('company123'), lga: 'Makurdi', cac: 'RC-184920', nin: '23456789012', representativeName: 'Terver Shija', documents: {} },
        { id: 'ACC-003', type: 'customer', name: 'John Demo', email: 'customer@demo.ng', phone: '08033334444', password: simpleHash('customer123'), lga: 'Makurdi', cac: '', nin: '34567890123' }
    ];
    saveStore(STORE_KEYS.accounts, accounts);
}
accounts.forEach(a => { if (a.type === 'admin' && !a.role) a.role = 'master_admin'; });
saveStore(STORE_KEYS.accounts, accounts);

let licenses = loadStore(STORE_KEYS.licenses, null);
if (!licenses) {
    licenses = [
        { id: 'BITDA-2026-1001', companyId: 'ACC-002', companyName: 'Ultradigital Technologies Ltd', lga: 'Makurdi', cac: 'RC-184920', status: 'Active', issueDate: '2026-01-15', expiryDate: '2027-01-15', barcode: 'BTRCP-ULTR-2026', representativeName: 'Terver Shija', documents: {} },
        { id: 'BITDA-2026-1002', companyId: null, companyName: 'Benue Gadgets & Telecom Systems', lga: 'Gboko', cac: 'RC-928104', status: 'Active', issueDate: '2026-02-10', expiryDate: '2027-02-10', barcode: 'BTRCP-BGTS-2026', representativeName: '', documents: {} },
        { id: 'BITDA-2026-1003', companyId: null, companyName: 'Food Basket Electronics', lga: 'Otukpo', cac: 'BN-304918', status: 'Active', issueDate: '2026-02-18', expiryDate: '2027-02-18', barcode: 'BTRCP-FOOD-2026', representativeName: '', documents: {} },
        { id: 'BITDA-2026-1004', companyId: null, companyName: 'Katsina-Ala Tech Hub', lga: 'Katsina-Ala', cac: 'RC-402911', status: 'Pending Activation', issueDate: null, expiryDate: null, barcode: null, representativeName: '', documents: {} }
    ];
    saveStore(STORE_KEYS.licenses, licenses);
}

let businesses = loadStore(STORE_KEYS.businesses, [
    { id: "BITDA-2026-1001", name: "Ultradigital Technologies Ltd", cat: "Company Operational License", lga: "Makurdi", fee: 50000, status: "Verified & Active", date: "2026-01-15", cac: "RC-184920" },
    { id: "BITDA-2026-1002", name: "Benue Gadgets & Telecom Systems", cat: "Company Operational License", lga: "Gboko", fee: 50000, status: "Verified & Active", date: "2026-02-10", cac: "RC-928104" },
    { id: "BITDA-2026-1003", name: "Food Basket Electronics", cat: "Individual Operator License", lga: "Otukpo", fee: 50000, status: "Verified & Active", date: "2026-02-18", cac: "BN-304918" },
    { id: "BITDA-2026-1004", name: "Katsina-Ala Tech Hub", cat: "Company Operational License", lga: "Katsina-Ala", fee: 50000, status: "Pending Audit", date: "2026-03-01", cac: "RC-402911" },
    { id: "BITDA-2026-1005", name: "Apex Micro Hardware Dealers", cat: "OEM Partner Cert", lga: "Makurdi", fee: 500000, status: "Substandard Penalty Flagged", date: "2026-03-05", cac: "RC-102948" }
]);
saveStore(STORE_KEYS.businesses, businesses);

let devices = loadStore(STORE_KEYS.devices, [
    { id: "DEV-88210", model: "Samsung Galaxy S23 Ultra", cat: "Mobile Phone", imei: "358910112233445", idType: "IMEI", owner: "Benue Gadgets Hub", companyId: "ACC-002", companyName: "Ultradigital Technologies Ltd", linkedCustomerId: null, customerName: null, purchaseDate: null, status: "Clean & Registered", regDate: "2026-01-20", fee: 1000, transferHistory: [] },
    { id: "DEV-88211", model: "Dell Latitude 5420 Laptop", cat: "Laptop / Computer", imei: "SN-DL90128401", idType: "Serial Number", owner: "Ultradigital Ltd", companyId: "ACC-002", companyName: "Ultradigital Technologies Ltd", linkedCustomerId: "ACC-003", customerName: "John Demo", purchaseDate: "2026-02-15", status: "Clean & Registered", regDate: "2026-01-22", fee: 1000, transferHistory: [] },
    { id: "DEV-88212", model: "Mikrotik Cloud Router", cat: "Networking", imei: "354920192019283", idType: "IMEI", owner: "Food Basket Electronics", companyId: null, companyName: "Food Basket Electronics", linkedCustomerId: null, customerName: null, purchaseDate: null, status: "Clean & Registered", regDate: "2026-02-01", fee: 1000, transferHistory: [] },
    { id: "DEV-88213", model: "iPhone 14 Pro Max", cat: "Mobile Phone", imei: "351029384756102", idType: "IMEI", owner: "Private Citizen", companyId: null, companyName: "Benue Gadgets Hub", linkedCustomerId: "ACC-003", customerName: "John Demo", purchaseDate: "2026-01-10", status: "FLAGGED STOLEN", regDate: "2026-01-05", fee: 1000, transferHistory: [] }
]);
saveStore(STORE_KEYS.devices, devices);

let complaints = loadStore(STORE_KEYS.complaints, [
    { id: "TCK-901", type: "Substandard Product Sold", reporter: "Terrence Suswam", target: "Apex Micro Hardware Dealers", date: "2026-02-20", status: "Penalty ₦500k Issued" },
    { id: "TCK-902", type: "Stolen / Lost Device", reporter: "Amina Ibrahim", target: "IMEI 351029384756102", date: "2026-02-28", status: "Blacklisted on CEIR" }
]);
saveStore(STORE_KEYS.complaints, complaints);

let transfers = loadStore(STORE_KEYS.transfers, []);
saveStore(STORE_KEYS.transfers, transfers);

let transactions = loadStore(STORE_KEYS.transactions, null);
if (!transactions) {
    transactions = [];
    businesses.forEach(b => { if (b.date) transactions.push({ id: 'TX-' + Math.floor(Math.random()*1000000), type: 'company_registration', amount: b.fee, date: b.date, lga: b.lga, entityId: b.id }); });
    devices.forEach(d => { if (d.regDate) transactions.push({ id: 'TX-' + Math.floor(Math.random()*1000000), type: 'device_registration', amount: 1000, date: d.regDate, lga: 'Makurdi', entityId: d.id }); });
    complaints.forEach(c => { if (c.status.includes('Penalty')) transactions.push({ id: 'TX-' + Math.floor(Math.random()*1000000), type: 'phone_tracking', amount: 500000, date: c.date, lga: 'Makurdi', entityId: c.id }); });
    saveStore(STORE_KEYS.transactions, transactions);
}

let session = loadStore(STORE_KEYS.session, null);
let currentUser = null;
let charts = {};
let pendingTransferDeviceId = null;
let verifiedTransferRecipient = null;
let pendingPaymentCallback = null;
let pendingRenewalLicenseId = null;
let verifiedLinkCustomer = null;
let renewalTccData = null;
const uploadedDocs = {};

// ============ POPULATE LGA SELECTS ============
function populateLGAs() {
    const selects = ['reg-lga','form-biz-lga','bizLgaFilter','analyticsLgaFilter'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const current = el.value;
        const placeholder = (id === 'bizLgaFilter' || id === 'analyticsLgaFilter') ? '<option value="">All LGAs</option>' : '';
        el.innerHTML = placeholder + BENUE_LGAS.map(l => `<option value="${l}">${l}</option>`).join('');
        if (current) el.value = current;
    });
}

// ============ COMPANY DOC UPLOAD FIELDS ============
function buildCompanyDocFields() {
    const container = document.getElementById('companyDocsContainer');
    if (!container) return;
    container.innerHTML = COMPANY_DOC_FIELDS.map(d => `
        <div>
            <label class="font-semibold text-gray-700 text-[11px]">${d.label}</label>
            <input type="file" id="reg-doc-${d.key}" accept="image/*,.pdf" class="w-full mt-0.5 p-1.5 border rounded text-[11px]" onchange="handleDocUpload('${d.key}', this)">
            <div id="reg-doc-status-${d.key}" class="hidden text-[10px] mt-0.5"></div>
        </div>
    `).join('');
}

function handleDocUpload(key, input) {
    const file = input.files[0];
    const status = document.getElementById('reg-doc-status-' + key);
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
        status.className = 'text-[10px] mt-0.5 text-red-600';
        status.textContent = 'File too large (max 2MB). Please use a smaller image.';
        status.classList.remove('hidden');
        input.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        uploadedDocs[key] = e.target.result;
        status.className = 'text-[10px] mt-0.5 text-emerald-600';
        status.innerHTML = '<i class="fa-solid fa-check"></i> ' + file.name + ' uploaded';
        status.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

// ============ AUTH ============
function switchAuthTab(tab) {
    ['login','register'].forEach(t => {
        document.getElementById('authTab-'+t).classList.toggle('text-benueGreen', t===tab);
        document.getElementById('authTab-'+t).classList.toggle('border-benueGreen', t===tab);
        document.getElementById('authTab-'+t).classList.toggle('text-gray-400', t!==tab);
        document.getElementById('authTab-'+t).classList.toggle('border-transparent', t!==tab);
    });
    document.getElementById('authLogin').classList.toggle('hidden', tab!=='login');
    document.getElementById('authRegister').classList.toggle('hidden', tab!=='register');
}

document.querySelectorAll('input[name="reg-type"]').forEach(r => {
    r.addEventListener('change', e => { document.getElementById('reg-company-fields').classList.toggle('hidden', e.target.value !== 'company'); });
});

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;
    const errBox = document.getElementById('loginError');
    errBox.classList.add('hidden');
    const user = accounts.find(a => a.email.toLowerCase() === email && a.password === simpleHash(password));
    if (!user) { errBox.textContent = 'Invalid email or password. Please try again.'; errBox.classList.remove('hidden'); return; }
    session = { id: user.id, ts: Date.now() };
    saveStore(STORE_KEYS.session, session);
    initApp();
}

function showResult(id, message, good) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'p-2 rounded text-xs ' + (good ? 'bg-emerald-50 border border-emerald-300 text-emerald-800' : 'bg-red-50 border border-red-300 text-red-700');
    el.textContent = message;
    el.classList.remove('hidden');
}

function handlePasswordChange(e) {
    e.preventDefault();
    const current = document.getElementById('settings-current-password').value;
    const next = document.getElementById('settings-new-password').value;
    const confirmPassword = document.getElementById('settings-confirm-password').value;
    if (currentUser.password !== simpleHash(current)) return showResult('settingsResult', 'Current password is incorrect.', false);
    if (next !== confirmPassword) return showResult('settingsResult', 'New passwords do not match.', false);
    currentUser.password = simpleHash(next);
    saveStore(STORE_KEYS.accounts, accounts);
    document.getElementById('settings-current-password').value = '';
    document.getElementById('settings-new-password').value = '';
    document.getElementById('settings-confirm-password').value = '';
    showResult('settingsResult', 'Password changed successfully.', true);
}

function handlePasswordRecovery(e) {
    e.preventDefault();
    const email = document.getElementById('recovery-email').value.trim().toLowerCase();
    const phone = document.getElementById('recovery-phone').value.trim();
    const next = document.getElementById('recovery-new-password').value;
    const user = accounts.find(a => a.email.toLowerCase() === email && a.phone === phone);
    if (!user) return showResult('recoveryResult', 'Email and phone number do not match an account.', false);
    user.password = simpleHash(next);
    saveStore(STORE_KEYS.accounts, accounts);
    showResult('recoveryResult', 'Password reset successfully. You can now sign in.', true);
}

function handleRegister(e) {
    e.preventDefault();
    const errBox = document.getElementById('regError');
    errBox.classList.add('hidden');
    const nin = document.getElementById('reg-nin').value.trim();
    const ninResult = validateNIN(nin);
    if (!ninResult.valid) {
        errBox.textContent = ninResult.message + ' Registration cannot proceed.';
        errBox.classList.remove('hidden');
        verifyNIN('reg-nin','regNinStatus');
        return;
    }
    const type = document.querySelector('input[name="reg-type"]:checked').value;
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const phone = document.getElementById('reg-phone').value.trim();
    const password = document.getElementById('reg-password').value;
    const password2 = document.getElementById('reg-password2').value;
    if (password !== password2) { errBox.textContent = 'Passwords do not match.'; errBox.classList.remove('hidden'); return; }
    if (accounts.find(a => a.email.toLowerCase() === email)) { errBox.textContent = 'An account with this email already exists.'; errBox.classList.remove('hidden'); return; }
    const newId = 'ACC-' + Math.floor(100 + Math.random()*9000);
    let newAcc = { id: newId, type, name, email, phone, password: simpleHash(password), nin };
    if (type === 'company') {
        const cac = document.getElementById('reg-cac').value.trim() || 'RC-PENDING';
        const lga = document.getElementById('reg-lga').value;
        const repName = document.getElementById('reg-rep-name').value.trim();
        const missingDocs = COMPANY_DOC_FIELDS.filter(d => !uploadedDocs[d.key]);
        if (missingDocs.length > 0) { errBox.textContent = 'Please upload all required company documents: ' + missingDocs.map(d => d.label).join(', '); errBox.classList.remove('hidden'); return; }
        if (!repName) { errBox.textContent = 'Company representative name is required.'; errBox.classList.remove('hidden'); return; }
        newAcc.cac = cac; newAcc.lga = lga; newAcc.representativeName = repName; newAcc.documents = { ...uploadedDocs };
        const licenseId = `BITDA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        licenses.push({ id: licenseId, companyId: newId, companyName: name, lga, cac, status: 'Pending Activation', issueDate: null, expiryDate: null, barcode: null, representativeName: repName, documents: { ...uploadedDocs } });
        saveStore(STORE_KEYS.licenses, licenses);
    } else {
        newAcc.lga = 'Makurdi'; newAcc.cac = '';
    }
    accounts.push(newAcc);
    saveStore(STORE_KEYS.accounts, accounts);
    session = { id: newId, ts: Date.now() };
    saveStore(STORE_KEYS.session, session);
    Object.keys(uploadedDocs).forEach(k => delete uploadedDocs[k]);
    initApp();
}

function logout() {
    session = null; currentUser = null;
    localStorage.removeItem(STORE_KEYS.session);
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('login-password').value = '';
}

// ============ APP INIT ============
function initApp() {
    if (!session || !session.id) { showAuth(); return; }
    currentUser = accounts.find(a => a.id === session.id);
    if (!currentUser) { showAuth(); return; }
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('flex');
    document.getElementById('userNameLabel').textContent = currentUser.name;
    document.getElementById('userRoleLabel').textContent = currentUser.type.charAt(0).toUpperCase() + currentUser.type.slice(1);
    document.getElementById('userAvatarIcon').className = currentUser.type === 'company' ? 'fa-solid fa-building text-white text-sm' : currentUser.type === 'admin' ? 'fa-solid fa-shield-halved text-white text-sm' : 'fa-solid fa-user text-white text-sm';
    buildNav();
    renderAll();
    if (currentUser.type === 'customer') switchTab('customer');
    else if (currentUser.type === 'company') switchTab('company');
    else switchTab('dashboard');
}

function showAuth() {
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
}

function buildNav() {
    const nav = document.getElementById('navBar');
    let tabs = [];
    if (currentUser.type === 'admin') {
        tabs = currentUser.role === 'master_admin' ? [
            { id: 'dashboard', icon: 'chart-line', label: 'Dashboard & Analytics' },
            { id: 'licenses', icon: 'id-card', label: 'License Activation' },
            { id: 'licensing', icon: 'id-badge', label: 'Tier 1: Business Licensing' },
            { id: 'device', icon: 'mobile-screen-button', label: 'Tier 2: Device Registry' },
            { id: 'protection', icon: 'user-shield', label: 'Tier 3: Quality & Consumer Protection' },
            { id: 'verifier', icon: 'magnifying-glass', label: 'Public Verification Desk' },
            { id: 'proposal', icon: 'file-contract', label: 'Framework Blueprint' }
        ] : currentUser.role === 'license_renewal' ? [
            { id: 'licenses', icon: 'id-card', label: 'License Renewal Desk' }
        ] : [
            { id: 'verifier', icon: 'magnifying-glass', label: 'Public Verification Desk' }
        ];
        if (currentUser.role === 'master_admin') tabs.push({ id: 'admin', icon: 'user-shield', label: 'Admin Accounts' });
    } else if (currentUser.type === 'company') {
        tabs = [ { id: 'company', icon: 'building', label: 'Company Portal' }, { id: 'verifier', icon: 'magnifying-glass', label: 'Public Verification Desk' } ];
    } else {
        tabs = [ { id: 'customer', icon: 'user', label: 'My Devices' }, { id: 'warranty', icon: 'shield-halved', label: 'Device Warranty' }, { id: 'transfers', icon: 'right-left', label: 'Transfer History' }, { id: 'verifier', icon: 'magnifying-glass', label: 'Public Verification Desk' } ];
    }
    tabs.push({ id: 'settings', icon: 'gear', label: 'Account Settings' });
    nav.innerHTML = tabs.map((t, i) => `<button onclick="switchTab('${t.id}')" id="tab-${t.id}" class="tab-btn ${i===0?'active-tab':''} px-4 py-3 ${i===0?'':'text-gray-600 hover:text-benueGreen'} flex items-center gap-2 whitespace-nowrap transition"><i class="fa-solid fa-${t.icon}"></i> ${t.label}</button>`).join('');
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => { btn.classList.remove('active-tab'); btn.classList.add('text-gray-600'); });
    const tabBtn = document.getElementById('tab-' + tabId);
    if (tabBtn) { tabBtn.classList.add('active-tab'); tabBtn.classList.remove('text-gray-600'); }
    const allViews = ['dashboard','licenses','licensing','device','protection','verifier','proposal','admin','company','customer','warranty','transfers'];
    allViews.forEach(v => { const el = document.getElementById('view-' + v); if (el) el.classList.add('hidden'); });
    const target = document.getElementById('view-' + tabId);
    if (target) target.classList.remove('hidden');
    if (tabId === 'company') renderCompanyPortal();
    if (tabId === 'customer') renderCustomerPortal();
    if (tabId === 'warranty') renderWarrantyPortal();
    if (tabId === 'transfers') renderTransferHistory();
    if (tabId === 'dashboard') renderAnalytics();
    if (tabId === 'licenses') {
        if (!canAdmin('license_renewal')) return;
        renderLicenseManagement();
    }
    if (tabId === 'admin') renderAdminAccounts();
    if (tabId === 'settings') openModal('settingsModal');
}

function handleCreateAdmin(e) {
    e.preventDefault();
    if (!currentUser || currentUser.role !== 'master_admin') { alert('Only the master admin can create admin accounts.'); return; }
    const email = document.getElementById('admin-email').value.trim().toLowerCase();
    if (accounts.some(a => a.email.toLowerCase() === email)) { alert('An account with this email already exists.'); return; }
    accounts.push({
        id: 'ACC-' + Math.floor(100 + Math.random() * 9000),
        type: 'admin',
        role: document.getElementById('admin-role').value,
        name: document.getElementById('admin-name').value.trim(),
        email,
        phone: '',
        password: simpleHash(document.getElementById('admin-password').value),
        lga: 'Makurdi',
        cac: ''
    });
    saveStore(STORE_KEYS.accounts, accounts);
    e.target.reset();
    renderAdminAccounts();
    alert('Admin account created successfully.');
}

function renderAdminAccounts() {
    const list = document.getElementById('adminAccountList');
    if (!list || currentUser.role !== 'master_admin') return;
    list.innerHTML = accounts.filter(a => a.type === 'admin').map(a => `<div class="flex justify-between items-center border rounded p-3 text-xs"><span><strong>${a.name}</strong><br><span class="text-gray-500">${a.email}</span></span><select onchange="updateAdminRole('${a.id}', this.value)" class="p-1 border rounded" ${a.id === currentUser.id ? 'disabled' : ''}><option value="master_admin" ${a.role === 'master_admin' ? 'selected' : ''}>Master Admin</option><option value="license_renewal" ${a.role === 'license_renewal' ? 'selected' : ''}>License Renewal</option><option value="public_verification" ${a.role === 'public_verification' ? 'selected' : ''}>Public Verification Desk</option></select></div>`).join('');
}

function updateAdminRole(id, role) {
    if (!currentUser || currentUser.role !== 'master_admin') return;
    const admin = accounts.find(a => a.id === id);
    if (!admin || admin.id === currentUser.id) return;
    admin.role = role;
    saveStore(STORE_KEYS.accounts, accounts);
    renderAdminAccounts();
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); document.getElementById(id).classList.add('flex'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); document.getElementById(id).classList.remove('flex'); }

// ============ LICENSE HELPERS ============
function getCompanyLicense(companyId) { return licenses.find(l => l.companyId === companyId); }

function canAdmin(action) {
    return currentUser && currentUser.type === 'admin' && (currentUser.role === 'master_admin' || currentUser.role === action);
}

function isLicenseActive(companyId) {
    const lic = getCompanyLicense(companyId);
    if (!lic || lic.status !== 'Active') return { active: false, reason: 'No active license. Your license must be activated by BITDA before you can register or link devices.' };
    const company = accounts.find(a => a.id === companyId);
    if (company && company.deviceSuspended) return { active: false, reason: 'Device operations are suspended by BITDA for compliance violation: ' + (company.suspensionReason || 'rules violation') + '.' };
    const now = new Date();
    if (lic.expiryDate && new Date(lic.expiryDate) < now) return { active: false, reason: 'Your license expired on ' + lic.expiryDate + '. Please renew to continue.' };
    return { active: true, license: lic };
}

function companyGuardedAction(action) {
    const check = isLicenseActive(currentUser.id);
    if (!check.active) { alert('Action blocked: ' + check.reason); return; }
    if (action === 'register') openModal('companyDeviceModal');
    if (action === 'link') { openModal('linkDeviceModal'); populateLinkModal(); }
}

function setCompanySuspension(companyId, suspended) {
    if (!canAdmin('license_renewal')) { alert('Only an authorized license administrator can change company enforcement status.'); return; }
    const company = accounts.find(a => a.id === companyId);
    if (!company) return;
    if (suspended) {
        const reason = prompt('Enter the violation reason:');
        if (!reason) return;
        company.deviceSuspended = true;
        company.suspensionReason = reason;
        company.suspensionDate = new Date().toISOString().split('T')[0];
        const lic = getCompanyLicense(companyId);
        if (lic) { lic.complianceFlagged = true; lic.flagReason = reason; }
    } else {
        company.deviceSuspended = false;
        company.suspensionReason = '';
        company.suspensionDate = null;
        const lic = getCompanyLicense(companyId);
        if (lic) { lic.complianceFlagged = false; lic.flagReason = ''; }
    }
    saveStore(STORE_KEYS.accounts, accounts);
    saveStore(STORE_KEYS.licenses, licenses);
    renderLicenseManagement();
    alert(suspended ? 'Company device registration and linking have been suspended.' : 'Company device operations have been restored.');
}

// ============ REVENUE CALCULATOR ============
function calculateRevenue() {
    const ops = parseInt(document.getElementById('calc-ops').value) || 0;
    const devs = parseInt(document.getElementById('calc-devs').value) || 0;
    const pen = parseInt(document.getElementById('calc-pen').value) || 0;
    const total = (ops * 50000) + (devs * 1000) + (pen * 500000);
    document.getElementById('calc-total').innerText = '₦' + total.toLocaleString();
}

// ============ RENDER FUNCTIONS ============
function renderAll() { renderLGATable(); renderBusinesses(); renderDevices(); renderComplaints(); calculateRevenue(); }

function renderLGATable() {
    const body = document.getElementById('lgaTableBody');
    if (!body) return;
    body.innerHTML = BENUE_LGAS.map(lga => {
        const lgaLicenses = licenses.filter(l => l.lga === lga);
        const lgaDevices = devices.filter(d => { const lic = licenses.find(l => l.companyName === d.companyName); return lic && lic.lga === lga; });
        const lgaRev = transactions.filter(t => t.lga === lga).reduce((s,t) => s + t.amount, 0);
        const active = lgaLicenses.some(l => l.status === 'Active');
        return `<tr class="hover:bg-slate-50"><td class="p-2.5 font-semibold text-gray-800">${lga}</td><td class="p-2.5">${lgaLicenses.length}</td><td class="p-2.5">${lgaDevices.length}</td><td class="p-2.5 font-semibold text-emerald-600">₦${lgaRev.toLocaleString()}</td><td class="p-2.5"><span class="${active?'bg-emerald-100 text-emerald-800':'bg-slate-100 text-slate-600'} text-[10px] font-bold px-2 py-0.5 rounded">${active?'Active Audit':'No Activity'}</span></td></tr>`;
    }).join('');
}

function renderBusinesses() {
    const body = document.getElementById('businessTableBody');
    if (!body) return;
    body.innerHTML = businesses.map(b => bizRow(b)).join('');
}

function bizRow(b) {
    return `<tr class="hover:bg-slate-50"><td class="p-3 font-mono text-benueGreen font-bold">${b.id}</td><td class="p-3 font-semibold text-gray-800">${b.name}<br><span class="text-[10px] text-gray-400">CAC: ${b.cac}</span></td><td class="p-3">${b.cat}</td><td class="p-3">${b.lga}</td><td class="p-3 font-semibold text-emerald-600">₦${b.fee.toLocaleString()}</td><td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${b.status.includes('Verified')?'bg-emerald-100 text-emerald-800':b.status.includes('Penalty')?'bg-red-100 text-red-800':'bg-amber-100 text-amber-800'}">${b.status}</span></td><td class="p-3"><button onclick="viewCertificate('${b.id}')" class="text-benueGreen hover:underline font-bold text-[11px]"><i class="fa-solid fa-certificate"></i> View Cert</button></td></tr>`;
}

function renderDevices() {
    const body = document.getElementById('deviceTableBody');
    if (!body) return;
    body.innerHTML = devices.map(d => `<tr class="hover:bg-slate-50"><td class="p-3 font-mono font-bold text-gray-600">${d.id}</td><td class="p-3 font-semibold text-gray-800">${d.model}</td><td class="p-3">${d.cat}</td><td class="p-3 font-mono text-xs">${d.imei} <span class="text-[9px] text-gray-400">(${d.idType||'IMEI'})</span></td><td class="p-3">${d.owner}</td><td class="p-3">${d.customerName ? `<span class="text-emerald-700 font-semibold">${d.customerName}</span><br><span class="text-[10px] text-gray-400">${d.purchaseDate||''}</span>` : '<span class="text-gray-400">— Unlinked —</span>'}</td><td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${d.status.includes('Clean')?'bg-blue-100 text-blue-800':'bg-red-100 text-red-800 animate-pulse'}">${d.status}</span></td><td class="p-3"><button onclick="flagDevice('${d.imei}')" class="text-xs text-red-600 hover:underline">Flag Stolen</button></td></tr>`).join('');
}

function renderComplaints() {
    const body = document.getElementById('complaintsTableBody');
    if (!body) return;
    body.innerHTML = complaints.map(c => `<tr class="hover:bg-slate-50"><td class="p-3 font-mono font-bold text-slate-700">${c.id}</td><td class="p-3 font-semibold">${c.type}</td><td class="p-3">${c.reporter}</td><td class="p-3 font-semibold text-gray-800">${c.target}</td><td class="p-3">${c.date}</td><td class="p-3"><span class="bg-red-100 text-red-800 px-2 py-0.5 rounded font-bold text-[10px]">${c.status}</span></td></tr>`).join('');
}

// ============ LICENSE MANAGEMENT ============
function renderLicenseManagement() {
    const pending = licenses.filter(l => l.status === 'Pending Activation');
    const active = licenses.filter(l => l.status === 'Active' && (!l.expiryDate || new Date(l.expiryDate) >= new Date()));
    const expired = licenses.filter(l => l.status === 'Active' && l.expiryDate && new Date(l.expiryDate) < new Date());
    document.getElementById('lic-pending-count').textContent = pending.length;
    document.getElementById('lic-active-count').textContent = active.length;
    document.getElementById('lic-expired-count').textContent = expired.length;
    const renewalRev = transactions.filter(t => t.type === 'license_renewal').reduce((s,t)=>s+t.amount,0);
    document.getElementById('lic-renewal-revenue').textContent = '₦' + renewalRev.toLocaleString();
    const body = document.getElementById('licenseTableBody');
    body.innerHTML = licenses.map(l => {
        const company = accounts.find(a => a.id === l.companyId);
        const suspended = company && company.deviceSuspended;
        const statusBadge = l.status === 'Active' ? (l.expiryDate && new Date(l.expiryDate) < new Date() ? `<span class="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded">EXPIRED</span>` : `<span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">ACTIVE</span>`) : `<span class="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded">PENDING</span>`;
        const docCount = l.documents ? Object.keys(l.documents).length : 0;
        const actionBtn = l.status === 'Pending Activation' ? `<button onclick="activateLicense('${l.id}')" class="text-benueGreen hover:underline font-bold text-[11px]"><i class="fa-solid fa-check-circle"></i> Activate</button>` : (l.expiryDate && new Date(l.expiryDate) < new Date() ? `<button onclick="openRenewalModal('${l.id}')" class="text-amber-600 hover:underline font-bold text-[11px]"><i class="fa-solid fa-rotate"></i> Renew</button>` : `<button onclick="viewCertificate('${l.id}')" class="text-benueGreen hover:underline font-bold text-[11px]"><i class="fa-solid fa-certificate"></i> Cert</button>`);
        const enforcementBtn = company ? `<button onclick="setCompanySuspension('${company.id}', ${!suspended})" class="${suspended ? 'text-emerald-600' : 'text-red-600'} hover:underline font-bold text-[11px]">${suspended ? 'Restore Devices' : 'Suspend Devices'}</button>` : '';
        const enforcementBadge = suspended ? `<span class="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded block mt-1">DEVICE OPERATIONS SUSPENDED</span>` : '';
        return `<tr class="hover:bg-slate-50"><td class="p-3 font-mono text-benueGreen font-bold">${l.id}</td><td class="p-3 font-semibold text-gray-800">${l.companyName}${l.representativeName?`<br><span class="text-[10px] text-gray-400">Rep: ${l.representativeName}</span>`:''}${enforcementBadge}</td><td class="p-3">${l.lga}</td><td class="p-3">${docCount > 0 ? `<button onclick="viewDocuments('${l.id}')" class="text-blue-600 hover:underline font-bold text-[11px]"><i class="fa-solid fa-folder-open"></i> ${docCount} docs</button>` : '<span class="text-gray-400">—</span>'}</td><td class="p-3">${l.issueDate || '—'}</td><td class="p-3">${l.expiryDate || '—'}</td><td class="p-3">${statusBadge}</td><td class="p-3">${actionBtn}<br>${enforcementBtn}</td></tr>`;
    }).join('');
}

function activateLicense(licenseId) {
    const lic = licenses.find(l => l.id === licenseId);
    if (!lic) return;
    const now = new Date();
    const issueDate = now.toISOString().split('T')[0];
    const expiry = new Date(now);
    expiry.setFullYear(expiry.getFullYear() + 1);
    expiry.setMonth(0); expiry.setDate(15);
    if (expiry <= now) expiry.setFullYear(expiry.getFullYear() + 1);
    const expiryDate = expiry.toISOString().split('T')[0];
    lic.status = 'Active'; lic.issueDate = issueDate; lic.expiryDate = expiryDate;
    lic.barcode = 'BTRCP-' + lic.companyName.replace(/[^A-Z]/gi,'').toUpperCase().slice(0,4) + '-' + now.getFullYear();
    saveStore(STORE_KEYS.licenses, licenses);
    transactions.push({ id: 'TX-' + Math.floor(Math.random()*1000000), type: 'company_registration', amount: 50000, date: issueDate, lga: lic.lga, entityId: lic.id });
    saveStore(STORE_KEYS.transactions, transactions);
    renderLicenseManagement();
    alert('License ' + licenseId + ' activated successfully! Valid until ' + expiryDate + '.');
}

function openRenewalModal(licenseId) {
    pendingRenewalLicenseId = licenseId;
    const lic = licenses.find(l => l.id === licenseId);
    if (!lic) return;
    document.getElementById('renewalLicenseInfo').innerHTML = `<span class="text-[10px] text-gray-500 uppercase block">License</span><span class="font-bold text-gray-900">${lic.companyName}</span><span class="text-[10px] text-gray-500 block mt-1">Current Expiry: ${lic.expiryDate || '—'}</span>`;
    document.getElementById('renewal-tcc').value = '';
    document.getElementById('renewalTccStatus').classList.add('hidden');
    document.getElementById('renewalPayBtn').disabled = true;
    renewalTccData = null;
    openModal('renewalModal');
}

document.addEventListener('change', function(e) {
    if (e.target && e.target.id === 'renewal-tcc') {
        const file = e.target.files[0];
        const status = document.getElementById('renewalTccStatus');
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { status.className = 'mt-1 p-2 rounded text-xs bg-red-50 border border-red-300 text-red-700'; status.textContent = 'File too large (max 2MB).'; status.classList.remove('hidden'); e.target.value = ''; return; }
        const reader = new FileReader();
        reader.onload = function(ev) {
            renewalTccData = ev.target.result;
            status.className = 'mt-1 p-2 rounded text-xs bg-emerald-50 border border-emerald-300 text-emerald-800';
            status.innerHTML = '<i class="fa-solid fa-check"></i> ' + file.name + ' uploaded. You can now proceed to payment.';
            status.classList.remove('hidden');
            document.getElementById('renewalPayBtn').disabled = false;
        };
        reader.readAsDataURL(file);
    }
});

function proceedRenewalPayment() {
    if (!renewalTccData) { alert('Please upload your Tax Clearance Certificate first.'); return; }
    closeModal('renewalModal');
    pendingPaymentCallback = function() {
        const lic = licenses.find(l => l.id === pendingRenewalLicenseId);
        if (!lic) return;
        const currentExpiry = lic.expiryDate ? new Date(lic.expiryDate) : new Date();
        const newExpiry = new Date(currentExpiry);
        newExpiry.setFullYear(newExpiry.getFullYear() + 1);
        lic.expiryDate = newExpiry.toISOString().split('T')[0];
        lic.status = 'Active';
        if (!lic.documents) lic.documents = {};
        lic.documents.tcc = renewalTccData;
        saveStore(STORE_KEYS.licenses, licenses);
        transactions.push({ id: 'TX-' + Math.floor(Math.random()*1000000), type: 'license_renewal', amount: 50000, date: new Date().toISOString().split('T')[0], lga: lic.lga, entityId: lic.id });
        saveStore(STORE_KEYS.transactions, transactions);
        renewalTccData = null;
        renderLicenseManagement();
        alert('License renewed successfully! New expiry date: ' + lic.expiryDate);
    };
    openPaymentModal(50000, 'License Renewal');
}

function viewDocuments(licenseId) {
    const lic = licenses.find(l => l.id === licenseId);
    if (!lic || !lic.documents) return;
    document.getElementById('docViewerTitle').textContent = lic.companyName + ' — Uploaded Documents';
    const body = document.getElementById('docViewerBody');
    body.innerHTML = COMPANY_DOC_FIELDS.map(f => {
        const data = lic.documents[f.key];
        if (!data) return `<div class="p-2 border rounded text-gray-400">${f.label}: Not uploaded</div>`;
        if (data.startsWith('data:image')) return `<div class="border rounded overflow-hidden"><div class="bg-slate-100 p-1.5 font-semibold text-[10px]">${f.label}</div><img src="${data}" class="w-full h-32 object-contain bg-gray-50"></div>`;
        return `<div class="border rounded p-2"><div class="font-semibold text-[10px] mb-1">${f.label}</div><a href="${data}" download="${f.key}" class="text-blue-600 hover:underline text-[10px]"><i class="fa-solid fa-download"></i> Download</a></div>`;
    }).join('');
    openModal('docViewerModal');
}

// ============ ANALYTICS ============
function getAnalyticsFilters() {
    const year = document.getElementById('analyticsYearFilter') ? document.getElementById('analyticsYearFilter').value : '';
    const month = document.getElementById('analyticsMonthFilter') ? document.getElementById('analyticsMonthFilter').value : '';
    const lga = document.getElementById('analyticsLgaFilter') ? document.getElementById('analyticsLgaFilter').value : '';
    return { year, month, lga };
}

function resetAnalyticsFilters() {
    document.getElementById('analyticsYearFilter').value = '';
    document.getElementById('analyticsMonthFilter').value = '';
    document.getElementById('analyticsLgaFilter').value = '';
    renderAnalytics();
}

function populateAnalyticsFilters() {
    const years = [...new Set(transactions.map(t => (t.date||'').slice(0,4)))].filter(Boolean).sort();
    const yearSel = document.getElementById('analyticsYearFilter');
    yearSel.innerHTML = '<option value="">All Years</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
    const monthSel = document.getElementById('analyticsMonthFilter');
    const months = ['01-Jan','02-Feb','03-Mar','04-Apr','05-May','06-Jun','07-Jul','08-Aug','09-Sep','10-Oct','11-Nov','12-Dec'];
    monthSel.innerHTML = '<option value="">All Months</option>' + months.map(m => `<option value="${m.slice(0,2)}">${m.slice(3)}</option>`).join('');
}

function filterTransactions() {
    const { year, month, lga } = getAnalyticsFilters();
    return transactions.filter(t => {
        const d = t.date || '';
        if (year && d.slice(0,4) !== year) return false;
        if (month && d.slice(5,7) !== month) return false;
        if (lga && t.lga !== lga) return false;
        return true;
    });
}

function filterDevicesByDate() {
    const { year, month } = getAnalyticsFilters();
    return devices.filter(d => {
        const dte = d.regDate || '';
        if (year && dte.slice(0,4) !== year) return false;
        if (month && dte.slice(5,7) !== month) return false;
        return true;
    });
}

function renderAnalytics() {
    populateAnalyticsFilters();
    const { year, month, lga } = getAnalyticsFilters();
    if (year) document.getElementById('analyticsYearFilter').value = year;
    if (month) document.getElementById('analyticsMonthFilter').value = month;
    if (lga) document.getElementById('analyticsLgaFilter').value = lga;
    const filteredTx = filterTransactions();
    const filteredDevices = filterDevicesByDate();
    const lgaLicenses = lga ? licenses.filter(l => l.lga === lga) : licenses;
    document.getElementById('metric-operators').textContent = lgaLicenses.filter(l => l.status === 'Active').length;
    document.getElementById('metric-devices').textContent = filteredDevices.length;
    document.getElementById('metric-linked').textContent = filteredDevices.filter(d => d.linkedCustomerId).length;
    const totalRev = filteredTx.reduce((s,t) => s + t.amount, 0);
    document.getElementById('metric-revenue').textContent = '₦' + totalRev.toLocaleString();
    const catFigures = document.getElementById('revenueCategoryFigures');
    const catTotals = {};
    Object.keys(REVENUE_CATEGORIES).forEach(k => catTotals[k] = 0);
    filteredTx.forEach(t => { if (catTotals[t.type] !== undefined) catTotals[t.type] += t.amount; });
    catFigures.innerHTML = Object.keys(REVENUE_CATEGORIES).map(k => {
        const c = REVENUE_CATEGORIES[k];
        return `<div class="bg-slate-50 p-2 rounded border-l-2" style="border-color:${c.color}"><span class="text-[10px] text-gray-500 block">${c.label}</span><span class="font-black text-sm" style="color:${c.color}">₦${(catTotals[k]||0).toLocaleString()}</span></div>`;
    }).join('');
    if (charts.source) charts.source.destroy();
    const sctx = document.getElementById('revenueSourceChart');
    if (sctx) charts.source = new Chart(sctx, { type: 'doughnut', data: { labels: Object.keys(REVENUE_CATEGORIES).map(k => REVENUE_CATEGORIES[k].label), datasets: [{ data: Object.keys(REVENUE_CATEGORIES).map(k => catTotals[k]||0), backgroundColor: Object.keys(REVENUE_CATEGORIES).map(k => REVENUE_CATEGORIES[k].color) }] }, options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } } } });
    const now = new Date();
    const monthsArr = [];
    for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); monthsArr.push({ key: d.toISOString().slice(0,7), label: d.toLocaleDateString('en',{month:'short',year:'2-digit'}), total: 0 }); }
    filteredTx.forEach(t => { const mk = (t.date||'').slice(0,7); const m = monthsArr.find(x => x.key === mk); if (m) m.total += t.amount; });
    if (charts.monthly) charts.monthly.destroy();
    const mctx = document.getElementById('monthlyRevenueChart');
    if (mctx) charts.monthly = new Chart(mctx, { type: 'bar', data: { labels: monthsArr.map(m => m.label), datasets: [{ label: 'Revenue (₦)', data: monthsArr.map(m => m.total), backgroundColor: '#006837' }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => '₦'+(v/1000000).toFixed(1)+'M', font:{size:10} } }, x: { ticks: { font: { size: 9 } } } } } });
    const lgaRevData = BENUE_LGAS.map(l => transactions.filter(t => t.lga === l && (!year || (t.date||'').slice(0,4)===year) && (!month || (t.date||'').slice(5,7)===month)).reduce((s,t)=>s+t.amount,0));
    if (charts.lga) charts.lga.destroy();
    const lctx = document.getElementById('lgaRevenueChart');
    if (lctx) charts.lga = new Chart(lctx, { type: 'bar', data: { labels: BENUE_LGAS, datasets: [{ label: 'Revenue (₦)', data: lgaRevData, backgroundColor: '#006837' }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => '₦'+(v/1000000).toFixed(1)+'M', font:{size:9} } }, x: { ticks: { font: { size: 8 } } } } } });
    const lgaRegData = BENUE_LGAS.map(l => devices.filter(d => { const lic = licenses.find(x => x.companyName === d.companyName); return lic && lic.lga === l; }).length);
    const lgaLinkData = BENUE_LGAS.map(l => devices.filter(d => { const lic = licenses.find(x => x.companyName === d.companyName); return lic && lic.lga === l && d.linkedCustomerId; }).length);
    if (charts.lgaDev) charts.lgaDev.destroy();
    const ldctx = document.getElementById('lgaDevicesChart');
    if (ldctx) charts.lgaDev = new Chart(ldctx, { type: 'bar', data: { labels: BENUE_LGAS, datasets: [{ label: 'Registered', data: lgaRegData, backgroundColor: '#006837' }, { label: 'Linked', data: lgaLinkData, backgroundColor: '#D4AF37' }] }, options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } }, scales: { x: { ticks: { font: { size: 8 } } } } } });
    renderLGATable();
}

// ============ FORM SUBMISSIONS ============
function handleNewBusiness(e) {
    e.preventDefault();
    const name = document.getElementById('form-biz-name').value;
    const cat = document.getElementById('form-biz-cat').value;
    const lga = document.getElementById('form-biz-lga').value;
    const cac = document.getElementById('form-biz-cac').value || "RC-PENDING";
    const newId = `BITDA-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    businesses.unshift({ id: newId, name, cat, lga, fee: 50000, status: "Verified & Active", date: new Date().toISOString().split('T')[0], cac });
    saveStore(STORE_KEYS.businesses, businesses);
    transactions.push({ id: 'TX-' + Math.floor(Math.random()*1000000), type: 'company_registration', amount: 50000, date: new Date().toISOString().split('T')[0], lga, entityId: newId });
    saveStore(STORE_KEYS.transactions, transactions);
    renderBusinesses();
    closeModal('newBusinessModal');
    viewCertificate(newId);
}

function handleNewDevice(e) {
    e.preventDefault();
    const model = document.getElementById('form-dev-model').value;
    const cat = document.getElementById('form-dev-cat').value;
    const imei = document.getElementById('form-dev-imei').value;
    const owner = document.getElementById('form-dev-owner').value;
    const newId = `DEV-${Math.floor(10000 + Math.random() * 90000)}`;
    devices.unshift({ id: newId, model, cat, imei, idType: cat.includes('Mobile') ? 'IMEI' : 'Serial Number', owner, companyId: null, companyName: owner, linkedCustomerId: null, customerName: null, purchaseDate: null, status: "Clean & Registered", regDate: new Date().toISOString().split('T')[0], fee: 1000, transferHistory: [] });
    saveStore(STORE_KEYS.devices, devices);
    transactions.push({ id: 'TX-' + Math.floor(Math.random()*1000000), type: 'device_registration', amount: 1000, date: new Date().toISOString().split('T')[0], lga: 'Makurdi', entityId: newId });
    saveStore(STORE_KEYS.transactions, transactions);
    renderDevices();
    closeModal('newDeviceModal');
    alert(`Device Registered Successfully!\nUnique ID: ${newId}\nIMEI Tagged: ${imei}\nFee Paid: ₦1,000`);
}

function handleComplaint(e) {
    e.preventDefault();
    const cat = document.getElementById('form-cmp-cat').value;
    const reporter = document.getElementById('form-cmp-reporter').value;
    const target = document.getElementById('form-cmp-target').value;
    const newId = `TCK-${Math.floor(100 + Math.random() * 900)}`;
    complaints.unshift({ id: newId, type: cat, reporter, target, date: new Date().toISOString().split('T')[0], status: "Under BITDA Enforcement Review" });
    saveStore(STORE_KEYS.complaints, complaints);
    renderComplaints();
    closeModal('reportComplaintModal');
    alert(`Ticket ${newId} Submitted Successfully! BITDA Enforcement desk notified.`);
}

// ============ COMPANY PORTAL ============
function renderCompanyPortal() {
    const check = isLicenseActive(currentUser.id);
    const banner = document.getElementById('companyLicenseBanner');
    const lic = getCompanyLicense(currentUser.id);
    if (!lic) banner.innerHTML = `<div class="bg-amber-50 border border-amber-300 text-amber-800 p-3 rounded-xl text-xs flex items-center gap-2"><i class="fa-solid fa-triangle-exclamation"></i> No license found. Please complete registration to obtain a license.</div>`;
    else if (lic.status === 'Pending Activation') banner.innerHTML = `<div class="bg-amber-50 border border-amber-300 text-amber-800 p-3 rounded-xl text-xs flex items-center gap-2"><i class="fa-solid fa-clock"></i> Your license (${lic.id}) is pending BITDA activation. Device registration and linking are disabled until activated.</div>`;
    else if (!check.active) banner.innerHTML = `<div class="bg-red-50 border border-red-300 text-red-700 p-3 rounded-xl text-xs flex items-center gap-2"><i class="fa-solid fa-triangle-exclamation"></i> ${check.reason} <button onclick="openRenewalModal('${lic.id}')" class="underline font-bold">Renew now</button></div>`;
    else banner.innerHTML = `<div class="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3 rounded-xl text-xs flex items-center gap-2"><i class="fa-solid fa-circle-check"></i> License ${lic.id} is active. Valid until ${lic.expiryDate}. Device operations enabled.</div>`;
    const myDevices = devices.filter(d => d.companyId === currentUser.id);
    document.getElementById('cmp-devices-count').textContent = myDevices.length;
    document.getElementById('cmp-linked-count').textContent = myDevices.filter(d => d.linkedCustomerId).length;
    document.getElementById('cmp-fees').textContent = '₦' + (myDevices.length * 1000).toLocaleString();
    const body = document.getElementById('companyDeviceTableBody');
    if (myDevices.length === 0) body.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-gray-400 text-xs">No devices registered yet. Click "Register New Device" to begin.</td></tr>`;
    else body.innerHTML = myDevices.map(d => `<tr class="hover:bg-slate-50"><td class="p-3 font-mono font-bold text-gray-600">${d.id}</td><td class="p-3 font-semibold text-gray-800">${d.model}</td><td class="p-3">${d.cat}</td><td class="p-3 font-mono text-xs">${d.imei}<br><span class="text-[9px] text-gray-400">${d.idType||'IMEI'}</span></td><td class="p-3">${d.customerName ? `<span class="text-emerald-700 font-semibold">${d.customerName}</span>` : '<span class="text-gray-400">Unlinked</span>'}</td><td class="p-3">${d.purchaseDate || '—'}</td><td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${d.status.includes('Clean')?'bg-blue-100 text-blue-800':'bg-red-100 text-red-800'}">${d.status}</span></td><td class="p-3">${!d.linkedCustomerId ? `<button onclick="quickLink('${d.id}')" class="text-xs text-benueGreen hover:underline font-bold">Link Now</button>` : `<button onclick="unlinkDevice('${d.id}')" class="text-xs text-red-600 hover:underline">Unlink</button>`}</td></tr>`).join('');
}

function handleCompanyDevice(e) {
    e.preventDefault();
    const check = isLicenseActive(currentUser.id);
    if (!check.active) { alert('Action blocked: ' + check.reason); return; }
    const model = document.getElementById('cmp-dev-model').value;
    const cat = document.getElementById('cmp-dev-cat').value;
    const imei = document.getElementById('cmp-dev-imei').value;
    const idType = document.getElementById('cmp-dev-idtype').value;
    const condition = document.getElementById('cmp-dev-condition').value;
    const newId = `DEV-${Math.floor(10000 + Math.random() * 90000)}`;
    const lic = getCompanyLicense(currentUser.id);
    devices.unshift({ id: newId, model, cat, imei, idType, condition, warrantyDays: condition === 'Used' ? 14 : 365, owner: currentUser.name, companyId: currentUser.id, companyName: currentUser.name, linkedCustomerId: null, customerName: null, purchaseDate: null, status: "Clean & Registered", regDate: new Date().toISOString().split('T')[0], fee: 1000, transferHistory: [] });
    saveStore(STORE_KEYS.devices, devices);
    transactions.push({ id: 'TX-' + Math.floor(Math.random()*1000000), type: 'device_registration', amount: 1000, date: new Date().toISOString().split('T')[0], lga: lic ? lic.lga : 'Makurdi', entityId: newId });
    saveStore(STORE_KEYS.transactions, transactions);
    renderCompanyPortal();
    closeModal('companyDeviceModal');
    e.target.reset();
    alert(`Device ${newId} registered successfully! Fee: ₦1,000. You can now link it to a customer.`);
}

function quickLink(deviceId) {
    const check = isLicenseActive(currentUser.id);
    if (!check.active) { alert('Action blocked: ' + check.reason); return; }
    openModal('linkDeviceModal');
    populateLinkModal(deviceId);
}

function populateLinkModal(preselectDeviceId) {
    const myDevices = devices.filter(d => d.companyId === currentUser.id && !d.linkedCustomerId);
    const devSel = document.getElementById('link-device-select');
    devSel.innerHTML = '<option value="">-- Choose an unlinked device --</option>' + myDevices.map(d => `<option value="${d.id}">${d.model} — ${d.imei} (${d.idType||'IMEI'})</option>`).join('');
    if (preselectDeviceId) devSel.value = preselectDeviceId;
    document.getElementById('link-purchase-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('link-customer-nin').value = '';
    document.getElementById('link-customer-accid').value = '';
    document.getElementById('linkCustomerResult').classList.add('hidden');
    verifiedLinkCustomer = null;
}

function searchCustomerByNIN() {
    const nin = document.getElementById('link-customer-nin').value.trim();
    const accId = document.getElementById('link-customer-accid').value.trim();
    const result = document.getElementById('linkCustomerResult');
    if (!nin || !accId) { result.className = 'mt-2 p-2 rounded text-xs bg-red-50 border border-red-300 text-red-700'; result.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Please enter both NIN and Account ID.'; result.classList.remove('hidden'); verifiedLinkCustomer = null; return; }
    const customer = accounts.find(a => a.type === 'customer' && a.nin === nin && a.id === accId);
    if (!customer) { result.className = 'mt-2 p-2 rounded text-xs bg-red-50 border border-red-300 text-red-700'; result.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> No customer found matching this NIN and Account ID.'; verifiedLinkCustomer = null; }
    else { result.className = 'mt-2 p-2 rounded text-xs bg-emerald-50 border border-emerald-300 text-emerald-800'; result.innerHTML = `<i class="fa-solid fa-circle-check"></i> Customer found: <strong>${customer.name}</strong> (${customer.email})`; verifiedLinkCustomer = customer; }
    result.classList.remove('hidden');
}

function handleLinkDevice(e) {
    e.preventDefault();
    const check = isLicenseActive(currentUser.id);
    if (!check.active) { alert('Action blocked: ' + check.reason); return; }
    const deviceId = document.getElementById('link-device-select').value;
    const purchaseDate = document.getElementById('link-purchase-date').value;
    if (!deviceId) { alert('Please select a device.'); return; }
    if (!verifiedLinkCustomer) { alert('Please search and verify a customer by NIN and Account ID first.'); return; }
    const dev = devices.find(d => d.id === deviceId);
    if (!dev) return;
    dev.linkedCustomerId = verifiedLinkCustomer.id;
    dev.customerName = verifiedLinkCustomer.name;
    dev.purchaseDate = purchaseDate;
    saveStore(STORE_KEYS.devices, devices);
    renderCompanyPortal();
    closeModal('linkDeviceModal');
    alert(`Success! ${dev.model} has been linked to ${verifiedLinkCustomer.name}. It now appears on their dashboard. A notification email is being sent to ${verifiedLinkCustomer.email}.`);
    fetch('/functions/sendDeviceLinkNotification', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerEmail: verifiedLinkCustomer.email, customerName: verifiedLinkCustomer.name, deviceModel: dev.model, deviceIdType: dev.idType || 'IMEI', deviceImei: dev.imei, companyName: currentUser.name, purchaseDate })
    }).then(r => r.json()).then(res => { if (res.success) console.log('Notification email sent:', res.messageId); else console.error('Email notification failed:', res.error); }).catch(err => console.error('Notification request failed:', err));
}

function unlinkDevice(deviceId) {
    if (!confirm('Unlink this device from the customer?')) return;
    const dev = devices.find(d => d.id === deviceId);
    if (dev) { dev.linkedCustomerId = null; dev.customerName = null; dev.purchaseDate = null; saveStore(STORE_KEYS.devices, devices); renderCompanyPortal(); }
}

// ============ CUSTOMER PORTAL ============
function renderCustomerPortal() {
    const myDevices = devices.filter(d => d.linkedCustomerId === currentUser.id);
    const transferredAway = transfers.filter(t => t.senderId === currentUser.id);
    document.getElementById('cust-devices-count').textContent = myDevices.length;
    document.getElementById('cust-clean-count').textContent = myDevices.filter(d => d.status.includes('Clean')).length;
    document.getElementById('cust-transferred-count').textContent = transferredAway.length;
    const container = document.getElementById('customerDevicesContainer');
    const empty = document.getElementById('customerEmptyState');
    if (myDevices.length === 0) { container.innerHTML = ''; container.classList.add('hidden'); empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden'); container.classList.remove('hidden');
    container.innerHTML = myDevices.map(d => {
        const historyHtml = (d.transferHistory && d.transferHistory.length > 0) ? `<div class="border-t pt-2 mt-2"><span class="text-gray-400 text-[10px] uppercase block mb-1">Transfer History</span>${d.transferHistory.map(h => `<div class="text-[10px] text-gray-600"><i class="fa-solid fa-right-left"></i> ${h.fromName} → ${h.toName} on ${h.date} (₦${h.fee.toLocaleString()})</div>`).join('')}</div>` : '';
        return `<div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden fade-in hover:shadow-md transition"><div class="bg-gradient-to-r ${d.status.includes('Clean')?'from-benueDark to-benueGreen':'from-red-700 to-red-900'} text-white p-3 flex justify-between items-center"><span class="text-xs font-bold uppercase"><i class="fa-solid fa-${d.cat.includes('Mobile')?'mobile-retro':d.cat.includes('Laptop')?'laptop':d.cat.includes('Networking')?'wifi':'battery-full'}"></i> ${d.cat}</span><span class="text-[10px] bg-white/20 px-2 py-0.5 rounded font-bold">${d.status.includes('Clean')?'<i class="fa-solid fa-shield-check"></i> Verified':'<i class="fa-solid fa-triangle-exclamation"></i> Flagged'}</span></div><div class="p-4 space-y-2 text-xs"><div><span class="text-gray-400 text-[10px] uppercase block">Product Model</span><span class="font-bold text-gray-900 text-sm">${d.model}</span></div><div><span class="text-gray-400 text-[10px] uppercase block">${d.idType||'IMEI'} Number</span><span class="font-mono font-bold text-benueGreen">${d.imei}</span></div><div class="border-t pt-2"><span class="text-gray-400 text-[10px] uppercase block">Registered Company</span><span class="font-semibold text-gray-800 flex items-center gap-1"><i class="fa-solid fa-building text-benueGreen"></i> ${d.companyName||d.owner}</span></div><div><span class="text-gray-400 text-[10px] uppercase block">Date of Purchase</span><span class="font-semibold text-gray-800"><i class="fa-regular fa-calendar"></i> ${d.purchaseDate||'—'}</span></div><div><span class="text-gray-400 text-[10px] uppercase block">Device Registration ID</span><span class="font-mono text-gray-600">${d.id}</span></div>${historyHtml}</div><div class="bg-slate-50 px-4 py-2 border-t flex justify-between items-center"><button onclick="reportMyDevice('${d.id}')" class="text-[10px] text-red-600 hover:underline font-bold"><i class="fa-solid fa-flag"></i> Report Stolen</button><button onclick="openTransferModal('${d.id}')" class="text-[10px] text-benueGreen hover:underline font-bold"><i class="fa-solid fa-right-left"></i> Transfer Ownership</button></div></div>`;
    }).join('');
}

function reportMyDevice(deviceId) {
    const dev = devices.find(d => d.id === deviceId);
    if (!dev) return;
    if (!confirm(`Report device ${dev.model} (IMEI: ${dev.imei}) as stolen/lost? This will blacklist it on CEIR.`)) return;
    dev.status = "FLAGGED STOLEN";
    saveStore(STORE_KEYS.devices, devices);
    complaints.unshift({ id: `TCK-${Math.floor(100+Math.random()*900)}`, type: "Stolen / Lost Device", reporter: currentUser.name, target: `IMEI ${dev.imei}`, date: new Date().toISOString().split('T')[0], status: "Blacklisted on CEIR" });
    saveStore(STORE_KEYS.complaints, complaints);
    transactions.push({ id: 'TX-' + Math.floor(Math.random()*1000000), type: 'phone_tracking', amount: 500000, date: new Date().toISOString().split('T')[0], lga: 'Makurdi', entityId: dev.id });
    saveStore(STORE_KEYS.transactions, transactions);
    renderCustomerPortal();
    alert('Device reported and blacklisted. BITDA enforcement notified.');
}

// ============ DEVICE TRANSFER ============
function openTransferModal(deviceId) {
    const dev = devices.find(d => d.id === deviceId);
    if (!dev) return;
    if (!dev.status.includes('Clean')) { alert('Flagged/stolen devices cannot be transferred.'); return; }
    pendingTransferDeviceId = deviceId;
    document.getElementById('transfer-device-name').textContent = dev.model;
    document.getElementById('transfer-device-imei').textContent = (dev.idType||'IMEI') + ': ' + dev.imei;
    document.getElementById('transfer-recipient-nin').value = '';
    document.getElementById('transfer-recipient-accid').value = '';
    document.getElementById('transferRecipientResult').classList.add('hidden');
    document.getElementById('transferSubmitBtn').disabled = true;
    verifiedTransferRecipient = null;
    openModal('transferDeviceModal');
}

function searchTransferRecipient() {
    const nin = document.getElementById('transfer-recipient-nin').value.trim();
    const accId = document.getElementById('transfer-recipient-accid').value.trim();
    const result = document.getElementById('transferRecipientResult');
    if (!nin || !accId) { result.className = 'mt-2 p-2 rounded text-xs bg-red-50 border border-red-300 text-red-700'; result.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Please enter both NIN and Account ID.'; result.classList.remove('hidden'); verifiedTransferRecipient = null; document.getElementById('transferSubmitBtn').disabled = true; return; }
    if (nin === currentUser.nin && accId === currentUser.id) { result.className = 'mt-2 p-2 rounded text-xs bg-red-50 border border-red-300 text-red-700'; result.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> You cannot transfer a device to yourself.'; result.classList.remove('hidden'); verifiedTransferRecipient = null; document.getElementById('transferSubmitBtn').disabled = true; return; }
    const recipient = accounts.find(a => a.type === 'customer' && a.nin === nin && a.id === accId);
    if (!recipient) { result.className = 'mt-2 p-2 rounded text-xs bg-red-50 border border-red-300 text-red-700'; result.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> No customer found matching this NIN and Account ID.'; verifiedTransferRecipient = null; document.getElementById('transferSubmitBtn').disabled = true; }
    else { result.className = 'mt-2 p-2 rounded text-xs bg-emerald-50 border border-emerald-300 text-emerald-800'; result.innerHTML = `<i class="fa-solid fa-circle-check"></i> Recipient verified: <strong>${recipient.name}</strong> (${recipient.email})`; verifiedTransferRecipient = recipient; document.getElementById('transferSubmitBtn').disabled = false; }
    result.classList.remove('hidden');
}

function handleTransferDevice(e) {
    e.preventDefault();
    if (!verifiedTransferRecipient) { alert('Please verify the recipient first.'); return; }
    closeModal('transferDeviceModal');
    pendingPaymentCallback = function() {
        const dev = devices.find(d => d.id === pendingTransferDeviceId);
        if (!dev) return;
        const transferRecord = { id: 'TRF-' + Math.floor(1000 + Math.random()*9000), deviceId: dev.id, deviceModel: dev.model, deviceImei: dev.imei, senderId: currentUser.id, senderName: currentUser.name, recipientId: verifiedTransferRecipient.id, recipientName: verifiedTransferRecipient.name, date: new Date().toISOString().split('T')[0], fee: 2000, status: 'Completed' };
        if (!dev.transferHistory) dev.transferHistory = [];
        dev.transferHistory.push({ fromName: currentUser.name, toName: verifiedTransferRecipient.name, date: transferRecord.date, fee: 2000 });
        dev.linkedCustomerId = verifiedTransferRecipient.id;
        dev.customerName = verifiedTransferRecipient.name;
        saveStore(STORE_KEYS.devices, devices);
        transfers.push(transferRecord);
        saveStore(STORE_KEYS.transfers, transfers);
        transactions.push({ id: 'TX-' + Math.floor(Math.random()*1000000), type: 'device_transfer', amount: 2000, date: transferRecord.date, lga: 'Makurdi', entityId: transferRecord.id });
        saveStore(STORE_KEYS.transactions, transactions);
        renderCustomerPortal();
        alert(`Transfer successful! ${dev.model} has been transferred to ${verifiedTransferRecipient.name} for ₦2,000. The device now appears as transferred on your dashboard and as owned on their dashboard.`);
    };
    openPaymentModal(2000, 'Device Transfer Fee');
}

function renderTransferHistory() {
    const outContainer = document.getElementById('transfersOutContainer');
    const inContainer = document.getElementById('transfersInContainer');
    const outTransfers = transfers.filter(t => t.senderId === currentUser.id);
    const inTransfers = transfers.filter(t => t.recipientId === currentUser.id);
    outContainer.innerHTML = outTransfers.length === 0 ? '<p class="text-xs text-gray-400 text-center py-4">No devices transferred out.</p>' : outTransfers.map(t => `<div class="border rounded-lg p-3 bg-red-50/30"><div class="flex justify-between items-start"><div><div class="font-bold text-gray-900 text-sm">${t.deviceModel}</div><div class="text-[10px] text-gray-500 font-mono">${t.deviceImei}</div></div><span class="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">TRANSFERRED</span></div><div class="text-xs text-gray-600 mt-2"><i class="fa-solid fa-arrow-right"></i> To: <strong>${t.recipientName}</strong></div><div class="text-[10px] text-gray-400 mt-1">Date: ${t.date} • Fee: ₦${t.fee.toLocaleString()}</div></div>`).join('');
    inContainer.innerHTML = inTransfers.length === 0 ? '<p class="text-xs text-gray-400 text-center py-4">No devices received.</p>' : inTransfers.map(t => `<div class="border rounded-lg p-3 bg-emerald-50/30"><div class="flex justify-between items-start"><div><div class="font-bold text-gray-900 text-sm">${t.deviceModel}</div><div class="text-[10px] text-gray-500 font-mono">${t.deviceImei}</div></div><span class="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold">RECEIVED</span></div><div class="text-xs text-gray-600 mt-2"><i class="fa-solid fa-arrow-left"></i> From: <strong>${t.senderName}</strong></div><div class="text-[10px] text-gray-400 mt-1">Date: ${t.date} • Fee: ₦${t.fee.toLocaleString()}</div></div>`).join('');
}

// ============ PAYMENT (Simulated) ============
function openPaymentModal(amount, description) {
    document.getElementById('paymentAmount').textContent = '₦' + amount.toLocaleString();
    document.getElementById('payBtnAmount').textContent = '₦' + amount.toLocaleString();
    document.getElementById('pay-card-number').value = '';
    document.getElementById('pay-card-expiry').value = '';
    document.getElementById('pay-card-cvc').value = '';
    document.getElementById('paymentError').classList.add('hidden');
    openModal('paymentModal');
}

function processPayment() {
    const cardNum = document.getElementById('pay-card-number').value.replace(/\s/g,'');
    const expiry = document.getElementById('pay-card-expiry').value;
    const cvc = document.getElementById('pay-card-cvc').value;
    const errBox = document.getElementById('paymentError');
    errBox.classList.add('hidden');
    if (!/^\d{13,19}$/.test(cardNum)) { errBox.textContent = 'Please enter a valid card number.'; errBox.classList.remove('hidden'); return; }
    if (!/^\d{2}\/\d{2}$/.test(expiry)) { errBox.textContent = 'Please enter a valid expiry (MM/YY).'; errBox.classList.remove('hidden'); return; }
    if (!/^\d{3,4}$/.test(cvc)) { errBox.textContent = 'Please enter a valid CVC.'; errBox.classList.remove('hidden'); return; }
    closeModal('paymentModal');
    if (pendingPaymentCallback) { const cb = pendingPaymentCallback; pendingPaymentCallback = null; cb(); }
}

// ============ WARRANTY PORTAL ============
function getWarrantyMonths(category) {
    if (category.includes('Laptop')) return 24;
    if (category.includes('Power Bank') || category.includes('Accessory')) return 6;
    return 12;
}

function renderWarrantyPortal() {
    const myDevices = devices.filter(d => d.linkedCustomerId === currentUser.id && d.purchaseDate);
    const now = new Date();
    const computed = myDevices.map(d => {
        const purchase = new Date(d.purchaseDate);
        const warrantyEnd = new Date(purchase);
        const warrantyDays = d.warrantyDays || (getWarrantyMonths(d.cat) * 30);
        warrantyEnd.setDate(warrantyEnd.getDate() + warrantyDays);
        const totalMs = warrantyEnd - purchase;
        const remainingMs = warrantyEnd - now;
        const remainingPct = Math.min(100, Math.max(0, (remainingMs / totalMs) * 100));
        const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000*60*60*24)));
        const expired = remainingMs <= 0;
        const expiringSoon = !expired && remainingDays <= 60;
        return { d, warrantyDays, warrantyEnd, remainingPct, remainingDays, expired, expiringSoon };
    });
    document.getElementById('war-active-count').textContent = computed.filter(c => !c.expired).length;
    document.getElementById('war-expiring-count').textContent = computed.filter(c => c.expiringSoon).length;
    document.getElementById('war-expired-count').textContent = computed.filter(c => c.expired).length;
    const container = document.getElementById('warrantyDevicesContainer');
    const empty = document.getElementById('warrantyEmptyState');
    if (computed.length === 0) { container.innerHTML = ''; container.classList.add('hidden'); empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden'); container.classList.remove('hidden');
    container.innerHTML = computed.map(c => {
        const { d, warrantyDays, warrantyEnd, remainingPct, remainingDays, expired, expiringSoon } = c;
        const barColor = expired ? 'bg-red-500' : remainingPct > 50 ? 'bg-emerald-500' : remainingPct > 20 ? 'bg-amber-500' : 'bg-red-500';
        const statusBadge = expired ? `<span class="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded">EXPIRED</span>` : expiringSoon ? `<span class="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded">EXPIRING SOON</span>` : `<span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">ACTIVE</span>`;
        const fmtDate = (dt) => dt.toLocaleDateString('en-GB');
        return `<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 fade-in"><div class="flex flex-wrap justify-between items-start gap-3 mb-3"><div><div class="flex items-center gap-2"><span class="font-bold text-gray-900 text-sm">${d.model}</span>${statusBadge}</div><div class="text-xs text-gray-500 mt-0.5">${d.cat} • ${d.condition || 'Brand New'} • ${d.idType||'IMEI'}: <span class="font-mono">${d.imei}</span></div><div class="text-xs text-gray-500">Company: ${d.companyName||d.owner}</div></div><div class="text-right text-xs"><div class="text-gray-400 text-[10px] uppercase">Warranty Period</div><div class="font-bold text-gray-800">${warrantyDays} days</div><div class="text-gray-400 text-[10px] uppercase mt-1">Expires On</div><div class="font-semibold text-gray-700">${fmtDate(warrantyEnd)}</div></div></div><div><div class="flex justify-between text-[10px] text-gray-500 mb-1"><span>Warranty remaining</span><span class="font-bold ${expired?'text-red-600':expiringSoon?'text-amber-600':'text-emerald-600'}">${expired ? 'Warranty expired' : remainingDays + ' days remaining'}</span></div><div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden"><div class="${barColor} h-3 rounded-full transition-all" style="width: ${remainingPct}%"></div></div><div class="flex justify-between text-[9px] text-gray-400 mt-1"><span>Purchase: ${fmtDate(new Date(d.purchaseDate))}</span><span>Expiry: ${fmtDate(warrantyEnd)}</span></div></div></div>`;
    }).join('');
}

// ============ LICENSE CERTIFICATE ============
function viewCertificate(bizId) {
    const biz = businesses.find(b => b.id === bizId) || licenses.find(l => l.id === bizId);
    if (!biz) return;
    const lic = licenses.find(l => l.id === bizId) || { id: biz.id, companyName: biz.name, lga: biz.lga, cac: biz.cac, issueDate: biz.date, expiryDate: '2027-01-15', barcode: 'BTRCP-' + bizId };
    const flagged = lic.complianceFlagged || (lic.companyId && accounts.find(a => a.id === lic.companyId && a.deviceSuspended));
    const flagBanner = flagged ? `<div class="bg-red-100 border-2 border-red-500 text-red-800 p-2 rounded font-black uppercase text-xs"><i class="fa-solid fa-triangle-exclamation"></i> CERTIFICATE FLAGGED — ${lic.flagReason || 'Compliance violation under review'}</div>` : '';
    document.getElementById('certModalBody').innerHTML = `<div class="cert-watermark"><img src="${LOGO_URL}" alt="watermark"></div><div class="space-y-3 relative z-10">${flagBanner}<div class="flex justify-center"><img src="${LOGO_URL}" alt="BTRCP Logo" class="w-24 h-24 object-contain"></div><h3 class="text-lg font-black text-gray-900 uppercase">Benue State Government</h3><p class="text-[11px] font-bold text-gray-600">BENUE INFORMATION & COMMUNICATION TECHNOLOGY DEVELOPMENT AGENCY (BITDA)</p><div class="border-t border-b py-3 my-2 space-y-1"><span class="text-[10px] text-gray-400 block uppercase">Licensed Technology Entity</span><span class="text-base font-extrabold text-gray-900">${lic.companyName || biz.name}</span><span class="block text-xs font-semibold text-benueGreen">${biz.cat || 'Company Operational License'}</span><span class="block text-[11px] text-gray-500">LGA Jurisdiction: ${lic.lga || biz.lga} | CAC Registration: ${lic.cac || biz.cac}</span></div><div class="flex justify-between items-center text-left bg-slate-50 p-2.5 rounded border text-[11px]"><div><span class="block text-gray-400">License Number:</span><span class="font-mono font-bold text-benueGreen">${lic.id || biz.id}</span></div><div class="text-center"><span class="block text-gray-400">Issued:</span><span class="font-bold text-gray-700">${lic.issueDate || biz.date || '—'}</span></div><div class="text-right"><span class="block text-gray-400">Expires:</span><span class="font-bold text-red-600">${lic.expiryDate || '2027-01-15'}</span></div></div><div class="flex flex-col items-center pt-2"><svg id="certBarcode"></svg><span class="block text-[9px] text-gray-500 mt-1">Scan to verify on BITDA Public Verification Engine</span></div></div>`;
    openModal('certModal');
    setTimeout(() => {
        const barcodeEl = document.getElementById('certBarcode');
        if (barcodeEl && typeof JsBarcode !== 'undefined') {
            try { JsBarcode(barcodeEl, lic.barcode || (lic.id || biz.id), { format: 'CODE128', width: 2, height: 50, displayValue: true, fontSize: 10, margin: 4 }); }
            catch(e) { console.warn('Barcode generation failed', e); }
        }
    }, 100);
}

// ============ SEARCH / VERIFICATION ============
function searchDeviceIMEI() {
    const q = document.getElementById('deviceSearchInput').value.trim();
    const res = document.getElementById('imeiSearchResult');
    if(!q) return;
    const found = devices.find(d => d.imei === q || d.id === q);
    res.classList.remove('hidden');
    if(found) {
        res.className = `mt-3 p-3 rounded-lg text-xs border ${found.status.includes('Clean') ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-red-50 border-red-300 text-red-900'}`;
        res.innerHTML = `<div class="font-bold uppercase text-xs mb-1">Status: ${found.status}</div><div>Model: <strong>${found.model}</strong> (${found.cat})</div><div>${found.idType||'IMEI'}: <span class="font-mono">${found.imei}</span></div><div>Owner / Vendor: ${found.owner}</div>${found.customerName ? `<div>Linked Customer: <strong>${found.customerName}</strong> (purchased ${found.purchaseDate})</div>` : ''}`;
    } else {
        res.className = 'mt-3 p-3 rounded-lg text-xs bg-amber-50 border border-amber-300 text-amber-900';
        res.innerHTML = `<strong>Unregistered Device / IMEI</strong> - Not found in BITDA Tier 2 Registry. Buyer caution advised.`;
    }
}

function runPublicVerification() {
    const q = document.getElementById('publicSearchQuery').value.trim().toLowerCase();
    const container = document.getElementById('publicVerificationResult');
    container.classList.remove('hidden');
    const bizMatch = businesses.find(b => b.id.toLowerCase().includes(q) || b.name.toLowerCase().includes(q)) || licenses.find(l => l.id.toLowerCase().includes(q) || l.companyName.toLowerCase().includes(q));
    const devMatch = devices.find(d => d.imei.toLowerCase() === q || d.id.toLowerCase() === q);
    if(bizMatch) {
        const flagged = bizMatch.complianceFlagged || (bizMatch.companyId && accounts.find(a => a.id === bizMatch.companyId && a.deviceSuspended));
        container.className = flagged ? "mt-6 text-left border rounded-xl p-4 bg-red-50 border-red-400 text-red-900 text-xs" : "mt-6 text-left border rounded-xl p-4 bg-emerald-50 border-emerald-300 text-emerald-900 text-xs";
        container.innerHTML = `<div class="flex items-center gap-2 font-bold text-sm ${flagged ? 'text-red-800' : 'text-emerald-800'} mb-2"><i class="fa-solid ${flagged ? 'fa-triangle-exclamation' : 'fa-circle-check'} text-lg"></i> ${flagged ? 'CERTIFICATE FLAGGED — COMPLIANCE ACTION REQUIRED' : 'VERIFIED LICENSED OPERATOR'}</div><div class="grid grid-cols-2 gap-2"><div><strong>Business Entity:</strong> ${bizMatch.companyName || bizMatch.name}</div><div><strong>License Code:</strong> ${bizMatch.id}</div><div><strong>LGA Location:</strong> ${bizMatch.lga}</div><div><strong>Status:</strong> ${flagged ? (bizMatch.flagReason || 'Flagged for compliance violation') : (bizMatch.status || 'Active')}</div></div>`;
    } else if(devMatch) {
        container.className = `mt-6 text-left border rounded-xl p-4 text-xs ${devMatch.status.includes('Clean') ? 'bg-blue-50 border-blue-300 text-blue-900' : 'bg-red-50 border-red-300 text-red-900'}`;
        container.innerHTML = `<div class="flex items-center gap-2 font-bold text-sm mb-2"><i class="fa-solid fa-mobile text-lg"></i> DEVICE STATUS: ${devMatch.status}</div><div><strong>Device Model:</strong> ${devMatch.model}</div><div><strong>${devMatch.idType||'IMEI'}:</strong> ${devMatch.imei}</div><div><strong>Registered Vendor:</strong> ${devMatch.owner}</div>${devMatch.customerName?`<div><strong>Owner:</strong> ${devMatch.customerName}</div>`:''}`;
    } else {
        container.className = "mt-6 text-left border rounded-xl p-4 bg-red-50 border-red-300 text-red-900 text-xs";
        container.innerHTML = `<div class="font-bold text-sm mb-1"><i class="fa-solid fa-circle-xmark"></i> NOT FOUND / UNLICENSED</div><p>No active record matching "${q}" was found in the BITDA central registry.</p>`;
    }
}

function runModalQuickCheck() {
    const val = document.getElementById('quickModalInput').value;
    document.getElementById('publicSearchQuery').value = val;
    closeModal('quickCheckModal');
    switchTab('verifier');
    runPublicVerification();
}

function filterBusinesses() {
    const query = document.getElementById('bizSearchInput').value.toLowerCase();
    const lga = document.getElementById('bizLgaFilter').value;
    const filtered = businesses.filter(b => {
        const matchesQuery = b.name.toLowerCase().includes(query) || b.id.toLowerCase().includes(query) || b.cac.toLowerCase().includes(query);
        const matchesLga = !lga || b.lga === lga;
        return matchesQuery && matchesLga;
    });
    document.getElementById('businessTableBody').innerHTML = filtered.map(b => bizRow(b)).join('');
}

function flagDevice(imei) {
    const dev = devices.find(d => d.imei === imei);
    if(dev) {
        dev.status = "FLAGGED STOLEN";
        saveStore(STORE_KEYS.devices, devices);
        transactions.push({ id: 'TX-' + Math.floor(Math.random()*1000000), type: 'phone_tracking', amount: 500000, date: new Date().toISOString().split('T')[0], lga: 'Makurdi', entityId: dev.id });
        saveStore(STORE_KEYS.transactions, transactions);
        renderDevices();
        alert(`Device IMEI ${imei} has been flagged as STOLEN. Broadcast sent to CEIR and law enforcement.`);
    }
}

// ============ BOOT ============
window.onload = function() {
    populateLGAs();
    buildCompanyDocFields();
    initApp();
};

// ============ OPTIONAL EXPRESS API BRIDGE ============
// The prototype remains usable from file:// and when the API is offline. When
// served by server.js, authentication and registry mutations use the SQLite API.
const BTRCP_API_TOKEN_KEY = 'btrcp_api_token';
let btrcpApiMode = false;
const legacyHandlers = {
    handleLogin, handleRegister, handlePasswordRecovery, handlePasswordChange,
    handleCreateAdmin, setCompanySuspension, activateLicense, handleNewDevice,
    handleCompanyDevice, handleLinkDevice, unlinkDevice, updateAdminRole, handleNewBusiness,
    flagDevice, runPublicVerification, logout
};

function apiNetworkError(error) {
    return error && (error.name === 'TypeError' || error.code === 'NETWORK_ERROR');
}

async function btrcpApi(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body && typeof options.body !== 'string') {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }
    const token = localStorage.getItem(BTRCP_API_TOKEN_KEY);
    if (token) headers.Authorization = 'Bearer ' + token;
    let response;
    try {
        response = await fetch('/api' + path, { ...options, headers });
    } catch (error) {
        error.code = 'NETWORK_ERROR';
        throw error;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.error || 'The server rejected the request.');
        error.status = response.status;
        throw error;
    }
    return data;
}

function applyApiState(data) {
    if (!data) return;
    if (data.accounts) accounts = data.accounts;
    if (data.licenses) licenses = data.licenses;
    if (data.devices) devices = data.devices;
    if (data.businesses) businesses = data.businesses;
    if (data.complaints) complaints = data.complaints;
    if (data.transfers) transfers = data.transfers;
    if (data.transactions) transactions = data.transactions;
    if (data.user) {
        currentUser = data.user;
        session = { id: data.user.id, ts: Date.now() };
        saveStore(STORE_KEYS.session, session);
    }
}

async function refreshApiState() {
    const data = await btrcpApi('/bootstrap');
    applyApiState(data);
    renderAll();
    if (currentUser) {
        if (currentUser.type === 'company') renderCompanyPortal();
        if (currentUser.type === 'customer') renderCustomerPortal();
    }
    return data;
}

function showApiError(error, fallbackMessage) {
    return error && error.message ? error.message : fallbackMessage;
}

window.logout = function() {
    if (btrcpApiMode) localStorage.removeItem(BTRCP_API_TOKEN_KEY);
    return legacyHandlers.logout();
};

window.handleLogin = async function(e) {
    e.preventDefault();
    if (!btrcpApiMode) return legacyHandlers.handleLogin(e);
    const errBox = document.getElementById('loginError');
    errBox.classList.add('hidden');
    try {
        const data = await btrcpApi('/auth/login', {
            method: 'POST',
            body: {
                email: document.getElementById('login-email').value.trim().toLowerCase(),
                password: document.getElementById('login-password').value
            }
        });
        localStorage.setItem(BTRCP_API_TOKEN_KEY, data.token);
        await refreshApiState();
        initApp();
    } catch (error) {
        if (apiNetworkError(error)) return legacyHandlers.handleLogin(e);
        errBox.textContent = showApiError(error, 'Unable to sign in.');
        errBox.classList.remove('hidden');
    }
};

window.handleRegister = async function(e) {
    e.preventDefault();
    if (!btrcpApiMode) return legacyHandlers.handleRegister(e);
    const errBox = document.getElementById('regError');
    errBox.classList.add('hidden');
    const type = document.querySelector('input[name="reg-type"]:checked').value;
    const payload = {
        type,
        nin: document.getElementById('reg-nin').value.trim(),
        name: document.getElementById('reg-name').value.trim(),
        email: document.getElementById('reg-email').value.trim().toLowerCase(),
        phone: document.getElementById('reg-phone').value.trim(),
        password: document.getElementById('reg-password').value,
        lga: type === 'company' ? document.getElementById('reg-lga').value : 'Makurdi',
        cac: type === 'company' ? document.getElementById('reg-cac').value.trim() : '',
        representativeName: type === 'company' ? document.getElementById('reg-rep-name').value.trim() : '',
        documents: type === 'company' ? { ...uploadedDocs } : {}
    };
    if (payload.password !== document.getElementById('reg-password2').value) {
        errBox.textContent = 'Passwords do not match.';
        errBox.classList.remove('hidden');
        return;
    }
    try {
        const data = await btrcpApi('/auth/register', { method: 'POST', body: payload });
        localStorage.setItem(BTRCP_API_TOKEN_KEY, data.token);
        await refreshApiState();
        Object.keys(uploadedDocs).forEach(key => delete uploadedDocs[key]);
        initApp();
    } catch (error) {
        if (apiNetworkError(error)) return legacyHandlers.handleRegister(e);
        errBox.textContent = showApiError(error, 'Unable to create account.');
        errBox.classList.remove('hidden');
    }
};

window.handlePasswordRecovery = async function(e) {
    e.preventDefault();
    if (!btrcpApiMode) return legacyHandlers.handlePasswordRecovery(e);
    try {
        await btrcpApi('/auth/recover', {
            method: 'POST',
            body: {
                email: document.getElementById('recovery-email').value.trim().toLowerCase(),
                phone: document.getElementById('recovery-phone').value.trim(),
                newPassword: document.getElementById('recovery-new-password').value
            }
        });
        showResult('recoveryResult', 'Password reset successfully. You can now sign in.', true);
    } catch (error) {
        if (apiNetworkError(error)) return legacyHandlers.handlePasswordRecovery(e);
        showResult('recoveryResult', showApiError(error, 'Password recovery failed.'), false);
    }
};

window.handlePasswordChange = async function(e) {
    e.preventDefault();
    if (!btrcpApiMode) return legacyHandlers.handlePasswordChange(e);
    const nextPassword = document.getElementById('settings-new-password').value;
    if (nextPassword !== document.getElementById('settings-confirm-password').value) {
        return showResult('settingsResult', 'New passwords do not match.', false);
    }
    try {
        await btrcpApi('/auth/change-password', {
            method: 'POST',
            body: {
                currentPassword: document.getElementById('settings-current-password').value,
                newPassword: nextPassword
            }
        });
        ['settings-current-password', 'settings-new-password', 'settings-confirm-password'].forEach(id => { document.getElementById(id).value = ''; });
        showResult('settingsResult', 'Password changed successfully.', true);
    } catch (error) {
        if (apiNetworkError(error)) return legacyHandlers.handlePasswordChange(e);
        showResult('settingsResult', showApiError(error, 'Password change failed.'), false);
    }
};

window.handleCreateAdmin = async function(e) {
    e.preventDefault();
    if (!btrcpApiMode) return legacyHandlers.handleCreateAdmin(e);
    try {
        await btrcpApi('/admin/accounts', {
            method: 'POST',
            body: {
                name: document.getElementById('admin-name').value.trim(),
                email: document.getElementById('admin-email').value.trim().toLowerCase(),
                password: document.getElementById('admin-password').value,
                role: document.getElementById('admin-role').value
            }
        });
        e.target.reset();
        await refreshApiState();
        renderAdminAccounts();
        alert('Admin account created successfully.');
    } catch (error) {
        if (apiNetworkError(error)) return legacyHandlers.handleCreateAdmin(e);
        alert(showApiError(error, 'Unable to create admin account.'));
    }
};

window.updateAdminRole = async function(id, role) {
    if (!btrcpApiMode) return legacyHandlers.updateAdminRole(id, role);
    try {
        await btrcpApi('/admin/accounts/' + encodeURIComponent(id) + '/role', { method: 'PATCH', body: { role } });
        await refreshApiState();
        renderAdminAccounts();
    } catch (error) {
        if (apiNetworkError(error)) return legacyHandlers.updateAdminRole(id, role);
        alert(showApiError(error, 'Unable to update administrator role.'));
    }
};

window.setCompanySuspension = async function(companyId, suspended) {
    if (!btrcpApiMode) return legacyHandlers.setCompanySuspension(companyId, suspended);
    if (!currentUser || currentUser.type !== 'admin' || !['master_admin', 'license_renewal'].includes(currentUser.role)) {
        alert('Only an authorized license administrator can change company enforcement status.');
        return;
    }
    const reason = suspended ? prompt('Enter the violation reason:') : '';
    if (suspended && !reason) return;
    const license = licenses.find(item => item.companyId === companyId);
    if (!license) return;
    try {
        await btrcpApi('/licenses/' + encodeURIComponent(license.id) + '/suspension', { method: 'PATCH', body: { suspended, reason } });
        await refreshApiState();
        renderLicenseManagement();
        alert(suspended ? 'Company device registration and linking have been suspended.' : 'Company device operations have been restored.');
    } catch (error) {
        if (apiNetworkError(error)) return legacyHandlers.setCompanySuspension(companyId, suspended);
        alert(showApiError(error, 'Unable to update company enforcement status.'));
    }
};

window.activateLicense = async function(licenseId) {
    if (!btrcpApiMode) return legacyHandlers.activateLicense(licenseId);
    try {
        await btrcpApi('/licenses/' + encodeURIComponent(licenseId) + '/activate', { method: 'PATCH' });
        await refreshApiState();
        renderLicenseManagement();
        alert('License ' + licenseId + ' activated successfully.');
    } catch (error) {
        if (apiNetworkError(error)) return legacyHandlers.activateLicense(licenseId);
        alert(showApiError(error, 'Unable to activate license.'));
    }
};

window.handleNewBusiness = async function(e) {
    e.preventDefault();
    if (!btrcpApiMode) return legacyHandlers.handleNewBusiness(e);
    try {
        const data = await btrcpApi('/licenses', {
            method: 'POST',
            body: {
                name: document.getElementById('form-biz-name').value.trim(),
                category: document.getElementById('form-biz-cat').value,
                lga: document.getElementById('form-biz-lga').value,
                cac: document.getElementById('form-biz-cac').value.trim() || 'RC-PENDING'
            }
        });
        await refreshApiState();
        closeModal('newBusinessModal');
        e.target.reset();
        viewCertificate(data.license.id);
    } catch (error) {
        if (apiNetworkError(error)) return legacyHandlers.handleNewBusiness(e);
        alert(showApiError(error, 'Unable to create license.'));
    }
};

window.handleNewDevice = async function(e) {
    e.preventDefault();
    if (!btrcpApiMode) return legacyHandlers.handleNewDevice(e);
    try {
        const data = await btrcpApi('/devices', {
            method: 'POST',
            body: {
                model: document.getElementById('form-dev-model').value.trim(),
                category: document.getElementById('form-dev-cat').value,
                imei: document.getElementById('form-dev-imei').value.trim(),
                owner: document.getElementById('form-dev-owner').value.trim()
            }
        });
        await refreshApiState();
        closeModal('newDeviceModal');
        e.target.reset();
        alert(`Device Registered Successfully!\nUnique ID: ${data.device.id}\nIMEI Tagged: ${data.device.imei}\nFee Paid: ₦1,000`);
    } catch (error) {
        if (apiNetworkError(error)) return legacyHandlers.handleNewDevice(e);
        alert(showApiError(error, 'Unable to register device.'));
    }
};

window.handleCompanyDevice = async function(e) {
    e.preventDefault();
    if (!btrcpApiMode) return legacyHandlers.handleCompanyDevice(e);
    try {
        const data = await btrcpApi('/devices', {
            method: 'POST',
            body: {
                model: document.getElementById('cmp-dev-model').value.trim(),
                category: document.getElementById('cmp-dev-cat').value,
                imei: document.getElementById('cmp-dev-imei').value.trim(),
                idType: document.getElementById('cmp-dev-idtype').value,
                condition: document.getElementById('cmp-dev-condition').value
            }
        });
        await refreshApiState();
        closeModal('companyDeviceModal');
        e.target.reset();
        alert(`Device ${data.device.id} registered successfully! Fee: ₦1,000. You can now link it to a customer.`);
    } catch (error) {
        if (apiNetworkError(error)) return legacyHandlers.handleCompanyDevice(e);
        alert(showApiError(error, 'Unable to register device.'));
    }
};

window.handleLinkDevice = async function(e) {
    e.preventDefault();
    if (!btrcpApiMode) return legacyHandlers.handleLinkDevice(e);
    if (!verifiedLinkCustomer) return alert('Please search and verify a customer by NIN and Account ID first.');
    try {
        const deviceId = document.getElementById('link-device-select').value;
        await btrcpApi('/devices/' + encodeURIComponent(deviceId) + '/link', {
            method: 'PATCH',
            body: {
                customerId: verifiedLinkCustomer.id,
                nin: verifiedLinkCustomer.nin,
                purchaseDate: document.getElementById('link-purchase-date').value
            }
        });
        await refreshApiState();
        closeModal('linkDeviceModal');
        alert('Device linked successfully.');
    } catch (error) {
        if (apiNetworkError(error)) return legacyHandlers.handleLinkDevice(e);
        alert(showApiError(error, 'Unable to link device.'));
    }
};

window.unlinkDevice = async function(deviceId) {
    if (!btrcpApiMode) return legacyHandlers.unlinkDevice(deviceId);
    if (!confirm('Unlink this device from the customer?')) return;
    try {
        await btrcpApi('/devices/' + encodeURIComponent(deviceId) + '/unlink', { method: 'PATCH' });
        await refreshApiState();
    } catch (error) {
        if (apiNetworkError(error)) return legacyHandlers.unlinkDevice(deviceId);
        alert(showApiError(error, 'Unable to unlink device.'));
    }
};

window.flagDevice = async function(imei) {
    if (!btrcpApiMode) return legacyHandlers.flagDevice(imei);
    const device = devices.find(item => item.imei === imei);
    if (!device) return;
    try {
        await btrcpApi('/devices/' + encodeURIComponent(device.id) + '/flag', { method: 'PATCH' });
        await refreshApiState();
        alert(`Device IMEI ${imei} has been flagged as STOLEN.`);
    } catch (error) {
        if (apiNetworkError(error)) return legacyHandlers.flagDevice(imei);
        alert(showApiError(error, 'Unable to flag device.'));
    }
};

window.runPublicVerification = async function() {
    if (!btrcpApiMode) return legacyHandlers.runPublicVerification();
    const query = document.getElementById('publicSearchQuery').value.trim();
    const container = document.getElementById('publicVerificationResult');
    if (!query) return;
    try {
        const data = await btrcpApi('/public/verify?q=' + encodeURIComponent(query));
        const record = data.record;
        const flagged = data.flagged;
        container.className = flagged ? 'mt-6 text-left border rounded-xl p-4 bg-red-50 border-red-400 text-red-900 text-xs' : 'mt-6 text-left border rounded-xl p-4 bg-emerald-50 border-emerald-300 text-emerald-900 text-xs';
        if (data.kind === 'device') {
            container.innerHTML = `<div class="font-bold text-sm mb-2">DEVICE STATUS: ${record.status}</div><div>Model: <strong>${record.model}</strong></div><div>${record.idType}: <span class="font-mono">${record.imei}</span></div><div>Registered Vendor: ${record.owner}</div>`;
        } else {
            container.innerHTML = `<div class="font-bold text-sm mb-2">${flagged ? 'CERTIFICATE FLAGGED — COMPLIANCE ACTION REQUIRED' : 'VERIFIED LICENSED OPERATOR'}</div><div class="grid grid-cols-2 gap-2"><div><strong>Business Entity:</strong> ${record.companyName || record.name}</div><div><strong>License Code:</strong> ${record.id}</div><div><strong>LGA Location:</strong> ${record.lga}</div><div><strong>Status:</strong> ${record.flagReason || record.status || 'Active'}</div></div>`;
        }
        container.classList.remove('hidden');
    } catch (error) {
        if (apiNetworkError(error)) return legacyHandlers.runPublicVerification();
        container.className = 'mt-6 text-left border rounded-xl p-4 bg-red-50 border-red-300 text-red-900 text-xs';
        container.textContent = error.status === 404 ? 'NOT FOUND / UNLICENSED — No active record was found.' : showApiError(error, 'Verification failed.');
        container.classList.remove('hidden');
    }
};

window.onload = async function() {
    populateLGAs();
    buildCompanyDocFields();
    if (location.protocol === 'http:' || location.protocol === 'https:') {
        try {
            const health = await fetch('/api/health');
            if (!health.ok) throw new Error('API health check failed');
            btrcpApiMode = true;
            if (localStorage.getItem(BTRCP_API_TOKEN_KEY)) {
                try {
                    await refreshApiState();
                    initApp();
                } catch (error) {
                    if (error.status === 401) {
                        localStorage.removeItem(BTRCP_API_TOKEN_KEY);
                        session = null;
                        showAuth();
                    } else {
                        btrcpApiMode = false;
                        initApp();
                    }
                }
            } else {
                session = null;
                showAuth();
            }
            return;
        } catch (_) {
            btrcpApiMode = false;
        }
    }
    initApp();
};
