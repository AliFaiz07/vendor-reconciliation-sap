/**
 * auth-handler.js
 *
 * Handles authentication actions for the Vendor Reconciliation application.
 *
 * DEMO MODE: Uses demo persona profiles for zero-friction demo login.
 * PRODUCTION: Replace with real SAP IAS / JWT authentication.
 */
const cds = require('@sap/cds');
const crypto = require('crypto');

function hash(pw) { return crypto.createHash('sha256').update(pw).digest('hex'); }

const fs = require('fs');
const path = require('path');

/**
 * [DEMO] Predefined persona profiles.
 * These are DEMO ONLY — no real SAP users or authorizations.
 *
 * TO BE REPLACED in production with:
 *   - SAP IAS OAuth2/OIDC
 *   - SAP BTP JWT authentication
 *   - Real PFCG role assignments
 */
const DEMO_PERSONAS = {
  'admin': {
    username: 'admin',
    fullName: 'Rahul Sharma',
    businessRole: 'AP',
    email: 'ap.manager@company.com',
    vendorCode: null,
    description: 'Accounts Payable Manager — Full cockpit access, payment run, admin',
    icon: 'sap-icon://manager'
  },
  'finance': {
    username: 'finance',
    fullName: 'Priya Mehta',
    businessRole: 'FINANCE',
    email: 'finance@company.com',
    vendorCode: null,
    description: 'Finance Executive — MIRO, reconciliation, invoice verification',
    icon: 'sap-icon://accounting-document-verification'
  },
  'gr_user': {
    username: 'gr_user',
    fullName: 'Suresh Kumar',
    businessRole: 'GR',
    email: 'gr@company.com',
    vendorCode: null,
    description: 'Goods Receipt Specialist — MIGO, GR workbench',
    icon: 'sap-icon://inventory'
  },
  'po_user': {
    username: 'po_user',
    fullName: 'Anita Desai',
    businessRole: 'PO',
    email: 'po@company.com',
    vendorCode: null,
    description: 'PO Officer — Purchase orders, supplier management',
    icon: 'sap-icon://sales-order'
  },
  'pr_user': {
    username: 'pr_user',
    fullName: 'Vikram Singh',
    businessRole: 'PR',
    email: 'pr@company.com',
    vendorCode: null,
    description: 'PR Indenter — Purchase requisitions',
    icon: 'sap-icon://add-document'
  },
  'vendor_ar': {
    username: 'V-1001',
    fullName: 'Sigma Components — AR Team',
    businessRole: 'AR',
    email: 'ar@sigma-components.com',
    vendorCode: 'V-1001',
    description: 'Vendor AR — Invoice submission, dispute management',
    icon: 'sap-icon://supplier'
  },
  'vendor_billing': {
    username: 'V-1002',
    fullName: 'Apex Steel — Billing Team',
    businessRole: 'BILLING',
    email: 'billing@apex-steel.com',
    vendorCode: 'V-1002',
    description: 'Vendor Billing — Statement upload, reconciliation view',
    icon: 'sap-icon://text-formatting'
  },
  'supervisor': {
    username: 'supervisor',
    fullName: 'Kavita Nair',
    businessRole: 'AP',
    email: 'supervisor@company.com',
    vendorCode: null,
    description: 'Supervisor / Auditor — Full read access, audit trail',
    icon: 'sap-icon://inspect'
  }
};

function appendUserToCsv(user) {
  try {
    const csvPath = path.join(__dirname, '..', '..', 'db', 'data', 'vendorrecon.db-Users.csv');
    if (!fs.existsSync(csvPath)) {
      const header = 'ID,username,email,passwordHash,fullName,businessRole,vendorCode\n';
      fs.writeFileSync(csvPath, header, 'utf8');
    }

    let content = fs.readFileSync(csvPath, 'utf8');

    // Check if username already exists in CSV
    if (content.includes(`,${user.username},`)) {
      return;
    }

    let prefix = '';
    if (content.length > 0 && !content.endsWith('\n') && !content.endsWith('\r')) {
      prefix = '\n';
    }

    const escapedFullName = user.fullName ? `"${user.fullName.replace(/"/g, '""')}"` : '';
    const line = `${prefix}${user.ID},${user.username},${user.email},${user.passwordHash},${escapedFullName},${user.businessRole},${user.vendorCode || ''}\n`;

    fs.appendFileSync(csvPath, line, 'utf8');
  } catch (err) {
    console.error('Failed to append registered user to CSV:', err);
  }
}

