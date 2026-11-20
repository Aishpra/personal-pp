// The automated pipeline. Everything up to launch runs on its own; going live does not
// (you deploy the launch package yourself, when you decide).
//
//   New brief  -> proposal + deposit invoice -> review link -> AI copy (if the model is
//                 installed) -> build on staging -> email draft to the client (outbox)
//   Approval   -> final invoice -> launch package (site files, plugin zips, checklist)
//                 -> email draft to the client
//
// Steps run one project at a time in the background and are logged on the project
// (project.automation.log), so the project page shows what happened and why.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const store = require('./store');
const pricing = require('./pricing');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const OUTBOX = path.join(DATA_DIR, 'outbox.json');
const LAUNCH_DIR = path.join(ROOT, 'dist', 'launch');

// ---------------------------------------------------------------- helpers
function log(project, step, status, message) {
  project.automation = project.automation || { log: [] };
  project.automation.log.push({ at: new Date().toISOString(), step, status, message });
  project.automation.log = project.automation.log.slice(-60);
}

// Which package a brief needs: one page = Starter, up to five = Standard, more = Plus.
function packageFor(intake) {
  const pages = intake.pages.length;
  return pages <= 1 ? 'starter' : pages <= 5 ? 'standard' : 'plus';
}

// Proposal and invoices: numbers, amounts and dates, stored on the project. The printable
// documents are rendered from these (docs-views.js), so they always match.
function makeDocuments(project, settings = pricing.load()) {
  const pkg = settings.packages.find((p) => p.id === packageFor(project.intake)) || settings.packages[0];
  const total = settings.hourlyRate > 0 ? pricing.quote(settings, pkg).price : 0;
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const ref = project.id.slice(-4).toUpperCase();
  const deposit = Math.round(total / 2);
  project.documents = project.documents || {};
  project.documents.proposal = project.documents.proposal || {
    number: `Q-${stamp}-${ref}`,
    createdAt: new Date().toISOString(),
    packageId: pkg.id,
    packageName: pkg.name,
    pages: pkg.pages,
    revisionRounds: pkg.revisionRounds,
    total,
    currency: settings.currency,
    validDays: 14,
  };
  project.documents.deposit = project.documents.deposit || {
    number: `INV-${stamp}-${ref}-1`,
    createdAt: new Date().toISOString(),
    label: '50% deposit to start',
    amount: deposit,
    currency: settings.currency,
    dueDays: 7,
  };
  return project.documents;
}

function makeFinalInvoice(project) {
  const p = project.documents?.proposal;
  if (!p || project.documents.final) return;
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  project.documents.final = {
    number: `INV-${stamp}-${project.id.slice(-4).toUpperCase()}-2`,
    createdAt: new Date().toISOString(),
    label: 'Final 50% at launch',
    amount: p.total - Math.round(p.total / 2),
    currency: p.currency,
    dueDays: 7,
  };
}

function ensureReviewToken(project) {
  if (!project.reviewToken) project.reviewToken = crypto.randomBytes(16).toString('hex');
  return project.reviewToken;
}

// Email drafts. Nothing is sent: they wait on the Outbox page for you to copy or open in
// your email app.
function readOutbox() {
  try {
    return JSON.parse(fs.readFileSync(OUTBOX, 'utf8'));
  } catch {
    return [];
  }
}
function addDraft(project, subject, body) {
  const box = readOutbox();
  box.unshift({
    id: crypto.randomBytes(6).toString('hex'),
    projectId: project.id,
    to: project.intake.email,
    subject,
    body,
    createdAt: new Date().toISOString(),
    done: false,
  });
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OUTBOX, JSON.stringify(box.slice(0, 200), null, 2));
}
function markDraft(id, done) {
  const box = readOutbox();
  const d = box.find((x) => x.id === id);
  if (d) d.done = done;
  fs.writeFileSync(OUTBOX, JSON.stringify(box, null, 2));
}

