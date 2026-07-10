const cds = require('@sap/cds');
const crypto = require('crypto');

function hash(pw) { return crypto.createHash('sha256').update(pw).digest('hex'); }

module.exports = (srv) => {
  srv.on('register', async (req) => {
    const { username, email, password, fullName, businessRole } = req.data;
    const { Users } = cds.entities;
    const existing = await SELECT.one.from(Users).where({ username });
    if (existing) return req.error(400, 'Username already exists');
    await INSERT.into(Users).entries({
      ID: cds.utils.uuid(), username, email, fullName, businessRole,
      passwordHash: hash(password)
    });
    return 'Registered';
  });

  srv.on('login', async (req) => {
    const { username, password } = req.data;
    const { Users } = cds.entities;
    const user = await SELECT.one.from(Users).where({ username, passwordHash: hash(password) });
    if (!user) return req.error(401, 'Invalid credentials');
    return JSON.stringify({ username: user.username, businessRole: user.businessRole, fullName: user.fullName });
  });
};