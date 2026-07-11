const { evaluateTC001 } = require('./tc001-standard-match');
const { evaluateTC002 } = require('./tc002-invoice-qty-less-than-gr');
const { evaluateTC003 } = require('./tc003-invoice-qty-more-than-gr');
const { evaluateTC004 } = require('./tc004-invoice-price-higher-than-po');
const { evaluateTC005 } = require('./tc005-missing-gr');
const { evaluateTC006 } = require('./tc006-gst-2b-gap');
const { evaluateTC007 } = require('./tc007-tds-194q');
const { evaluateTC008 } = require('./tc008-payment-in-transit');
const { evaluateTC009 } = require('./tc009-credit-note-missing');
const { evaluateTC010 } = require('./tc010-fx-revaluation');

const scenarios = [
  evaluateTC005,
  evaluateTC006,
  evaluateTC007,
  evaluateTC008,
  evaluateTC009,
  evaluateTC010,
  evaluateTC001,
  evaluateTC002,
  evaluateTC003,
  evaluateTC004
];

async function runScenarios(vendorLine, poRecord, grirRow, candidates) {
  for (const scenario of scenarios) {
    const result = await scenario(vendorLine, poRecord, grirRow, candidates);
    if (result) return result;
  }
  return null;
}

module.exports = { runScenarios };