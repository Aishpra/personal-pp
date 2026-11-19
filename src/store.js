// Project storage: one JSON file per project in data/.
// Plain files keep the tool dependency-free and easy to inspect or back up.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PHASES } = require('./phases');

const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const ID_RE = /^[a-z0-9-]{1,80}$/;

function fileFor(id) {
  if (!ID_RE.test(id)) throw new Error('Invalid project id');
  return path.join(DATA_DIR, `${id}.json`);
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .slice(0, 50) || 'project';
}

function newId(businessName) {
  return `${slugify(businessName)}-${crypto.randomBytes(3).toString('hex')}`;
}

function emptyChecklist() {
  const checklist = {};
  for (const phase of PHASES) {
    for (const task of phase.tasks) checklist[task.id] = false;
  }
  return checklist;
}

// options.id: a fixed id (used by the sample sites); otherwise one is generated.
function create(intake, { id } = {}) {
  const now = new Date().toISOString();
  const project = {
    id: id || newId(intake.businessName),
    createdAt: now,
    updatedAt: now,
    intake,
    checklist: emptyChecklist(),
    payments: { deposit: false, final: false },
    review: { round: 0, deadline: null, notes: [] },
    wordpress: { lastPushAt: null, pages: {}, media: {} },
  };
  save(project);
  return project;
}

function save(project) {
  project.updatedAt = new Date().toISOString();
  const file = fileFor(project.id);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(project, null, 2));
  fs.renameSync(tmp, file);
  return project;
}

function get(id) {
  let file;
  try {
    file = fileFor(id);
  } catch {
    return null;
  }
  if (!fs.existsSync(file)) return null;
  const project = JSON.parse(fs.readFileSync(file, 'utf8'));
  // data/ also holds non-project files (pricing.json): those aren't projects.
  if (!project || !project.id || !project.createdAt) return null;
  // Fill in checklist items added to PHASES after the project was created.
  project.checklist = { ...emptyChecklist(), ...project.checklist };
  return project;
}

function list() {
  return fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => get(f.slice(0, -5)))
    .filter(Boolean)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function remove(id) {
  const file = fileFor(id);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

module.exports = { create, save, get, list, remove, slugify };
