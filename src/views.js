// Server-rendered HTML. Every value from intake goes through esc().
// public/app.js adds progressive enhancements (auto-saving checklist, upload previews,
// toasts); every page also works without JavaScript.
const { esc } = require('./blocks');
const { phaseProgress, currentPhase } = require('./phases');
const { intakeWarnings, PAGE_OPTIONS } = require('./intake');
const { generateSite, localBusinessSchema, countPlaceholders } = require('./generator');
const { intakeFingerprint } = require('./copywriter');

const ICONS = {
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
<script src="/static/app.js" defer></script>
</head>
<body>
<header class="top">
  <a class="brand" href="/"><span class="brand-mark">${ICONS.logo}</span>SiteKit</a>
  <nav>
    <a href="/" class="${active === 'projects' ? 'active' : ''}">Projects</a>
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

function dashboard(projects, wpStatus) {
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

  const cards = projects
    .map((p, i) => {
      const cur = currentPhase(p);
      const t = totals(p);
      const logo = p.intake.logo ? `<img src="/uploads/${esc(p.id)}/${esc(p.intake.logo.stored)}" alt="">` : `<span>${esc(p.intake.businessName.slice(0, 1))}</span>`;
      return `<a class="project-card reveal" style="--i:${i + 4}" href="/p/${esc(p.id)}">
  <div class="pc-head">
    <div class="pc-logo">${logo}</div>
    <div class="pc-title"><strong>${esc(p.intake.businessName)}</strong><span class="muted">${esc(p.intake.location || p.intake.email)}</span></div>
  </div>
  <div class="pc-phase">${cur ? `<span>${esc(cur.name)}</span><span class="tag ${cur.owner === 'client' ? 'client' : 'you'}">${cur.owner === 'client' ? 'Waiting on client' : 'On you'}</span>` : '<span>Live</span><span class="tag good">Launched</span>'} ${dueTag(p)}</div>
  ${stepper(p)}
  <div class="pc-foot"><div class="bar"><span style="--w:${t.pct}%"></span></div><span class="muted">${t.pct}%</span></div>
</a>`;
    })
    .join('');

  return layout(
    'Projects',
    `<section class="page-head">
  <div><h1>Projects</h1><p class="muted">Every client site, from intake to launch.</p></div>
  <div class="status-pill ${wpStatus.ok ? 'ok' : 'warn'}" title="${esc(wpStatus.message)}"><span class="pulse"></span>${wpStatus.ok ? 'Staging connected' : 'Staging not connected'}</div>
</section>
${wpStatus.ok ? '' : `<div class="flash warn">${esc(wpStatus.message)}</div>`}
<section class="stats">${stats}</section>
${
  projects.length
    ? `<section class="project-grid">${cards}</section>`
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
    <label class="field">Testimonials <span class="hint">One per line, as “Quote - Name”. Leave empty if you have none: we never invent them.</span><textarea name="testimonials" rows="3">${esc(testimonialsText)}</textarea></label>
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
      ${p.wordpress.lastPushAt ? `<div class="small"><span class="muted">Last pushed ${fmtDate(p.wordpress.lastPushAt)}</span><br><a href="${esc(siteUrl)}" target="_blank" rel="noopener">${esc(siteUrl)} ${ICONS.ext}</a></div>` : '<span class="muted small">Not pushed yet.</span>'}
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

  <form method="post" action="/p/${esc(p.id)}/delete" data-confirm="Delete this project and its uploaded files? This does not touch WordPress.">
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