const run = (file, args) =>
  new Promise((resolve, reject) =>
    execFile(process.execPath, [path.join(ROOT, 'scripts', file), ...args], { cwd: ROOT }, (err, stdout, stderr) =>
      err ? reject(new Error((stderr || err.message).trim().split('\n').pop())) : resolve(stdout)
    )
  );

// ---------------------------------------------------------------- the pipeline
// One queue for all projects: steps are slow (AI copy, pushes) and share WordPress.
const queue = [];
let busy = false;
let current = null;
function enqueue(projectId, stage, baseUrl) {
  queue.push({ projectId, stage, baseUrl });
  if (!busy) next();
}
async function next() {
  const job = queue.shift();
  current = job ? job.projectId : null;
  if (!job) {
    busy = false;
    return;
  }
  busy = true;
  try {
    if (job.stage === 'intake') await onIntake(job.projectId, job.baseUrl);
    if (job.stage === 'approved') await onApproved(job.projectId, job.baseUrl);
  } catch (err) {
    console.error(`Automation (${job.stage}) for ${job.projectId}: ${err.message}`);
  }
  next();
}
const isRunning = (projectId) => current === projectId || queue.some((j) => j.projectId === projectId);

// Keeps the latest copy of the project between steps (the owner may edit it meanwhile).
function update(projectId, fn) {
  const p = store.get(projectId);
  if (!p) throw new Error('Project was deleted');
  fn(p);
  store.save(p);
  return p;
}

async function onIntake(projectId, baseUrl) {
  // Lazy requires: these modules pull in WordPress and the AI client.
  const wordpress = require('./wordpress');
  const copywriter = require('./copywriter');
  let p = update(projectId, (p) => {
    p.automation = p.automation || { log: [] };
    p.automation.state = 'running';
    makeDocuments(p);
    ensureReviewToken(p);
    log(p, 'proposal', 'done', `Proposal ${p.documents.proposal.number} and deposit invoice created (${p.documents.proposal.packageName} package).`);
    log(p, 'review', 'done', 'Client review link created.');
  });

  // AI copy: only when the local model is installed and no copy exists yet.
  if (!p.copy) {
    const ai = await copywriter.status();
    if (ai.ok) {
      update(projectId, (p) => log(p, 'copy', 'running', 'Writing the website copy with the local AI model…'));
      try {
        const copy = await copywriter.generateCopy(p.intake);
        p = update(projectId, (p) => {
          p.copy = copy;
          log(p, 'copy', 'done', 'Website copy drafted. Review it on the project page before launch.');
        });
      } catch (err) {
        p = update(projectId, (p) => log(p, 'copy', 'skipped', `AI copy failed (${err.message}); the site uses draft placeholders.`));
      }
    } else {
      p = update(projectId, (p) => log(p, 'copy', 'skipped', `AI model not installed (${ai.message}). The site uses draft placeholders; install it with npm run ai:up.`));
    }
  }

  // Build on staging.
  const wp = await wordpress.status();
  if (!wp.ok) {
    update(projectId, (p) => {
      log(p, 'build', 'blocked', `Staging WordPress not reachable (${wp.message}). Start it with npm run wp:up, then press Run automation.`);
      p.automation.state = 'blocked';
    });
    return;
  }
  p = store.get(projectId);
  try {
    await wordpress.pushProject(p);
    p.checklist['build-push'] = true;
    log(p, 'build', 'done', `Draft site built on staging: ${p.wordpress.siteUrl}/`);
    store.save(p);
    require('./thumbs').capture(p);
  } catch (err) {
    store.save(p);
    update(projectId, (p) => {
      log(p, 'build', 'failed', `Build failed: ${err.message}`);
      p.automation.state = 'blocked';
    });
    return;
  }

  // Email draft to the client with their review link and proposal.
  update(projectId, (p) => {
    const link = `${baseUrl}/review/${p.reviewToken}`;
    const d = p.documents;
    addDraft(
      p,
      `Your new website draft is ready to review: ${p.intake.businessName}`,
      `Hi,\n\nThe first draft of the ${p.intake.businessName} website is ready.\n\nReview it here (on your phone or computer): ${link}\n\nYou can leave comments on any page, and press "Approve" when you're happy.\n\nYour proposal (${d.proposal.number}) and deposit invoice (${d.deposit.number}) are on the same page.\n\nThanks!`
    );
    log(p, 'notify', 'done', 'Email draft to the client saved in the Outbox.');
    p.automation.state = 'waiting-for-client';
  });
}

