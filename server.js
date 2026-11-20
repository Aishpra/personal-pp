const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');

const config = require('./src/config');
const store = require('./src/store');
const views = require('./src/views');
const wordpress = require('./src/wordpress');
const copywriter = require('./src/copywriter');
const staging = require('./src/staging');
const pricing = require('./src/pricing');
const salesViews = require('./src/sales-views');
const docsViews = require('./src/docs-views');
const automation = require('./src/automation');
const { parseIntake, validateIntake } = require('./src/intake');
const { PHASES } = require('./src/phases');
const { dimensions } = require('./src/images');

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const INCOMING_DIR = path.join(UPLOADS_DIR, '_incoming');
fs.mkdirSync(INCOMING_DIR, { recursive: true });

const ALLOWED = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };
const MAX_MEDIA = 20;

const upload = multer({
  storage: multer.diskStorage({
    destination: INCOMING_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + (ALLOWED[file.mimetype] || '')),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: MAX_MEDIA + 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED[file.mimetype]) return cb(null, true);
    const err = new Error(`"${file.originalname}" is not a PNG, JPG or WebP image. Export SVG/AI logos to PNG first.`);
    err.code = 'BAD_TYPE';
    cb(err);
  },
}).fields([
  { name: 'logo', maxCount: 1 },
  { name: 'media', maxCount: MAX_MEDIA },
]);

// Wraps multer so upload errors re-render the form instead of crashing.
function handleUpload(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next();
    cleanupIncoming(req);
    const messages = {
      LIMIT_FILE_SIZE: 'One of the files is over 10 MB. Compress it and try again.',
      LIMIT_FILE_COUNT: `Too many files: 1 logo and up to ${MAX_MEDIA} photos.`,
      LIMIT_UNEXPECTED_FILE: `Too many files: 1 logo and up to ${MAX_MEDIA} photos.`,
    };
    req.uploadError = messages[err.code] || err.message;
    next();
  });
}

function incomingFiles(req) {
  return [...(req.files?.logo || []), ...(req.files?.media || [])];
}

function cleanupIncoming(req) {
  for (const f of incomingFiles(req)) fs.rmSync(f.path, { force: true });
}

// Moves an uploaded file into uploads/<projectId>/ and returns its record.
function adoptFile(projectId, file, alt) {
  const dir = path.join(UPLOADS_DIR, projectId);
  fs.mkdirSync(dir, { recursive: true });
  fs.renameSync(file.path, path.join(dir, file.filename));
  const dims = dimensions(path.join(dir, file.filename));
  return {
    stored: file.filename,
    original: path.basename(file.originalname).slice(0, 120),
    mime: file.mimetype,
    size: file.size,
    width: dims?.width || null,
    height: dims?.height || null,
    alt,
  };
}

function attachUploads(project, req, { replaceLogo }) {
  const name = project.intake.businessName;
  const logoFile = req.files?.logo?.[0];
  if (logoFile && (replaceLogo || !project.intake.logo)) {
    if (project.intake.logo) fs.rmSync(path.join(UPLOADS_DIR, project.id, project.intake.logo.stored), { force: true });
    const logo = adoptFile(project.id, logoFile, `${name} logo`);
    if (logo.width && logo.width < 500) logo.warning = `Logo is only ${logo.width}px wide: it will look blurry on high-resolution screens. Ask for a larger PNG or the original vector file.`;
    project.intake.logo = logo;
  }
  const room = MAX_MEDIA - project.intake.media.length;
  const mediaFiles = req.files?.media || [];
  mediaFiles.slice(0, room).forEach((f, idx) => {
    const n = project.intake.media.length + 1;
    project.intake.media.push(adoptFile(project.id, f, `${name} photo ${n}`));
  });
  for (const f of mediaFiles.slice(room)) fs.rmSync(f.path, { force: true });
}

const app = express();
app.disable('x-powered-by');
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use('/static', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR, { index: false, dotfiles: 'deny' }));
app.use('/samples/screenshots', express.static(path.join(__dirname, 'samples', 'screenshots'), { index: false }));

// Your agency website (agency/site/), served as a local demo at /agency/. It is rebuilt when
// SiteKit starts and whenever the Pricing page is saved, so it always shows your current
// name, contact details and prices.
const AGENCY_DIR = path.join(__dirname, 'dist', 'agency');
function buildAgency() {
  return new Promise((resolve) => {
    execFile(process.execPath, [path.join(__dirname, 'scripts', 'build-agency.js')], (err, stdout, stderr) => {
      if (err) console.error(`Agency site build failed: ${(stderr || err.message).trim()}`);
      resolve(!err);
    });
  });
}
app.use('/agency', express.static(AGENCY_DIR, { extensions: ['html'] }));
app.use('/agency', (req, res) => {
  const notFound = path.join(AGENCY_DIR, '404.html');
  if (fs.existsSync(notFound)) res.status(404).sendFile(notFound);
  else res.status(404).send('The agency site has not been built yet. Run: npm run agency:build');
});

