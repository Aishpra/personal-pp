#!/usr/bin/env node
// Loads the three fictional sample businesses in samples/ into SiteKit, with logos,
// photos and finished copy, so you have demo sites to show prospects.
//
//   npm run samples              create or update the sample projects
//   npm run samples -- --push    ...and push each one to its own staging site
//   npm run samples -- --push --only=code-sherpa,hive-cowork    just those samples
//
// Re-running updates the samples in place (same ids), keeping their staging sites.
const fs = require('fs');
const path = require('path');
const store = require('../src/store');
const { parseIntake } = require('../src/intake');
const { dimensions } = require('../src/images');
const { intakeFingerprint } = require('../src/copywriter');
const { PHASES } = require('../src/phases');

const ROOT = path.join(__dirname, '..');
const SAMPLES = path.join(ROOT, 'samples');
const UPLOADS = path.join(ROOT, 'uploads');
const push = process.argv.includes('--push');
// --only=id1,id2 limits the run to those samples (ids with or without the "sample-" prefix).
const onlyArg = process.argv.find((x) => x.startsWith('--only='));
const only = onlyArg ? new Set(onlyArg.slice(7).split(',').map((x) => (x.startsWith('sample-') ? x : `sample-${x}`))) : null;

function fileRecord(projectId, srcPath, storedName, alt) {
  const dir = path.join(UPLOADS, projectId);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(srcPath, path.join(dir, storedName));
  const dims = dimensions(path.join(dir, storedName));
  return {
    stored: storedName,
    original: storedName,
    mime: storedName.endsWith('.png') ? 'image/png' : 'image/jpeg',
    size: fs.statSync(srcPath).size,
    width: dims?.width || null,
    height: dims?.height || null,
    alt,
  };
}

async function main() {
  const { samples } = JSON.parse(fs.readFileSync(path.join(SAMPLES, 'samples.json'), 'utf8'));
  const wordpress = push ? require('../src/wordpress') : null;
  if (push) {
    const status = await wordpress.status();
    if (!status.ok) {
      console.error(`Can't push: ${status.message}`);
      process.exit(1);
    }
  }

  for (const sample of samples) {
    if (only && !only.has(sample.id)) continue;
    const intake = parseIntake(sample.intake);
    const name = intake.businessName;
    const src = path.join(SAMPLES, sample.dir);
    const photos = fs.readdirSync(src).filter((f) => /^photo-\d+\.jpg$/.test(f)).sort();

    let project = store.get(sample.id);
    const isNew = !project;
    if (isNew) project = store.create(intake, { id: sample.id });

    intake.logo = fileRecord(project.id, path.join(src, 'logo.png'), 'logo.png', `${name} logo`);
    intake.media = photos.map((f, i) => fileRecord(project.id, path.join(src, f), f, `${name} photo ${i + 1}`));
    project.intake = intake;
    project.sample = true;
    project.copy = {
      data: sample.copy,
      model: 'hand-written sample copy',
      generatedAt: new Date().toISOString(),
      fingerprint: intakeFingerprint(intake),
      edited: true,
      editedAt: new Date().toISOString(),
    };
    // Bilingual samples carry hand-written Nepali copy too.
    if (sample.copyNe) project.copyNe = { data: sample.copyNe, model: 'hand-written sample copy', generatedAt: new Date().toISOString() };
    else delete project.copyNe;
    // Show the samples part-way through the workflow, as a real project would be.
    for (const phase of PHASES.slice(0, 3)) for (const t of phase.tasks) project.checklist[t.id] = true;
    store.save(project);
    console.log(`${isNew ? 'Created' : 'Updated'} sample: ${name} (${project.id})`);

    if (push) {
      const log = await wordpress.pushProject(project);
      project.checklist['build-push'] = true;
      store.save(project);
      console.log(`  pushed to ${project.wordpress.siteUrl}/ (${log.length} steps)`);
      await require('../src/thumbs').capture(project);
    }
  }
  console.log(push ? '\nDone. Open http://localhost:3000 to see them.' : '\nDone. Push them from SiteKit, or run: npm run samples -- --push');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
