// Server-rendered HTML. Every value from intake goes through esc().
// public/app.js adds progressive enhancements (auto-saving checklist, upload previews,
// toasts); every page also works without JavaScript.
const { esc } = require('./blocks');
const { PHASES, phaseProgress, currentPhase } = require('./phases');
const thumbs = require('./thumbs');
const { intakeWarnings, PAGE_OPTIONS, DESIGN_STYLES, HERO_LAYOUTS } = require('./intake');
const HERO_LABELS = { auto: 'Style default', collage: 'Photo collage', centered: 'Centred over photo', split: 'Text + framed photo', editorial: 'Big headline, bottom' };

const STYLE_LABELS = {
  classic: 'Classic: clean and modern, suits anyone',
  bold: 'Bold: big uppercase type, strong shapes',
  elegant: 'Elegant: serif, airy, premium',
  playful: 'Playful: rounded, tilted, friendly',
  minimal: 'Minimal: editorial, black-and-white photos',
  luxe: 'Luxe: dark and gold, for hotels and fine dining',
  organic: 'Organic: earthy and soft, for cafés, yoga and tea',
  corporate: 'Corporate: structured, for colleges, hospitals and firms',
};
const { generateSite, localBusinessSchema, countPlaceholders } = require('./generator');
const { intakeFingerprint } = require('./copywriter');
const { siteSlug } = require('./staging');
const { wp: wpConfig } = require('./config');