function loadProject(req, res, next) {
  const project = store.get(req.params.id);
  if (!project) return res.status(404).send(views.notFound());
  req.project = project;
  next();
}

app.get('/', async (req, res) => {
  res.send(views.dashboard(store.list(), await wordpress.status(), automation.readOutbox().filter((d) => !d.done).length));
});

app.get('/pricing', (req, res) => {
  res.send(salesViews.pricingPage(pricing.load(), { layout: views.layout, flash: req.query.saved ? 'Pricing saved.' : null }));
});

app.post('/pricing', (req, res) => {
  pricing.save(pricing.fromForm(req.body));
  buildAgency(); // keep the local agency demo in step with the new details and prices
  res.redirect('/pricing?saved=1');
});

app.get('/one-pager', (req, res) => {
  res.send(salesViews.onePager(pricing.load()));
});

app.get('/new', (req, res) => {
  res.send(views.intakeForm());
});

// The address links in client emails and review pages use (this machine, unless BASE_URL is set).
const baseUrl = (req) => (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');

// A brief from either form creates the project and starts the automated pipeline
// (proposal, review link, AI copy, staging build, client email draft). Never goes live.
function createFromBrief(req, res, action) {
  const intake = parseIntake(req.body);
  const errors = [];
  if (req.uploadError) errors.push(req.uploadError);
  // Validate with a placeholder logo so the "logo required" check reflects the upload.
  errors.push(...validateIntake({ ...intake, logo: req.files?.logo?.[0] ? {} : null }));
  if (errors.length) {
    cleanupIncoming(req);
    res.status(400).send(views.intakeForm({ ...req.body, ...intake }, { errors, action }));
    return null;
  }
  const project = store.create(intake);
  attachUploads(project, req, { replaceLogo: true });
  project.checklist['intake-form'] = true;
  store.save(project);
  automation.enqueue(project.id, 'intake', baseUrl(req));
  return project;
}

app.post('/new', handleUpload, (req, res) => {
  const project = createFromBrief(req, res, '/new');
  if (project) res.redirect(`/p/${project.id}?msg=${encodeURIComponent('Brief saved. Automation is building the proposal and draft site.')}`);
});

// The client-facing brief form (send clients this link). Same form; shows a thank-you page.
app.get('/start', (req, res) => {
  res.send(views.intakeForm({}, { action: '/start' }));
});
app.post('/start', handleUpload, (req, res) => {
  const project = createFromBrief(req, res, '/start');
  if (project) res.send(docsViews.thanks(project.intake.businessName));
});

// ---- Automation, documents, client review, outbox ----
app.post('/p/:id/automate', loadProject, (req, res) => {
  const stage = req.body.stage === 'approved' ? 'approved' : 'intake';
  if (!automation.isRunning(req.project.id)) automation.enqueue(req.project.id, stage, baseUrl(req));
  res.redirect(`/p/${req.project.id}?msg=${encodeURIComponent('Automation started. Refresh in a minute to see progress.')}`);
});

function ensureDocs(project) {
  if (!project.documents?.proposal) {
    automation.makeDocuments(project);
    store.save(project);
  }
}
app.get('/p/:id/proposal', loadProject, (req, res) => {
  ensureDocs(req.project);
  res.send(docsViews.proposal(req.project, `/p/${req.project.id}`));
});
const INVOICE_KINDS = ['deposit', 'final'];
app.get('/p/:id/invoice/:kind', loadProject, (req, res) => {
  ensureDocs(req.project);
  if (!INVOICE_KINDS.includes(req.params.kind) || !req.project.documents[req.params.kind]) return res.status(404).send(views.notFound());
  res.send(docsViews.invoice(req.project, req.params.kind, `/p/${req.project.id}`));
});

// Client review: unguessable token per project, no login needed.
function loadByToken(req, res, next) {
  const token = String(req.params.token || '');
  const project = /^[a-f0-9]{32}$/.test(token) ? store.list().find((p) => p.reviewToken === token) : null;
  if (!project) return res.status(404).send(views.notFound());
  req.project = project;
  next();
}
app.get('/review/:token', loadByToken, (req, res) => {
  res.send(docsViews.review(req.project, { token: req.params.token, flash: req.query.msg ? String(req.query.msg).slice(0, 200) : null }));
});
app.post('/review/:token/comment', loadByToken, (req, res) => {
  const p = req.project;
  const text = String(req.body.text || '').trim().slice(0, 2000);
  if (text) {
    p.review = p.review || { round: 0, notes: [] };
    p.review.comments = p.review.comments || [];
    p.review.comments.push({ at: new Date().toISOString(), name: String(req.body.name || 'Client').trim().slice(0, 80), page: String(req.body.page || 'Whole site').slice(0, 40), text });
    store.save(p);
  }
  res.redirect(`/review/${req.params.token}?msg=${encodeURIComponent('Thanks, your comment was sent.')}`);
});
app.post('/review/:token/approve', loadByToken, (req, res) => {
  const p = req.project;
  if (req.body.confirm === 'yes' && !p.review?.approvedAt) {
    p.review = p.review || { round: 0, notes: [] };
    p.review.approvedAt = new Date().toISOString();
    p.review.approvedBy = String(req.body.name || 'Client').trim().slice(0, 80);
    store.save(p);
    automation.enqueue(p.id, 'approved', baseUrl(req));
  }
  res.redirect(`/review/${req.params.token}?msg=${encodeURIComponent('Thank you for approving your website!')}`);
});
app.get('/review/:token/proposal', loadByToken, (req, res) => {
  ensureDocs(req.project);
  res.send(docsViews.proposal(req.project, `/review/${req.params.token}`));
});
app.get('/review/:token/invoice/:kind', loadByToken, (req, res) => {
  ensureDocs(req.project);
  if (!INVOICE_KINDS.includes(req.params.kind) || !req.project.documents[req.params.kind]) return res.status(404).send(views.notFound());
  res.send(docsViews.invoice(req.project, req.params.kind, `/review/${req.params.token}`));
});

app.get('/outbox', (req, res) => {
  const byId = Object.fromEntries(store.list().map((p) => [p.id, p]));
  const page = docsViews.outbox(automation.readOutbox(), byId);
  res.send(views.layout(page.title, page.body, { active: 'outbox' }));
});
app.post('/outbox/:id/done', (req, res) => {
  automation.markDraft(String(req.params.id), req.body.done === '1');
  res.redirect('/outbox');
});

// Copy generation runs in the background (a local model can take a few minutes);
// the project page polls /copy/status. One job per project, kept in memory.
const copyJobs = new Map();

function startCopyJob(projectId) {
  const job = { status: 'running', message: 'Starting the local model…', startedAt: Date.now() };
  copyJobs.set(projectId, job);
  (async () => {
    try {
      const intake = store.get(projectId).intake;
      const copy = await copywriter.generateCopy(intake, { onProgress: (m) => (job.message = m) });
      const fresh = store.get(projectId); // re-read: the project may have changed meanwhile
      if (!fresh) return;
      fresh.copy = copy;
      store.save(fresh);
      Object.assign(job, { status: 'done', message: `Copy written in ${Math.round((Date.now() - job.startedAt) / 1000)}s.` });
    } catch (err) {
      if (!(err instanceof copywriter.CopyError)) console.error(err);
      Object.assign(job, { status: 'error', message: err.message });
    }
  })();
}

function pageStatus(project) {
  return Promise.all([wordpress.status(), copywriter.status()]).then(([wpStatus, aiStatus]) => ({
    wpStatus,
    aiStatus,
    copyJob: copyJobs.get(project.id) || null,
  }));
}

app.get('/p/:id', loadProject, async (req, res) => {
  const flash = req.query.msg ? { type: 'ok', text: String(req.query.msg).slice(0, 200) } : null;
  const job = copyJobs.get(req.project.id);
  // Show a finished job's error once, then forget it.
  const jobFlash = job && job.status === 'error' ? { type: 'error', text: `Copy generation failed: ${job.message}` } : null;
  if (job && job.status !== 'running') copyJobs.delete(req.project.id);
  res.send(views.project(req.project, { ...(await pageStatus(req.project)), flash: jobFlash || flash }));
});

app.post('/p/:id/copy/generate', loadProject, (req, res) => {
  if (copyJobs.get(req.project.id)?.status !== 'running') startCopyJob(req.project.id);
  res.redirect(`/p/${req.project.id}#copy`);
});

app.get('/p/:id/copy/status', loadProject, (req, res) => {
  const job = copyJobs.get(req.project.id);
  res.json(job ? { status: job.status, message: job.message, seconds: Math.round((Date.now() - job.startedAt) / 1000) } : { status: 'idle' });
});

app.post('/p/:id/copy', loadProject, (req, res) => {
  const p = req.project;
  if (!p.copy) return res.redirect(`/p/${p.id}`);
  copywriter.applyEdits(p.copy, req.body, p.intake);
  store.save(p);
  res.redirect(`/p/${p.id}?msg=${encodeURIComponent('Copy saved. Push to staging to see it on the site.')}#copy`);
});

app.get('/p/:id/edit', loadProject, (req, res) => {
  res.send(views.intakeForm(req.project.intake, { action: `/p/${req.project.id}/edit`, editing: true, project: req.project }));
});

app.post('/p/:id/edit', loadProject, handleUpload, (req, res) => {
  const p = req.project;
  const intake = parseIntake(req.body);
  intake.logo = p.intake.logo;
  intake.media = p.intake.media;
  const errors = [];
  if (req.uploadError) errors.push(req.uploadError);
  errors.push(...validateIntake(intake));
  if (errors.length) {
    cleanupIncoming(req);
    return res.status(400).send(views.intakeForm({ ...req.body, ...intake }, { errors, action: `/p/${p.id}/edit`, editing: true, project: p }));
  }
  p.intake = intake;
  attachUploads(p, req, { replaceLogo: true });
  store.save(p);
  res.redirect(`/p/${p.id}?msg=${encodeURIComponent('Intake saved.')}`);
});

app.post('/p/:id/checklist', loadProject, (req, res) => {
  const p = req.project;
  const ticked = new Set([].concat(req.body.tasks || []));
  for (const phase of PHASES) for (const t of phase.tasks) p.checklist[t.id] = ticked.has(t.id);
  store.save(p);
  // public/app.js auto-saves with fetch and updates the counters from this JSON.
  if (req.get('accept')?.includes('application/json')) {
    const { progress, done, total, pct } = views.totals(p);
    return res.json({ done, total, pct, phases: progress.map((ph) => ({ id: ph.id, done: ph.done, total: ph.total, complete: ph.complete })) });
  }
  res.redirect(`/p/${p.id}?msg=${encodeURIComponent('Checklist saved.')}`);
});

app.post('/p/:id/review', loadProject, (req, res) => {
  const p = req.project;
  const round = Number(req.body.round);
  if (Number.isInteger(round) && round >= 0 && round <= 3) p.review.round = round;
  p.review.deadline = /^\d{4}-\d{2}-\d{2}$/.test(req.body.deadline || '') ? req.body.deadline : null;
  const note = String(req.body.note || '').trim().slice(0, 5000);
  if (note) p.review.notes.push({ at: new Date().toISOString(), round: p.review.round, text: note });
  store.save(p);
  res.redirect(`/p/${p.id}?msg=${encodeURIComponent('Review saved.')}`);
});

app.post('/p/:id/push', loadProject, async (req, res) => {
  const p = req.project;
  try {
    const log = await wordpress.pushProject(p);
    p.checklist['build-push'] = true;
    store.save(p);
    res.send(views.project(p, { ...(await pageStatus(p)), pushLog: log }));
  } catch (err) {
    store.save(p); // keep any media ids uploaded before the failure
    res.status(502).send(views.project(p, { ...(await pageStatus(p)), flash: { type: 'error', text: `Push failed: ${err.message}` } }));
  }
});

app.post('/p/:id/delete', loadProject, async (req, res) => {
  // Remove the client's own staging site too (multisite only; a shared site is left alone).
  try {
    await staging.deleteSite(req.project);
  } catch (err) {
    console.error(`Could not delete staging site for ${req.project.id}: ${err.message}`);
  }
  fs.rmSync(path.join(UPLOADS_DIR, req.project.id), { recursive: true, force: true });
  store.remove(req.project.id);
  res.redirect('/');
});

app.use((req, res) => res.status(404).send(views.notFound()));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send(views.layout('Error', `<h1>Something went wrong</h1><pre>${require('./src/blocks').esc(err.message)}</pre><p><a href="/">Back</a></p>`));
});

if (require.main === module) {
  const host = process.env.HOST || '127.0.0.1';
  buildAgency();
  app.listen(config.port, host, () => {
    console.log(`SiteKit running at http://localhost:${config.port}`);
    console.log(`Your agency site (local demo): http://localhost:${config.port}/agency/`);
    console.log(`WordPress staging: ${config.wp.url}${config.wp.appPassword ? '' : ' (not configured: run `npm run wp:up`)'}`);
  });
}

module.exports = app;
