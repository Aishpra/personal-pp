const test = require('node:test');
const assert = require('node:assert');
const automation = require('../src/automation');
const docsViews = require('../src/docs-views');

const settings = {
  currency: 'NPR',
  hourlyRate: 1000,
  bufferPercent: 0,
  studio: { name: 'Test Studio', email: 'a@b.c' },
  packages: [
    { id: 'starter', name: 'Starter', pages: 1, revisionRounds: 1, hours: { build: 10 }, summary: 'One page.' },
    { id: 'standard', name: 'Standard', pages: 5, revisionRounds: 2, hours: { build: 30 }, summary: 'Five pages.' },
    { id: 'plus', name: 'Plus', pages: 8, revisionRounds: 3, hours: { build: 50 }, summary: 'More.' },
  ],
};
const project = () => ({
  id: 'momo-mandala-abc123',
  intake: { businessName: 'Momo Mandala', email: 'x@y.z', location: 'Thamel', pages: ['about', 'services', 'contact'], style: 'organic' },
});

test('package follows the number of pages', () => {
  assert.equal(automation.packageFor({ pages: ['contact'] }), 'starter');
  assert.equal(automation.packageFor({ pages: ['about', 'services', 'contact'] }), 'standard');
  assert.equal(automation.packageFor({ pages: ['a', 'b', 'c', 'd', 'e', 'f'] }), 'plus');
});

test('documents: deposit and final add up to the total, and are not regenerated', () => {
  const p = project();
  automation.makeDocuments(p, settings);
  const { proposal, deposit } = p.documents;
  assert.equal(proposal.packageId, 'standard');
  assert.ok(proposal.total > 0);
  assert.match(proposal.number, /^Q-\d{8}-C123$/);
  automation.makeFinalInvoice(p);
  assert.equal(deposit.amount + p.documents.final.amount, proposal.total);
  const before = proposal.number;
  automation.makeDocuments(p, settings);
  assert.equal(p.documents.proposal.number, before);
});

test('review token is 32 hex characters and stable', () => {
  const p = project();
  const t = automation.ensureReviewToken(p);
  assert.match(t, /^[a-f0-9]{32}$/);
  assert.equal(automation.ensureReviewToken(p), t);
});

test('proposal and invoice render and escape client text', () => {
  const p = project();
  p.intake.businessName = 'Momo <b>Mandala</b>';
  automation.makeDocuments(p, settings);
  const html = docsViews.proposal(p, '/back', settings);
  assert.ok(html.includes('Momo &lt;b&gt;Mandala&lt;/b&gt;'));
  assert.ok(html.includes('Test Studio'));
  assert.ok(docsViews.invoice(p, 'deposit', '/back', settings).includes(p.documents.deposit.number));
});
