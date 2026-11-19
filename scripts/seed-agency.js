#!/usr/bin/env node
// Builds your own agency website from agency/agency.json, filling in your studio name,
// contact details and package prices from the Pricing page (data/pricing.json).
//
//   npm run agency              create or update the agency project in SiteKit
//   npm run agency -- --push    ...and push it to its staging site
//
// Change your name, contact details or prices on the Pricing page, then run it again.
const fs = require('fs');
const path = require('path');
const store = require('../src/store');
const pricing = require('../src/pricing');
const { parseIntake } = require('../src/intake');
const { dimensions } = require('../src/images');
const { intakeFingerprint } = require('../src/copywriter');
const { PHASES } = require('../src/phases');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'agency');
const UPLOADS = path.join(ROOT, 'uploads');
const push = process.argv.includes('--push');

// Placeholders used until the Pricing page has real details (reserved fictional ranges).
const PLACEHOLDER = { name: 'Your Studio', email: 'hello@example.com', phone: '+977 1-555-0199' };

function values() {
  const settings = pricing.load();
  const ready = settings.hourlyRate > 0;
  const price = (id) => {
    const pkg = settings.packages.find((p) => p.id === id);
    return ready && pkg ? pricing.money(settings, pricing.quote(settings, pkg).price) : 'a fixed quote';
  };
  return {
    name: settings.studio.name || PLACEHOLDER.name,
    email: settings.studio.email || PLACEHOLDER.email,
    phone: settings.studio.phone || PLACEHOLDER.phone,
    starter: price('starter'),
    standard: price('standard'),
    plus: price('plus'),
    care: ready ? pricing.money(settings, pricing.careQuote(settings).price) : 'a fixed fee',
    placeholders: Object.keys(PLACEHOLDER).filter((k) => !settings.studio[k]),
    ready,
  };
}

// Replaces {token} in every string of a JSON value.
function fill(value, v) {
  if (typeof value === 'string') return value.replace(/\{(\w+)\}/g, (m, k) => (typeof v[k] === 'string' ? v[k] : m));
  if (Array.isArray(value)) return value.map((x) => fill(x, v));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, x]) => [k, fill(x, v)]));
  return value;
}

function fileRecord(projectId, file, alt) {
  const dir = path.join(UPLOADS, projectId);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(SRC, file), path.join(dir, file));
  const dims = dimensions(path.join(dir, file));
  return {
    stored: file,
    original: file,
    mime: file.endsWith('.png') ? 'image/png' : 'image/jpeg',
    size: fs.statSync(path.join(SRC, file)).size,
    width: dims?.width || null,
    height: dims?.height || null,
    alt,
  };
}

async function main() {
  const v = values();
  const site = fill(JSON.parse(fs.readFileSync(path.join(SRC, 'agency.json'), 'utf8')), v);
  const intake = parseIntake(site.intake);

  let project = store.get(site.id);
  const isNew = !project;
  if (isNew) project = store.create(intake, { id: site.id });

  intake.logo = fileRecord(project.id, 'logo.png', `${intake.businessName} logo`);
  const photos = fs.readdirSync(SRC).filter((f) => /^photo-\d+\.jpg$/.test(f)).sort();
  const alts = ['Laptop on a desk', 'Restaurant website example', 'Hospital website example', 'Clothing brand website example', 'Trekking agency website example', 'College website example'];
  intake.media = photos.map((f, i) => fileRecord(project.id, f, alts[i] || `${intake.businessName} photo ${i + 1}`));
  project.intake = intake;
  project.agency = true;
  project.copy = {
    data: site.copy,
    model: 'hand-written agency copy',
    generatedAt: new Date().toISOString(),
    fingerprint: intakeFingerprint(intake),
    edited: true,
    editedAt: new Date().toISOString(),
  };
  for (const phase of PHASES.slice(0, 3)) for (const t of phase.tasks) project.checklist[t.id] = true;
  store.save(project);
  console.log(`${isNew ? 'Created' : 'Updated'} your agency site: ${intake.businessName} (${project.id})`);

  if (push) {
    const wordpress = require('../src/wordpress');
    const status = await wordpress.status();
    if (!status.ok) {
      console.error(`Can't push: ${status.message}`);
      process.exit(1);
    }
    const log = await wordpress.pushProject(project);
    project.checklist['build-push'] = true;
    store.save(project);
    console.log(`  pushed to ${project.wordpress.siteUrl}/ (${log.length} steps)`);
  }
  if (!v.ready) console.log('\nNote: no hourly rate set on the Pricing page, so the site says "a fixed quote" instead of prices.');
  if (v.placeholders.length) {
    console.log(`\nStill placeholders: ${v.placeholders.join(', ')}. Fill them in under "Your details" on the Pricing page,`);
    console.log('then run: npm run agency -- --push');
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
