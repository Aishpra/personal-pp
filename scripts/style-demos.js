#!/usr/bin/env node
// Renders one sample business in every design style, for the "same business, five looks"
// switcher on the agency site. Each style gets a temporary project and staging site.
//
//   node scripts/style-demos.js push [sample-id]   create + push the temporary sites
//   node scripts/style-demos.js clean              delete the temporary projects (and sites)
//
// Screenshots are taken separately (see the README); this script only manages the sites.
const fs = require('fs');
const path = require('path');
const store = require('../src/store');

const UPLOADS = path.join(__dirname, '..', 'uploads');
const { DESIGN_STYLES } = require('../src/intake');

const PREFIX = 'styledemo-';
const [cmd, sampleId = 'sample-thakali-hearth'] = process.argv.slice(2);

async function push() {
  const wordpress = require('../src/wordpress');
  const base = store.get(sampleId);
  if (!base) throw new Error(`Sample "${sampleId}" not found. Run: npm run samples`);
  for (const style of DESIGN_STYLES) {
    const id = `${PREFIX}${style}`;
    const project = JSON.parse(JSON.stringify(base));
    project.id = id;
    project.intake.style = style;
    project.sample = true;
    project.styleDemo = true;
    project.wordpress = store.get(id)?.wordpress || {}; // its own staging site and media (kept on re-runs)
    fs.cpSync(path.join(UPLOADS, sampleId), path.join(UPLOADS, id), { recursive: true });
    store.save(project);
    await wordpress.pushProject(project);
    store.save(project);
    console.log(`${style}: ${project.wordpress.siteUrl}/`);
  }
}

function clean() {
  const { execFileSync } = require('child_process');
  for (const style of DESIGN_STYLES) {
    const id = `${PREFIX}${style}`;
    store.remove(id);
    fs.rmSync(path.join(UPLOADS, id), { recursive: true, force: true });
    try {
      execFileSync('docker', ['compose', 'run', '--rm', 'cli', 'wp', 'site', 'delete', `--slug=${id}`, '--yes'], { stdio: 'ignore' });
      console.log(`removed ${id}`);
    } catch {
      console.log(`removed project ${id} (staging site not found or Docker not reachable)`);
    }
  }
}

(cmd === 'push' ? push() : cmd === 'clean' ? Promise.resolve(clean()) : Promise.reject(new Error('usage: style-demos.js push|clean')))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