const ICONS = {
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="2" fill="currentColor"/><rect x="13" y="4" width="7" height="7" rx="2" fill="currentColor"/><rect x="4" y="13" width="7" height="7" rx="2" fill="currentColor"/><rect x="13" y="13" width="7" height="7" rx="2" fill="currentColor"/></svg>',
  board: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="5" height="16" rx="1.6" fill="currentColor"/><rect x="9.5" y="4" width="5" height="11" rx="1.6" fill="currentColor"/><rect x="15.5" y="4" width="5" height="13.5" rx="1.6" fill="currentColor"/></svg>',
  moon: '<svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor"/></svg>',
  sun: '<svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  logo: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="currentColor" opacity=".15"/><path d="M7 9h10M7 12h6M7 15h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  upload: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  rocket: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 15c-1 1-1.5 3.5-1.5 5.5 2 0 4.5-.5 5.5-1.5m-4-4 4 4m-4-4 2.5-5.5C9 6 13 3 20.5 3.5 21 11 18 15 14.5 16.5L9 19m6.5-10a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ext: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6m0-6-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 4.9L19 9.7l-4.9 1.8L12 17l-1.8-5.5L5 9.7l5.2-1.8L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" fill="currentColor"/></svg>',
  alert: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9v4m0 4h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function layout(title, body, { active = '' } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · SiteKit</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/static/style.css">
<script>try{var t=localStorage.getItem('sitekit-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}</script>
<script src="/static/app.js" defer></script>
</head>
<body>
<header class="top">
  <a class="brand" href="/"><span class="brand-mark">${ICONS.logo}</span>SiteKit</a>
  <nav>
    <a href="/" class="${active === 'projects' ? 'active' : ''}">Projects</a>
    <a href="/pricing" class="${active === 'pricing' ? 'active' : ''}">Pricing</a>
    <a href="/one-pager" target="_blank" rel="noopener" class="nav-onepager">One-pager</a>
    <a href="/agency/" target="_blank" rel="noopener">Our site</a>
    <a href="/outbox" class="${active === 'outbox' ? 'active' : ''} nav-outbox">Outbox</a>
    <button type="button" class="theme-toggle" data-theme-toggle aria-label="Dark mode" aria-pressed="false">${ICONS.moon}${ICONS.sun}</button>
    <a class="btn small" href="/new">${ICONS.plus}<span>New project</span></a>
  </nav>
</header>
<main>
${body}
</main>
<div class="toasts" aria-live="polite"></div>
</body>
</html>`;
}

function flashHtml(flash) {
  if (!flash) return '';
  return `<div class="flash ${esc(flash.type)}" data-autohide>${esc(flash.text)}</div>`;
}

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const ms = new Date(`${dateStr}T23:59:59`).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

function totals(p) {
  const progress = phaseProgress(p);
  const done = progress.reduce((a, x) => a + x.done, 0);
  const total = progress.reduce((a, x) => a + x.total, 0);
  return { progress, done, total, pct: Math.round((done / total) * 100) };
}

// Seven dots, one per phase: done / current / upcoming.
function stepper(p, { labels = false } = {}) {
  const cur = currentPhase(p);
  const steps = phaseProgress(p)
    .map((ph) => {
      const state = ph.complete ? 'done' : cur && cur.id === ph.id ? 'current' : 'todo';
      const label = ph.name.replace(/^\d+\.\s*/, '');
      return `<li class="step ${state} ${ph.owner}" title="${esc(ph.name)}: ${ph.done}/${ph.total}"><span class="dot"></span>${labels ? `<span class="step-label">${esc(label)}</span><span class="step-count">${ph.done}/${ph.total}</span>` : ''}</li>`;
    })
    .join('');
  return `<ol class="stepper ${labels ? 'with-labels' : ''}">${steps}</ol>`;
}

function dueTag(p) {
  const due = daysUntil(p.review.deadline);
  if (due === null) return '';
  if (due < 0) return `<span class="tag bad">Review overdue ${-due}d</span>`;
  if (due <= 2) return `<span class="tag warn">Review due in ${due}d</span>`;
  return `<span class="tag">Review due in ${due}d</span>`;
}

function dashboard(projects, wpStatus, outboxCount = 0) {
  const active = projects.filter((p) => currentPhase(p));
  const waiting = active.filter((p) => currentPhase(p).owner === 'client');
  const overdue = projects.filter((p) => (daysUntil(p.review.deadline) ?? 1) < 0);
  const launched = projects.length - active.length;

  const stats = [
    ['Active projects', active.length, ''],
    ['Waiting on client', waiting.length, waiting.length ? 'client' : ''],
    ['Overdue reviews', overdue.length, overdue.length ? 'bad' : ''],
    ['Launched', launched, launched ? 'good' : ''],
  ]
    .map(([label, n, tone], i) => `<div class="stat ${tone} reveal" style="--i:${i}"><span class="stat-n">${n}</span><span class="stat-label">${label}</span></div>`)
    .join('');

  // Each card carries what the toolbar filters on: name, who it's waiting on, sample or not.
  const meta = (p) => {
    const cur = currentPhase(p);
    const who = !cur ? 'launched' : cur.owner === 'client' ? 'client' : 'you';
    return `data-name="${esc(`${p.intake.businessName} ${p.intake.location || ''}`.toLowerCase())}" data-who="${who}" data-sample="${p.sample ? 1 : 0}"`;
  };
  const logoOf = (p) => (p.intake.logo ? `<img src="/uploads/${esc(p.id)}/${esc(p.intake.logo.stored)}" alt="">` : `<span>${esc(p.intake.businessName.slice(0, 1))}</span>`);
  const thumbOf = (p) =>
    thumbs.exists(p.id)
      ? `<img src="/thumbs/${esc(p.id)}.png" alt="" loading="lazy">`
      : `<span class="pc-thumb-empty" style="--c:${esc(p.intake.colours?.primary || '#4f46e5')}"><span class="pc-logo big">${logoOf(p)}</span></span>`;

  const cards = projects
    .map((p, i) => {
      const cur = currentPhase(p);
      const t = totals(p);
      return `<a class="project-card reveal" style="--i:${Math.min(i, 12) + 4}" href="/p/${esc(p.id)}" ${meta(p)}>
  <div class="pc-thumb">${thumbOf(p)}${p.sample ? '<span class="tag pc-sample">Sample</span>' : ''}</div>
  <div class="pc-body">
    <div class="pc-head">
      <div class="pc-logo">${logoOf(p)}</div>
      <div class="pc-title"><strong>${esc(p.intake.businessName)}</strong><span class="muted">${esc(p.intake.location || p.intake.email)}</span></div>
    </div>
    <div class="pc-phase">${cur ? `<span>${esc(cur.name)}</span><span class="tag ${cur.owner === 'client' ? 'client' : 'you'}">${cur.owner === 'client' ? 'Waiting on client' : 'On you'}</span>` : '<span>Live</span><span class="tag good">Launched</span>'} ${dueTag(p)}</div>
    ${stepper(p)}
    <div class="pc-foot"><div class="bar"><span style="--w:${t.pct}%"></span></div><span class="muted">${t.pct}%</span></div>
  </div>
</a>`;
    })
    .join('');

  // Board: one column per phase, plus Launched.
  const columns = [...PHASES.map((ph) => ({ id: ph.id, name: ph.name, owner: ph.owner })), { id: 'live', name: 'Launched', owner: 'done' }];
  const board = columns
    .map((col) => {
      const inCol = projects.filter((p) => (currentPhase(p)?.id || 'live') === col.id);
      return `<section class="board-col" aria-label="${esc(col.name)}">
  <header><b>${esc(col.name)}</b><span class="board-count">${inCol.length}</span>${col.owner === 'client' ? '<span class="tag client">Client</span>' : col.owner === 'done' ? '' : '<span class="tag you">You</span>'}</header>
  <div class="board-cards">${
    inCol
      .map(
        (p) => `<a class="board-card" href="/p/${esc(p.id)}" ${meta(p)}><div class="bc-thumb">${thumbOf(p)}</div><div class="bc-body"><strong>${esc(p.intake.businessName)}</strong><span class="bc-row"><span class="bar"><span style="--w:${totals(p).pct}%"></span></span>${dueTag(p)}</span></div></a>`
      )
      .join('') || '<p class="board-empty">Nothing here</p>'
  }</div>
</section>`;
    })
    .join('');

  const toolbar = `<div class="dash-tools reveal">
  <label class="dash-search">${ICONS.search}<input type="search" placeholder="Search projects" aria-label="Search projects" data-dash-search></label>
  <div class="dash-filters" role="group" aria-label="Show">
    ${[['all', 'All'], ['you', 'On you'], ['client', 'Waiting on client'], ['launched', 'Launched'], ['real', 'Clients only']].map(([k, l], i) => `<button type="button" data-dash-filter="${k}" aria-pressed="${i === 0}">${l}</button>`).join('')}
  </div>
  <div class="dash-views" role="group" aria-label="View">
    <button type="button" data-dash-view="grid" aria-pressed="true" title="Grid">${ICONS.grid}<span>Grid</span></button>
    <button type="button" data-dash-view="board" aria-pressed="false" title="Board by phase">${ICONS.board}<span>Board</span></button>
  </div>
</div>`;

  return layout(
    'Projects',
    `<section class="page-head">
  <div><h1>Projects</h1><p class="muted">Every client site, from intake to launch.</p></div>
  <div class="head-actions" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
    <a class="btn ghost small" href="/outbox">Outbox${outboxCount ? ` <span class="tag you">${outboxCount}</span>` : ''}</a>
    <a class="btn ghost small" href="/start" target="_blank" rel="noopener" title="Send this form to clients">Client brief form</a>
    <div class="status-pill ${wpStatus.ok ? 'ok' : 'warn'}" title="${esc(wpStatus.message)}"><span class="pulse"></span>${wpStatus.ok ? 'Staging connected' : 'Staging not connected'}</div>
  </div>
</section>
${wpStatus.ok ? '' : `<div class="flash warn">${esc(wpStatus.message)}</div>`}
<section class="stats">${stats}</section>
${
  projects.length
    ? `${toolbar}<section class="project-grid" data-dash-grid>${cards}</section><div class="board" data-dash-board hidden>${board}</div><p class="muted dash-none" data-dash-none hidden>No projects match.</p>`
    : `<section class="empty reveal">
  <div class="empty-art">${ICONS.rocket}</div>
  <h2>No projects yet</h2>
  <p class="muted">Start with the intake form. It's the one thing the client has to do up front.</p>
  <a class="btn" href="/new">${ICONS.plus}<span>Create the first project</span></a>
</section>`
}`,
    { active: 'projects' }
  );
}

function dropzone({ name, label, hint, multiple = false, required = false, existing = '' }) {
  return `<div class="field">
  <span class="label">${label}${required ? ' <span class="req">*</span>' : ''}</span>
  <label class="dropzone" data-dropzone data-kind="${name}">
    <input type="file" name="${name}" accept="image/png,image/jpeg,image/webp" ${multiple ? 'multiple' : ''} ${required ? 'required' : ''}>
    <span class="dz-icon">${ICONS.upload}</span>
    <span class="dz-text"><strong>Drop ${multiple ? 'images' : 'a file'} here</strong> or click to browse</span>
    <span class="hint">${hint}</span>
  </label>
  <div class="dz-preview" data-preview-for="${name}">${existing}</div>
  <div class="dz-warnings" data-warnings-for="${name}"></div>
</div>`;
}

// Live preview of the client's homepage in the chosen design style. public/app.js redraws it
// as the form changes (name, tagline, location, button text, colours, style, services, photo).
// An approximation for choosing a style: the real site is what gets pushed to WordPress.
function stylePreview(values = {}, photoUrl = '', photo2Url = '') {
  const c = values.colours || {};
  const services = (Array.isArray(values.services) ? values.services.map((s) => s.name) : []).slice(0, 3);
  while (services.length < 3) services.push(['Our main service', 'Something we do well', 'Another service'][services.length]);
  return `<div class="field"><span class="label">Live preview <span class="hint">Approximate: shows the style and colours. The pushed site is the real thing.</span></span>
  <figure class="sp" data-style-preview data-style="${esc(values.style || 'classic')}" data-photo="${esc(photoUrl)}" data-photo2="${esc(photo2Url)}" style="--p:${esc(c.primary || '#2563eb')};--d:${esc(c.secondary || '#1e293b')};--a:${esc(c.accent || '#f1f5f9')}">
    <div class="sp-bar" aria-hidden="true"><i></i><i></i><i></i><span data-sp="domain">yourbusiness.com</span></div>
    <div class="sp-page">
      <div class="sp-header"><span class="sp-logo" data-sp="initial">${esc((values.businessName || 'B').charAt(0).toUpperCase())}</span><b data-sp="name">${esc(values.businessName || 'Your business')}</b><span class="sp-nav"><span>About</span><span>Services</span><span>Contact</span></span><span class="sp-btn" data-sp="cta">${esc(values.ctaLabel || 'Get a quote')}</span></div>
      <div class="sp-hero"${photoUrl ? ` style="background-image:url('${esc(photoUrl)}')"` : ''}>
        <div class="sp-hero-text">
          <span class="sp-eyebrow" data-sp="location">${esc(values.location || 'Your city')}</span>
          <span class="sp-h1" data-sp="name">${esc(values.businessName || 'Your business')}</span>
          <span class="sp-tag" data-sp="tagline">${esc(values.tagline || 'A short line about what you do best')}</span>
          <span class="sp-ctas"><span class="sp-btn" data-sp="cta">${esc(values.ctaLabel || 'Get a quote')}</span><span class="sp-btn ghost">Call us</span></span>
        </div>
        <div class="sp-collage" aria-hidden="true"><span></span><span></span><b data-sp="years">${esc(values.yearsInBusiness ? `${values.yearsInBusiness}+` : '10+')}</b></div>
      </div>
      <div class="sp-cards">${services.map((n, i) => `<div class="sp-card"><b data-sp="service${i}">${esc(n)}</b><i></i><i></i></div>`).join('')}</div>
    </div>
  </figure></div>`;
}

// Automation status on the project page: what the pipeline did, the client's review link,
// documents and the launch package. The page refreshes itself while a step is running.
const AUTO_STATES = {
  running: ['you', 'Running…'],
  'waiting-for-client': ['client', 'Waiting for client review'],
  blocked: ['warn', 'Needs you'],
  'ready-to-launch': ['good', 'Ready to launch (not live)'],
};
function automationCard(p) {
  const a = p.automation || {};
  const [cls, label] = AUTO_STATES[a.state] || ['', 'Not started'];
  const docs = p.documents || {};
  const review = p.reviewToken ? `/review/${p.reviewToken}` : '';
  const comments = p.review?.comments || [];
  const log = (a.log || []).slice(-8).reverse();
  return `<div class="card reveal" id="automation"${a.state === 'running' ? ' data-auto-refresh="4000"' : ''}>
  <div class="card-head"><h2>${ICONS.spark} Automation</h2><span class="tag ${cls}">${esc(label)}</span></div>
  ${review ? `<div class="auto-links"><b>Client review link</b> <code id="review-link">${esc(review)}</code> <button type="button" class="btn ghost small" data-copy="#review-link" data-copy-prefix="origin">Copy</button> <a class="btn ghost small" href="${esc(review)}" target="_blank" rel="noopener">Open ${ICONS.ext}</a></div>` : ''}
  <div class="auto-links">
    ${docs.proposal ? `<a href="/p/${esc(p.id)}/proposal" target="_blank" rel="noopener">Proposal ${esc(docs.proposal.number)}</a>` : ''}
    ${docs.deposit ? `<a href="/p/${esc(p.id)}/invoice/deposit" target="_blank" rel="noopener">Deposit invoice</a>` : ''}
    ${docs.final ? `<a href="/p/${esc(p.id)}/invoice/final" target="_blank" rel="noopener">Final invoice</a>` : ''}
    ${a.launchPackage ? `<span class="muted">Launch package: <code>${esc(a.launchPackage)}/</code></span>` : ''}
  </div>
  ${p.review?.approvedAt ? `<p class="small"><span class="tag good">Approved</span> by ${esc(p.review.approvedBy || 'client')} on ${esc(new Date(p.review.approvedAt).toLocaleDateString('en-GB'))}</p>` : ''}
  ${comments.length ? `<details class="auto-comments"><summary>${comments.length} client comment${comments.length === 1 ? '' : 's'}</summary><ul>${comments.slice().reverse().map((c) => `<li><b>${esc(c.name)}</b> · ${esc(c.page)}: ${esc(c.text)}</li>`).join('')}</ul></details>` : ''}
  ${log.length ? `<ol class="auto-log">${log.map((l) => `<li class="${esc(l.status)}"><span>${esc(l.message)}</span><time>${esc(new Date(l.at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }))}</time></li>`).join('')}</ol>` : '<p class="small muted">Runs automatically for new briefs: proposal, review link, AI copy, staging build, email draft. It never puts a site live.</p>'}
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
    <form method="post" action="/p/${esc(p.id)}/automate"><input type="hidden" name="stage" value="intake"><button class="btn small" ${a.state === 'running' ? 'disabled' : ''}>${a.log?.length ? 'Run again' : 'Run automation'}</button></form>
    ${p.review?.approvedAt ? `<form method="post" action="/p/${esc(p.id)}/automate"><input type="hidden" name="stage" value="approved"><button class="btn ghost small">Rebuild launch package</button></form>` : ''}
  </div>
</div>`;
}

function intakeForm(values = {}, { errors = [], action = '/new', editing = false, project } = {}) {
  const v = (k) => esc(values[k] ?? '');
  const selectedPages = values.pages || ['about', 'services', 'contact'];
  const servicesText = Array.isArray(values.services)
    ? values.services.map((s) => (s.description ? `${s.name}: ${s.description}` : s.name)).join('\n')
    : values.services || '';
  const testimonialsText = Array.isArray(values.testimonials)
    ? values.testimonials.map((t) => (t.author ? `${t.quote} - ${t.author}` : t.quote)).join('\n')
    : values.testimonials || '';
  const linksText = (x) => (Array.isArray(x) ? x.join('\n') : x || '');
  // Lists saved on a project back into the "one per line" text the form uses.
  const lines = (x, fn) => (Array.isArray(x) ? x.map(fn).join('\n') : x || '');
  const hoursText = lines(values.hours, (h) => (h.time ? `${h.days}: ${h.time}` : h.days));
  const teamText = lines(values.team, (m) => (m.role ? `${m.name} - ${m.role}` : m.name));
  const faqText = lines(values.faq, (f) => `${f.q} ${f.a}`);
  const colours = values.colours || {
    primary: values.colourPrimary,
    secondary: values.colourSecondary,
    accent: values.colourAccent,
  };
  const hosting = values.hosting || { domain: values.domain, hasHosting: values.hasHosting === 'yes', notes: values.hostingNotes };

  const existingLogo = editing && project?.intake.logo ? `<img src="/uploads/${esc(project.id)}/${esc(project.intake.logo.stored)}" alt="Current logo">` : '';
  const existingMedia = editing && project ? project.intake.media.map((m) => `<img src="/uploads/${esc(project.id)}/${esc(m.stored)}" alt="">`).join('') : '';

  const colourField = (name, label, value, fallback) => `<label class="colour">
    <input type="color" name="${name}" value="${esc(value || fallback)}" data-colour>
    <span><strong>${label}</strong><code data-hex>${esc(value || fallback)}</code></span>
  </label>`;

  const steps = ['Business', 'Brand + media', 'Contact', 'Domain'];

  return layout(
    editing ? 'Edit intake' : 'New project',
    `<section class="page-head">
  <div>
    ${editing ? `<a class="back" href="/p/${esc(project.id)}">← Back to project</a>` : ''}
    <h1>${editing ? `Edit intake` : 'Start your website project'}</h1>
    <p class="muted">${editing ? 'A new logo replaces the old one. New photos are added to the existing ones.' : 'Tell us about your business and upload what you have. We handle the rest.'}</p>
  </div>
</section>
${errors.length ? `<div class="flash error"><strong>Please fix the following:</strong><ul>${errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
<div class="form-layout">
<nav class="form-steps" aria-label="Form sections">
  <ol>${steps.map((s, i) => `<li><a href="#s${i + 1}"><span>${i + 1}</span>${s}</a></li>`).join('')}</ol>
</nav>
<form method="post" action="${esc(action)}" enctype="multipart/form-data" class="intake" data-intake>
  <fieldset id="s1" class="reveal"><legend><span class="num">1</span>Business</legend>
    <label class="field">Business name <span class="req">*</span><input name="businessName" required maxlength="120" value="${v('businessName')}" placeholder="e.g. Himalayan Coffee Co."></label>
    <label class="field">Tagline <span class="hint">A short value proposition, shown big in the hero.</span><input name="tagline" maxlength="200" value="${v('tagline')}" placeholder="Single-origin coffee, roasted in Kathmandu"></label>
    <label class="field">Main button text <span class="hint">What should visitors do first? Shown in the header and hero; it opens the Contact page.</span><input name="ctaLabel" maxlength="30" list="cta-options" value="${v('ctaLabel')}" placeholder="Get a quote">
      <datalist id="cta-options"><option value="Get a quote"><option value="Book an appointment"><option value="Book a class"><option value="Book a table"><option value="Visit us"><option value="Request a call back"></datalist></label>
    <label class="field">What does your business do? <span class="hint">3–5 sentences. More detail means less generic copy.</span><textarea name="description" rows="4" maxlength="1500" data-counter="1500">${v('description')}</textarea></label>
    <label class="field">Services <span class="hint">One per line, as “Name: short description”.</span><textarea name="services" rows="4" placeholder="Wholesale beans: Freshly roasted beans for cafes and restaurants&#10;Barista training: Half-day courses for new staff">${esc(servicesText)}</textarea></label>
    <div class="grid2">
      <label class="field">Who are your customers?<input name="targetCustomer" maxlength="500" value="${v('targetCustomer')}" placeholder="Cafes and offices in the Kathmandu valley"></label>
      <label class="field">Years in business<input name="yearsInBusiness" maxlength="10" value="${v('yearsInBusiness')}" inputmode="numeric" placeholder="10"></label>
    </div>
  </fieldset>

  <fieldset id="s2" class="reveal"><legend><span class="num">2</span>Brand + media</legend>
    <div class="grid2">
      ${dropzone({ name: 'logo', label: 'Logo', hint: 'PNG, JPG or WebP, at least 500px wide. Export SVG/AI files to PNG.', required: !editing, existing: existingLogo })}
      ${dropzone({ name: 'media', label: 'Photos', hint: 'Up to 20 images, 10 MB each. 1st = hero, 2nd = about.', multiple: true, existing: existingMedia })}
    </div>
    <div class="field"><span class="label">Brand colours</span>
      <div class="colours">
        ${colourField('colourPrimary', 'Primary', colours.primary, '#2563eb')}
        ${colourField('colourSecondary', 'Dark', colours.secondary, '#1e293b')}
        ${colourField('colourAccent', 'Light', colours.accent, '#f1f5f9')}
      </div>
    </div>
    <label class="field">Design style <span class="hint">The look of the whole site. Uses the brand colours above.</span><select name="style">${DESIGN_STYLES.map((st) => `<option value="${st}" ${(values.style || 'classic') === st ? 'selected' : ''}>${esc(STYLE_LABELS[st])}</option>`).join('')}</select></label>
    <label class="field">Homepage hero layout <span class="hint">How the top of the homepage is arranged.</span><select name="heroLayout">${HERO_LAYOUTS.map((h) => `<option value="${h}" ${(values.heroLayout || 'auto') === h ? 'selected' : ''}>${esc(HERO_LABELS[h])}</option>`).join('')}</select></label>
    ${stylePreview(values, ...(editing && project ? project.intake.media.slice(0, 2).map((m) => `/uploads/${project.id}/${m.stored}`) : []))}
    <div class="field"><span class="label">Pages needed</span>
      <div class="chips">
        <label class="chip"><input type="checkbox" checked disabled><span>Home</span></label>
        ${PAGE_OPTIONS.map((p) => `<label class="chip"><input type="checkbox" name="pages" value="${p}" ${selectedPages.includes(p) ? 'checked' : ''}><span>${p[0].toUpperCase() + p.slice(1)}</span></label>`).join('')}
      </div>
    </div>
    <div class="grid2">
      <label class="field">Websites you like <span class="hint">Links, one per line.</span><textarea name="likedSites" rows="2" placeholder="https://">${esc(linksText(values.likedSites))}</textarea></label>
      <label class="field">Main competitors <span class="hint">Links, one per line.</span><textarea name="competitors" rows="2" placeholder="https://">${esc(linksText(values.competitors))}</textarea></label>
    </div>
    <label class="field">Testimonials <span class="hint">One per line, as “Quote - Name”. Two or more become a slider. Leave empty if you have none: we never invent them.</span><textarea name="testimonials" rows="3">${esc(testimonialsText)}</textarea></label>
    <label class="chip"><input type="checkbox" name="beforeAfter" value="yes" ${values.beforeAfter === true || values.beforeAfter === 'yes' ? 'checked' : ''}><span>My last two photos are a <b>before</b> and <b>after</b> (shown with a drag slider)</span></label>
    <div class="grid2">
      <label class="field">Team <span class="hint">Optional. One per line, as “Name - Role”. Shown on the About page.</span><textarea name="team" rows="3" placeholder="Pema Sherpa - Founder&#10;Anita Gurung - Head chef">${esc(teamText)}</textarea></label>
      <label class="field">Frequently asked questions <span class="hint">Optional. One per line: the question ending in “?”, then the answer.</span><textarea name="faq" rows="3" placeholder="Do you deliver? Yes, anywhere in Kathmandu.">${esc(faqText)}</textarea></label>
    </div>
  </fieldset>

  <fieldset id="s3" class="reveal"><legend><span class="num">3</span>Contact + location</legend>
    <div class="grid2">
      <label class="field">Contact email <span class="req">*</span><input type="email" name="email" required value="${v('email')}" placeholder="hello@business.com"></label>
      <label class="field">Phone<input name="phone" value="${v('phone')}" inputmode="tel"></label>
      <label class="field">WhatsApp<input name="whatsapp" value="${v('whatsapp')}" inputmode="tel"></label>
      <label class="field">City / location<input name="location" value="${v('location')}" placeholder="Kathmandu, Nepal"></label>
    </div>
    <label class="field">Street address <span class="hint">Shown on the Contact page and Google Map.</span><input name="address" value="${v('address')}"></label>
    <label class="field">Service area<input name="serviceArea" value="${v('serviceArea')}" placeholder="Kathmandu valley"></label>
    <label class="field">Opening hours <span class="hint">Optional. One per line, as “Days: hours”. Today's line is highlighted on the site.</span><textarea name="hours" rows="3" placeholder="Sunday - Friday: 9am - 6pm&#10;Saturday: Closed">${esc(hoursText)}</textarea></label>
  </fieldset>

  <fieldset id="s4" class="reveal"><legend><span class="num">4</span>Domain + hosting</legend>
    <div class="grid2">
      <label class="field">Domain<input name="domain" value="${esc(hosting.domain || '')}" placeholder="clientbusiness.com"></label>
      <label class="field">Do you already have hosting?<select name="hasHosting"><option value="no">No / not sure</option><option value="yes" ${hosting.hasHosting ? 'selected' : ''}>Yes</option></select></label>
    </div>
    <label class="field">Hosting notes <span class="hint">Provider, who has the login. Don't put passwords here.</span><textarea name="hostingNotes" rows="2">${esc(hosting.notes || '')}</textarea></label>
  </fieldset>

  <div class="submit-bar">
    <span class="muted">Fields marked <span class="req">*</span> are required.</span>
    <button class="btn" type="submit" data-busy="${editing ? 'Saving…' : 'Creating project…'}">${editing ? 'Save changes' : 'Submit project'}</button>
  </div>
</form>
</div>`
  );
}

function copyField(name, label, value, { rows = 2, hint = '', limit } = {}) {
  const counter = limit ? ` data-limit="${limit}"` : '';
  return `<label class="field">${esc(label)}${hint ? ` <span class="hint">${esc(hint)}</span>` : ''}<textarea name="${name}" rows="${rows}"${counter}>${esc(value || '')}</textarea>${limit ? '<span class="count" aria-live="polite"></span>' : ''}</label>`;
}

function copyCard(p, aiStatus, copyJob) {
  const running = copyJob && copyJob.status === 'running';
  const head = `<div class="card-head"><h2>${ICONS.spark} Website copy</h2>${p.copy ? `<span class="tag ${p.copy.edited ? 'good' : 'you'}">${p.copy.edited ? 'Edited' : 'AI draft'}</span>` : ''}</div>`;

  if (running) {
    return `<div class="card reveal" id="copy" data-copy-job="/p/${esc(p.id)}/copy/status">${head}
  <div class="job"><span class="spinner"></span><div><strong data-job-message>${esc(copyJob.message)}</strong><br><span class="muted small"><span data-job-seconds>${Math.round((Date.now() - copyJob.startedAt) / 1000)}</span>s · runs on your computer, usually 1–5 minutes. You can leave this page.</span></div></div>
</div>`;
  }

  const aiLine = `<p class="status ${aiStatus.ok ? 'ok' : 'warn'} small">${esc(aiStatus.message)}</p>`;
  const generateForm = (label, confirmText) => `<form method="post" action="/p/${esc(p.id)}/copy/generate"${confirmText ? ` data-confirm="${esc(confirmText)}"` : ''}>
    <button class="btn ${p.copy ? 'secondary' : ''}" ${aiStatus.ok ? '' : 'disabled'} data-busy="Starting…">${ICONS.spark}<span>${label}</span></button></form>`;

  if (!p.copy) {
    return `<div class="card reveal" id="copy">${head}
  <p>Write the page copy from the intake with a local AI model, offline, instead of the [Draft] placeholders. You review and edit everything before it goes on the site.</p>
  ${aiLine}
  ${generateForm('Write copy with AI')}
</div>`;
  }

  const d = p.copy.data;
  const stale = p.copy.fingerprint !== intakeFingerprint(p.intake);
  const seoPages = Object.keys(d.seo).filter((pg) => pg === 'home' || p.intake.pages.includes(pg));
  return `<div class="card reveal" id="copy">${head}
  <p class="muted small">Written by ${esc(p.copy.model)} on ${fmtDate(p.copy.generatedAt)}${p.copy.edited ? ` · edited ${fmtDate(p.copy.editedAt)}` : ''}. Saved copy goes on the site the next time you push.</p>
  ${stale ? '<div class="flash warn">The intake changed after this copy was written. Regenerate it, or check the copy still matches.</div>' : ''}
  ${
    d.checkWithClient.length
      ? `<div class="warnbox card"><h2>${ICONS.alert} Check before the client sees it <span class="tag warn">${d.checkWithClient.length}</span></h2><p class="small">The model may have written things the client never said. Confirm or rewrite these.</p><ul>${d.checkWithClient.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></div>`
      : '<p class="small muted">No unsupported claims were flagged, but read it anyway. Local models miss things.</p>'
  }
  <form method="post" action="/p/${esc(p.id)}/copy" class="copy-form">
    <details open><summary>Homepage</summary>
      ${copyField('heroLead', 'Hero text', d.home.heroLead, { limit: 220 })}
      ${copyField('aboutTeaser', 'About section', d.home.aboutTeaser, { rows: 3 })}
      ${copyField('ctaLine', 'Call-to-action line', d.home.ctaLine, { rows: 1, limit: 100 })}
    </details>
    <details><summary>About page</summary>
      ${copyField('aboutHeadline', 'Story heading', d.about.headline, { rows: 1 })}
      ${copyField('aboutStory', 'Story', d.about.story.join('\n\n'), { rows: 6, hint: 'Leave a blank line between paragraphs.' })}
      ${copyField('mission', 'Mission', d.about.mission)}
      ${copyField('values', 'Values', d.about.values)}
      ${copyField('experience', 'Experience', d.about.experience)}
    </details>
    <details><summary>Services</summary>
      ${copyField('servicesIntro', 'Services intro', d.services.intro)}
      ${d.services.items.map((it, i) => `<fieldset class="mini"><legend>${esc(it.name)}</legend>${copyField(`serviceSummary${i}`, 'Card summary', it.summary, { limit: 140 })}${copyField(`serviceDetails${i}`, 'Details', it.details, { rows: 3 })}</fieldset>`).join('')}
    </details>
    <details><summary>Contact</summary>
      ${copyField('contactIntro', 'Contact intro', d.contact.intro)}
    </details>
    <details><summary>SEO titles + descriptions</summary>
      <p class="hint">Paste these into your SEO plugin (Yoast, Rank Math) after launch. WordPress itself has no field for them.</p>
      ${seoPages.map((pg) => `<fieldset class="mini"><legend>${esc(pg[0].toUpperCase() + pg.slice(1))}</legend>${copyField(`seoTitle_${pg}`, 'Title', d.seo[pg].title, { rows: 1, limit: 60 })}${copyField(`seoDescription_${pg}`, 'Description', d.seo[pg].description, { rows: 2, limit: 160 })}</fieldset>`).join('')}
    </details>
    <div class="copy-actions"><button class="btn">Save copy</button></div>
  </form>
  <div class="copy-regen">${aiLine}${generateForm('Regenerate', p.copy.edited ? 'Regenerating replaces your edited copy. Continue?' : '')}</div>
</div>`;
}

function project(p, { wpStatus, aiStatus = { ok: false, message: '' }, copyJob, flash, pushLog } = {}) {
  const i = p.intake;
  const warnings = intakeWarnings(i);
  const t = totals(p);
  const cur = currentPhase(p);
  const due = daysUntil(p.review.deadline);

  const assets = {
    logo: i.logo ? { url: `/uploads/${p.id}/${i.logo.stored}`, alt: i.logo.alt } : null,
    media: i.media.map((m) => ({ url: `/uploads/${p.id}/${m.stored}`, alt: m.alt })),
  };
  const pages = generateSite(i, assets, p.copy?.data || null);
  const wpPages = p.wordpress.pages || {};
  const siteUrl = p.wordpress.siteUrl;
  const totalDrafts = pages.reduce((n, pg) => n + countPlaceholders(pg.content), 0);

  const checklist = t.progress
    .map(
      (ph) => `<details class="phase ${ph.complete ? 'complete' : ''} ${cur && cur.id === ph.id ? 'current' : ''}" ${cur && cur.id === ph.id ? 'open' : ''} data-phase="${esc(ph.id)}">
  <summary><span class="phase-dot"></span><strong>${esc(ph.name)}</strong><span class="tag ${ph.owner === 'client' ? 'client' : 'you'}">${ph.owner}</span><span class="phase-count muted" data-count>${ph.done}/${ph.total}</span></summary>
  <div class="phase-body"><span class="muted small">${esc(ph.days)}</span>
  ${ph.tasks.map((task) => `<label class="check"><input type="checkbox" name="tasks" value="${esc(task.id)}" ${p.checklist[task.id] ? 'checked' : ''}><span>${esc(task.label)}</span></label>`).join('')}
  </div>
</details>`
    )
    .join('');

  const pageCards = pages
    .map((pg) => {
      const remote = wpPages[pg.slug];
      const drafts = countPlaceholders(pg.content);
      const badge = pg.isPosts
        ? '<span class="tag">Posts page</span>'
        : drafts
          ? `<span class="tag warn">${drafts} placeholder${drafts === 1 ? '' : 's'}</span>`
          : '<span class="tag good">Ready</span>';
      return `<details class="page-card">
  <summary>
    <span class="pg-name"><strong>${esc(pg.title)}</strong><span class="muted">/${pg.slug === 'home' ? '' : esc(pg.slug) + '/'}</span></span>
    ${badge}
    <span class="pg-links">${remote ? `<a href="${esc(remote.link)}" target="_blank" rel="noopener">View ${ICONS.ext}</a><a href="${esc(siteUrl)}/wp-admin/post.php?post=${remote.id}&amp;action=edit" target="_blank" rel="noopener">Edit ${ICONS.ext}</a>` : ''}</span>
  </summary>
  <pre>${esc(pg.content || '(empty: WordPress lists blog posts here)')}</pre>
</details>`;
    })
    .join('');

  const reviewNotes = p.review.notes
    .slice()
    .reverse()
    .map((n) => `<li><span class="muted small">${fmtDate(n.at)} · round ${n.round}</span><p>${esc(n.text)}</p></li>`)
    .join('');

  const pushNote = pushLog
    ? `<div class="flash ok"><strong>Pushed to staging.</strong> <a href="${esc(siteUrl)}" target="_blank" rel="noopener">Open the site ${ICONS.ext}</a><details><summary>What changed (${pushLog.length})</summary><ul>${pushLog.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></details></div>`
    : '';

  return layout(
    i.businessName,
    `<section class="project-hero reveal">
  <div class="ph-main">
    <div class="pc-logo big">${i.logo ? `<img src="/uploads/${esc(p.id)}/${esc(i.logo.stored)}" alt="">` : `<span>${esc(i.businessName.slice(0, 1))}</span>`}</div>
    <div>
      <a class="back" href="/">← Projects</a>
      <h1>${esc(i.businessName)}</h1>
      <p class="muted">${[i.email, i.phone, i.location].filter(Boolean).map(esc).join(' · ')}</p>
    </div>
  </div>
  <div class="ph-actions">
    <a class="btn secondary" href="/p/${esc(p.id)}/edit">Edit intake</a>
  </div>
  <div class="ph-progress">
    ${stepper(p, { labels: true })}
    <div class="ph-meta">
      <span>${cur ? `Now: <strong>${esc(cur.name)}</strong> · ${cur.owner === 'client' ? 'waiting on client' : 'on you'}` : '<strong>Launched</strong>'}</span>
      <span class="muted" data-total>${t.done}/${t.total} tasks · ${t.pct}%</span>
    </div>
  </div>
</section>
${flashHtml(flash)}
${pushNote}

<div class="cols">
<section class="main-col">
  ${automationCard(p)}
  ${
    warnings.length
      ? `<div class="card warnbox reveal"><h2>${ICONS.alert} Intake gaps <span class="tag warn">${warnings.length}</span></h2><ul>${warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul><p class="small">Chase these with the client now. Each one turns into rework later.</p></div>`
      : ''
  }

  ${copyCard(p, aiStatus, copyJob)}

  <div class="card staging reveal">
    <div class="card-head"><h2>Staging site</h2><span class="status-pill ${wpStatus.ok ? 'ok' : 'warn'}"><span class="pulse"></span>${wpStatus.ok ? 'Connected' : 'Not connected'}</span></div>
    <p class="muted small">${esc(wpStatus.message)}</p>
    <div class="staging-row">
      <form method="post" action="/p/${esc(p.id)}/push" data-push>
        <button class="btn big" ${wpStatus.ok ? '' : 'disabled'} data-busy="Pushing to WordPress…">${ICONS.rocket}<span>${p.wordpress.lastPushAt ? 'Push again' : 'Push draft to staging'}</span></button>
      </form>
      ${
        p.wordpress.lastPushAt
          ? `<div class="small"><span class="muted">Last pushed ${fmtDate(p.wordpress.lastPushAt)}</span><br><a href="${esc(siteUrl)}/" target="_blank" rel="noopener">${esc(siteUrl)}/ ${ICONS.ext}</a> · <a href="${esc(siteUrl)}/wp-admin/edit.php?post_type=sitekit_message" target="_blank" rel="noopener">Form messages ${ICONS.ext}</a></div>`
          : `<span class="muted small">Not pushed yet.${wpConfig.multisite ? ` The first push creates this client's own site at ${esc(wpConfig.url)}/${esc(siteSlug(p))}/` : ''}</span>`
      }
    </div>
    <p class="hint">Uploads the logo and photos, creates the pages, header and footer, and sets the title, logo, homepage, brand colours and animations. ${p.wordpress.lastPushAt ? '<strong>Pushing again overwrites</strong> edits you made to these pages in WordPress.' : ''}</p>
  </div>

  <div class="card reveal">
    <div class="card-head"><h2>Generated pages</h2>${totalDrafts ? `<span class="tag warn">${totalDrafts} placeholders to rewrite</span>` : ''}</div>
    <p class="muted small">Follows the PDF wireframes. ${p.copy ? 'Uses the copy above; anything left' : 'Text'} in [brackets] is a placeholder${p.copy ? ' or a task for you (map, contact form)' : ', not finished copy. Write it with AI above'}.</p>
    <div class="page-list">${pageCards}</div>
  </div>

  <div class="card reveal">
    <div class="card-head"><h2>Client review</h2>
      <span>${due === null ? '' : due < 0 ? `<span class="tag bad">Deadline passed ${-due}d ago</span>` : `<span class="tag ${due <= 2 ? 'warn' : ''}">${due}d left</span>`}</span>
    </div>
    <div class="rounds">${[1, 2].map((n) => `<span class="round ${p.review.round >= n ? 'used' : ''}">Round ${n}</span>`).join('')}${p.review.round > 2 ? `<span class="round extra">+${p.review.round - 2} billable</span>` : ''}</div>
    <form method="post" action="/p/${esc(p.id)}/review" class="review-form">
      <label class="field">Feedback deadline <input type="date" name="deadline" value="${esc(p.review.deadline || '')}"></label>
      <label class="field">Current round <select name="round">${[0, 1, 2, 3].map((n) => `<option ${n === p.review.round ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="field grow">Client feedback / note <textarea name="note" rows="2" placeholder="Paste the client's feedback for this round"></textarea></label>
      <button class="btn secondary">Save review</button>
    </form>
    ${reviewNotes ? `<ul class="notes">${reviewNotes}</ul>` : ''}
  </div>

  <div class="card reveal">
    <div class="card-head"><h2>LocalBusiness schema</h2><button type="button" class="btn ghost small" data-copy="#schema">Copy</button></div>
    <p class="muted small">Paste into your SEO plugin's schema field (or a header snippet) after launch.</p>
    <pre id="schema">${esc(localBusinessSchema(i, i.hosting.domain ? `https://${i.hosting.domain}` : siteUrl, null))}</pre>
  </div>
</section>

<aside class="side-col">
  <form method="post" action="/p/${esc(p.id)}/checklist" class="card checklist reveal" data-autosave>
    <div class="card-head"><h2>Workflow</h2><span class="muted small" data-save-state></span></div>
    <div class="bar big"><span style="--w:${t.pct}%" data-total-bar></span></div>
    ${checklist}
    <noscript><button class="btn secondary">Save checklist</button></noscript>
  </form>

  <div class="card reveal">
    <h2>Assets</h2>
    ${i.logo ? `<div class="logo-tile"><img src="/uploads/${esc(p.id)}/${esc(i.logo.stored)}" alt="${esc(i.logo.alt)}"><span class="muted small">${i.logo.width ? `${i.logo.width}×${i.logo.height}px` : ''}</span></div>` : '<p>No logo.</p>'}
    <div class="thumbs">${i.media.map((m, n) => `<figure><img src="/uploads/${esc(p.id)}/${esc(m.stored)}" alt="${esc(m.alt)}" title="${esc(m.original)}">${n < 2 ? `<figcaption>${n === 0 ? 'Hero' : 'About'}</figcaption>` : ''}</figure>`).join('') || '<p class="muted">No photos.</p>'}</div>
    <div class="swatches">${['primary', 'secondary', 'accent'].map((k) => `<span class="swatch" style="--c:${esc(i.colours[k])}"><i></i><code>${esc(i.colours[k])}</code></span>`).join('')}</div>
  </div>

  <div class="card reveal">
    <h2>Brief</h2>
    <dl>
      <dt>Pages</dt><dd>${i.pages.map(esc).join(', ')}</dd>
      ${i.targetCustomer ? `<dt>Customers</dt><dd>${esc(i.targetCustomer)}</dd>` : ''}
      ${i.likedSites.length ? `<dt>Sites they like</dt><dd>${i.likedSites.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u)}</a>`).join('<br>')}</dd>` : ''}
      ${i.competitors.length ? `<dt>Competitors</dt><dd>${i.competitors.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u)}</a>`).join('<br>')}</dd>` : ''}
      <dt>Domain</dt><dd>${esc(i.hosting.domain || '—')} · hosting: ${i.hosting.hasHosting ? 'yes' : 'no / unknown'}</dd>
      ${i.hosting.notes ? `<dt>Hosting notes</dt><dd>${esc(i.hosting.notes)}</dd>` : ''}
    </dl>
  </div>

  <form method="post" action="/p/${esc(p.id)}/delete" data-confirm="Delete this project, its uploaded files and its staging site? This cannot be undone.">
    <button class="btn danger small">Delete project</button>
  </form>
</aside>
</div>`
  );
}

function notFound() {
  return layout('Not found', '<section class="empty"><h2>Not found</h2><p><a class="btn" href="/">Back to projects</a></p></section>');
}

module.exports = { layout, dashboard, intakeForm, project, notFound, totals };
