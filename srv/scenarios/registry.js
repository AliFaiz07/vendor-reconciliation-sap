const { evaluateTC001 } = require('./tc001-standard-match');
const { evaluateTC002 } = require('./tc002-invoice-qty-less-than-gr');
const { evaluateTC003 } = require('./tc003-invoice-qty-more-than-gr');
const { evaluateTC004 } = require('./tc004-invoice-price-higher-than-po');

const scenarios = [evaluateTC001, evaluateTC002, evaluateTC003, evaluateTC004];

async function runScenarios(vendorLine, poRecord, grirRow) {
  for (const scenario of scenarios) {
    const result = await scenario(vendorLine, poRecord, grirRow);
    if (result) return result;
  }
  return null;
}

module.exports = { runScenarios };