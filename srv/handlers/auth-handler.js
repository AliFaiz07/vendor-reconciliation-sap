const cds = require('@sap/cds');
const crypto = require('crypto');

function hash(pw) { return crypto.createHash('sha256').update(pw).digest('hex'); }

const fs = require('fs');
const path = require('path');

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
  srv.on('register', async (req) => {
    const username = req.data.username?.trim();
    const email = req.data.email?.trim();
    const password = req.data.password;
    const fullName = req.data.fullName?.trim();
    const businessRole = req.data.businessRole?.trim();
    const vendorCode = req.data.vendorCode?.trim();
    
    const { Users } = cds.entities;
    const existing = await SELECT.one.from(Users).where({ username });
    if (existing) return req.error(400, 'Username already exists');
    
    // Default vendorCode to username if it starts with 'V-' and role is vendor-side
    const resolvedVendorCode = vendorCode || (['AR', 'BILLING', 'VENDOR'].includes(businessRole) ? username : null);
    
    const id = cds.utils.uuid();
    const passwordHash = hash(password);

    await INSERT.into(Users).entries({
      ID: id, username, email, fullName, businessRole,
      vendorCode: resolvedVendorCode,
      passwordHash
    });

    // Save to CSV so it persists across cds watch / redeployment restarts
    appendUserToCsv({
      ID: id,
      username,
      email,
      passwordHash,
      fullName,
      businessRole,
      vendorCode: resolvedVendorCode
    });

    return 'Registered';
  });

  srv.on('login', async (req) => {
    const username = req.data.username?.trim();
    const password = req.data.password;
    const { Users } = cds.entities;
    
    console.log(`[auth-handler] - Login attempt received for username: "${username}"`);
    
    const user = await SELECT.one.from(Users).where({ username, passwordHash: hash(password) });
    if (!user) {
      console.log(`[auth-handler] - Login failed for: "${username}". Password hash mismatch or user does not exist in SQLite.`);
      return req.error(401, 'Invalid credentials');
    }
    
    console.log(`[auth-handler] - Login success: "${username}" | Role: ${user.businessRole} | Vendor: ${user.vendorCode || 'None'}`);
    
    // Remove hash
    delete user.passwordHash;
    
    return JSON.stringify(user);
  });
};