async function onApproved(projectId, baseUrl) {
  let p = update(projectId, (p) => {
    p.automation = p.automation || { log: [] };
    p.automation.state = 'running';
    makeDocuments(p);
    makeFinalInvoice(p);
    p.checklist['review-signoff'] = true;
    log(p, 'invoice', 'done', `Final invoice ${p.documents.final.number} created.`);
  });

  // Launch package: everything needed to go live, ready for you to deploy (never deployed
  // automatically).
  const out = path.join(LAUNCH_DIR, p.id);
  try {
    fs.rmSync(out, { recursive: true, force: true });
    fs.mkdirSync(out, { recursive: true });
    if (p.wordpress?.siteUrl) await run('export-static.js', [p.id, path.join(out, 'static-site')]);
    await run('zip-plugins.js', []);
    fs.cpSync(path.join(ROOT, 'dist', 'plugins'), path.join(out, 'plugins'), { recursive: true });
    fs.writeFileSync(path.join(out, 'LAUNCH.md'), launchChecklist(p));
    p = update(projectId, (p) => {
      p.automation.launchPackage = path.relative(ROOT, out);
      log(p, 'package', 'done', `Launch package ready in ${path.relative(ROOT, out)}/ (not deployed).`);
    });
  } catch (err) {
    p = update(projectId, (p) => log(p, 'package', 'failed', `Launch package failed: ${err.message}`));
  }

  update(projectId, (p) => {
    addDraft(
      p,
      `Thank you for approving your website: ${p.intake.businessName}`,
      `Hi,\n\nThank you for approving the ${p.intake.businessName} website!\n\nYour final invoice (${p.documents.final.number}) is here: ${baseUrl}/review/${p.reviewToken}\n\nWe'll agree the launch date with you and send your login details and training video at handover.\n\nThanks!`
    );
    log(p, 'notify', 'done', 'Thank-you email draft with the final invoice saved in the Outbox.');
    p.automation.state = 'ready-to-launch';
  });
}

function launchChecklist(p) {
  const i = p.intake;
  return `# Launch: ${i.businessName}

Prepared by SiteKit on ${new Date().toISOString().slice(0, 10)}. **Nothing has been deployed.**

## Client
- Email: ${i.email}
- Phone: ${i.phone || '-'}
- Domain: ${i.hosting?.domain || 'not decided yet'}
- Staging: ${p.wordpress?.siteUrl || '-'}/

## In this folder
- \`plugins/\`: SiteKit plugins to upload on the live WordPress (contact form, motion, SEO).
- \`static-site/\`: a plain-HTML copy of the site, if you host it without WordPress.

## Steps (see "Going live" in the SiteKit README)
1. Domain and hosting in the client's name, with SSL.
2. WordPress + Twenty Twenty-Five, then upload and activate the three plugins.
3. Point SiteKit at the live site (.env) and push the project.
4. Test the contact form (SMTP), phones and tablets.
5. Settings -> Reading: allow search engines. Submit /wp-sitemap.xml in Search Console.
6. Final invoice paid: ${p.documents?.final?.number || '-'}.
`;
}

module.exports = { enqueue, isRunning, makeDocuments, makeFinalInvoice, ensureReviewToken, packageFor, readOutbox, markDraft, addDraft };
