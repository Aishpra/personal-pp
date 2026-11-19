const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');

const config = require('./src/config');
const store = require('./src/store');
const views = require('./src/views');
const wordpress = require('./src/wordpress');
const copywriter = require('./src/copywriter');
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

function loadProject(req, res, next) {
  const project = store.get(req.params.id);
  if (!project) return res.status(404).send(views.notFound());
  req.project = project;
  next();
}

app.get('/', async (req, res) => {
  res.send(views.dashboard(store.list(), await wordpress.status()));
});

app.get('/new', (req, res) => {
  res.send(views.intakeForm());
});

app.post('/new', handleUpload, (req, res) => {
  const intake = parseIntake(req.body);
  const errors = [];
  if (req.uploadError) errors.push(req.uploadError);
  // Validate with a placeholder logo so the "logo required" check reflects the upload.
  errors.push(...validateIntake({ ...intake, logo: req.files?.logo?.[0] ? {} : null }));
  if (errors.length) {
    cleanupIncoming(req);
    return res.status(400).send(views.intakeForm({ ...req.body, ...intake }, { errors }));
  }
  const project = store.create(intake);
  attachUploads(project, req, { replaceLogo: true });
  project.checklist['intake-form'] = true;
  store.save(project);
  res.redirect(`/p/${project.id}`);
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

app.post('/p/:id/delete', loadProject, (req, res) => {
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
  app.listen(config.port, host, () => {
    console.log(`SiteKit running at http://localhost:${config.port}`);
    console.log(`WordPress staging: ${config.wp.url}${config.wp.appPassword ? '' : ' (not configured: run `npm run wp:up`)'}`);
  });
}

module.exports = app;