module.exports = (srv) => {

  /**
   * [DEMO] Zero-friction persona login.
   *
   * Validates a personaKey against the DEMO_PERSONAS config.
   * Returns a user profile WITHOUT requiring a password.
   *
   * DEMO MODE ONLY — do not use in production without JWT replacement.
   *
   * Usage: POST /api/v1/demoLogin { personaKey: "admin" }
   * Response: { fullName, businessRole, vendorCode, demoMode: true, ... }
   */
  srv.on('demoLogin', async (req) => {
    const { personaKey } = req.data;
    if (!personaKey) return req.error(400, 'personaKey is required');

    const persona = DEMO_PERSONAS[personaKey];
    if (!persona) {
      return req.error(404, `Demo persona '${personaKey}' not found. Valid keys: ${Object.keys(DEMO_PERSONAS).join(', ')}`);
    }

    const { Users } = cds.entities;

    // Find or auto-create the demo user in the database
    let user = await SELECT.one.from(Users).where({ username: persona.username });
    if (!user) {
      const id = cds.utils.uuid();
      await INSERT.into(Users).entries({
        ID: id,
        username: persona.username,
        email: persona.email,
        fullName: persona.fullName,
        businessRole: persona.businessRole,
        vendorCode: persona.vendorCode,
        passwordHash: hash('demo_' + personaKey + '_' + id.slice(0, 8))
      });
      user = {
        ID: id,
        username: persona.username,
        email: persona.email,
        fullName: persona.fullName,
        businessRole: persona.businessRole,
        vendorCode: persona.vendorCode
      };
    }

    // Never expose password hash
    delete user.passwordHash;

    const result = {
      ...user,
      personaKey,
      demoMode: true,
      demoLabel: '[DEMO MODE]',
      demoDescription: persona.description
    };

    console.log(`[DEMO] demoLogin: personaKey="${personaKey}" → ${user.fullName} (${user.businessRole})`);
    return JSON.stringify(result);
  });

  /**
   * Register a new user account.
   * Persists to SQLite + CSV (for seed persistence across restarts).
   * DEMO: Not needed when using demoLogin, but kept for custom credential flows.
   */
  srv.on('register', async (req) => {
    const username = req.data.username?.trim();
    const email = req.data.email?.trim();
    const password = req.data.password;
    const fullName = req.data.fullName?.trim();
    const businessRole = req.data.businessRole?.trim();
    const vendorCode = req.data.vendorCode?.trim();

    if (!username || !password) return req.error(400, 'Username and password are required');

    const { Users } = cds.entities;
    const existing = await SELECT.one.from(Users).where({ username });
    if (existing) return req.error(400, 'Username already exists');

    const resolvedVendorCode = vendorCode || (['AR', 'BILLING', 'VENDOR'].includes(businessRole) ? username : null);

    const id = cds.utils.uuid();
    const passwordHash = hash(password);

    await INSERT.into(Users).entries({
      ID: id, username, email, fullName, businessRole,
      vendorCode: resolvedVendorCode,
      passwordHash
    });

    appendUserToCsv({
      ID: id, username, email, passwordHash, fullName,
      businessRole, vendorCode: resolvedVendorCode
    });

    return 'Registered';
  });

  /**
   * Standard username + password login.
   * Returns user profile on success; 401 on failure.
   *
   * DEMO NOTE: SHA-256 without salt. For production use bcrypt.
   */
  srv.on('login', async (req) => {
    const username = req.data.username?.trim();
    const password = req.data.password;
    const { Users } = cds.entities;

    console.log(`[auth-handler] Login attempt: "${username}"`);

    const user = await SELECT.one.from(Users).where({ username, passwordHash: hash(password) });
    if (!user) {
      console.log(`[auth-handler] Login failed: "${username}"`);
      return req.error(401, 'Invalid credentials');
    }

    console.log(`[auth-handler] Login success: "${username}" | Role: ${user.businessRole} | Vendor: ${user.vendorCode || 'N/A'}`);
    delete user.passwordHash;
    return JSON.stringify(user);
  });
};