// Server-rendered HTML. Every value from intake goes through esc().
const { esc } = require('./blocks');
const { phaseProgress, currentPhase } = require('./phases');
const { intakeWarnings, PAGE_OPTIONS } = require('./intake');
const { generateSite, localBusinessSchema, countPlaceholders } = require('./generator');

function layout(title, body, { flash } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · SiteKit</title>
<link rel="stylesheet" href="/static/style.css">
</head>
<body>
<header class="top"><a class="brand" href="/">SiteKit</a><nav><a href="/">Projects</a><a class="btn small" href="/new">New project</a></nav></header>
<main>
${flash ? `<div class="flash ${esc(flash.type)}">${flash.html ? flash.html : esc(flash.text)}</div>` : ''}
${body}
</main>
</body>
</html>`;
}

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const ms = new Date(`${dateStr}T23:59:59`).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

function dashboard(projects, wpStatus) {
  const rows = projects
    .map((p) => {
      const cur = currentPhase(p);
      const progress = phaseProgress(p);
      const done = progress.reduce((a, x) => a + x.done, 0);
      const total = progress.reduce((a, x) => a + x.total, 0);
      const due = daysUntil(p.review.deadline);
      const dueHtml = due === null ? '' : due < 0 ? `<span class="tag bad">review overdue ${-due}d</span>` : `<span class="tag">review due in ${due}d</span>`;
      return `<tr>
  <td><a href="/p/${esc(p.id)}"><strong>${esc(p.intake.businessName)}</strong></a><div class="muted">${esc(p.intake.email)}</div></td>
  <td>${cur ? `${esc(cur.name)} <span class="tag ${cur.owner === 'client' ? 'client' : ''}">${cur.owner === 'client' ? 'waiting on client' : 'on you'}</span>` : '<span class="tag good">launched</span>'} ${dueHtml}</td>
  <td><div class="bar"><span style="width:${Math.round((done / total) * 100)}%"></span></div><div class="muted">${done}/${total} tasks</div></td>
  <td class="muted">${fmtDate(p.createdAt)}</td>
</tr>`;
    })
    .join('');

  return layout(
    'Projects',
    `<div class="row-between"><h1>Projects</h1><a class="btn" href="/new">New project</a></div>
<p class="status ${wpStatus.ok ? 'ok' : 'warn'}">WordPress staging: ${esc(wpStatus.message)}</p>
${
  projects.length
    ? `<table class="list"><thead><tr><th>Client</th><th>Current phase</th><th>Progress</th><th>Created</th></tr></thead><tbody>${rows}</tbody></table>`
    : `<div class="empty"><p>No projects yet.</p><p><a class="btn" href="/new">Fill in the first intake form</a></p></div>`
}`
  );
}

function intakeForm(values = {}, { errors = [], action = '/new', editing = false } = {}) {
  const v = (k) => esc(values[k] ?? '');
  const checked = (page) => ((values.pages || ['about', 'services', 'contact']).includes(page) ? 'checked' : '');
  const servicesText = Array.isArray(values.services)
    ? values.services.map((s) => (s.description ? `${s.name}: ${s.description}` : s.name)).join('\n')
    : values.services || '';
  const testimonialsText = Array.isArray(values.testimonials)
    ? values.testimonials.map((t) => (t.author ? `${t.quote} - ${t.author}` : t.quote)).join('\n')
    : values.testimonials || '';
  const linksText = (x) => (Array.isArray(x) ? x.join('\n') : x || '');
  const colours = values.colours || {};
  const hosting = values.hosting || {};

  return layout(
    editing ? 'Edit intake' : 'New project',
    `<h1>${editing ? `Edit intake: ${v('businessName')}` : 'Start your website project'}</h1>
<p class="muted">${editing ? 'Uploading a new logo replaces the old one. New photos are added to the existing ones.' : 'Tell us about your business and upload what you have. We handle the rest.'}</p>
${errors.length ? `<div class="flash error"><ul>${errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
<form method="post" action="${esc(action)}" enctype="multipart/form-data" class="intake">
  <fieldset><legend>Business</legend>
    <label>Business name *<input name="businessName" required maxlength="120" value="${v('businessName')}" placeholder="e.g. Himalayan Coffee Co."></label>
    <label>Tagline <span class="hint">short value proposition, used in the hero</span><input name="tagline" maxlength="200" value="${v('tagline')}" placeholder="Single-origin coffee, roasted in Kathmandu"></label>
    <label>What does your business do? <span class="hint">3-5 sentences. The more detail, the less generic the copy.</span><textarea name="description" rows="4" maxlength="1500">${v('description')}</textarea></label>
    <label>Services <span class="hint">one per line, as "Name: short description"</span><textarea name="services" rows="4" placeholder="Wholesale beans: Freshly roasted beans for cafes and restaurants&#10;Barista training: Half-day courses for new staff">${esc(servicesText)}</textarea></label>
    <label>Who are your customers?<input name="targetCustomer" maxlength="500" value="${v('targetCustomer')}" placeholder="Cafes and offices in the Kathmandu valley"></label>
    <label>Years in business<input name="yearsInBusiness" maxlength="10" value="${v('yearsInBusiness')}" inputmode="numeric"></label>
  </fieldset>

  <fieldset><legend>Brand + media</legend>
    <div class="grid2">
      <label>Logo ${editing ? '' : '*'} <span class="hint">PNG, JPG or WebP, at least 500px wide. SVG/AI files must be exported to PNG.</span><input type="file" name="logo" accept="image/png,image/jpeg,image/webp" ${editing ? '' : 'required'}></label>
      <label>Photos <span class="hint">up to 20 images (JPG/PNG/WebP), 10 MB each. First = hero, second = about.</span><input type="file" name="media" accept="image/png,image/jpeg,image/webp" multiple></label>
    </div>
    <div class="colours">
      <label>Primary colour<input type="color" name="colourPrimary" value="${esc(colours.primary || '#2563eb')}"></label>
      <label>Secondary colour<input type="color" name="colourSecondary" value="${esc(colours.secondary || '#1e293b')}"></label>
      <label>Accent colour<input type="color" name="colourAccent" value="${esc(colours.accent || '#f1f5f9')}"></label>
    </div>
    <div class="pages"><span>Pages needed</span>
      <label class="check"><input type="checkbox" checked disabled> Home</label>
      ${PAGE_OPTIONS.map((p) => `<label class="check"><input type="checkbox" name="pages" value="${p}" ${checked(p)}> ${p[0].toUpperCase() + p.slice(1)}</label>`).join('')}
    </div>
    <label>Websites you like <span class="hint">links, one per line</span><textarea name="likedSites" rows="2" placeholder="https://">${esc(linksText(values.likedSites))}</textarea></label>
    <label>Main competitors <span class="hint">links, one per line</span><textarea name="competitors" rows="2" placeholder="https://">${esc(linksText(values.competitors))}</textarea></label>
    <label>Testimonials <span class="hint">one per line, as "Quote - Name". Leave empty if you have none; we won't invent any.</span><textarea name="testimonials" rows="3">${esc(testimonialsText)}</textarea></label>
  </fieldset>

  <fieldset><legend>Contact + location</legend>
    <div class="grid2">
      <label>Contact email *<input type="email" name="email" required value="${v('email')}"></label>
      <label>Phone<input name="phone" value="${v('phone')}"></label>
      <label>WhatsApp<input name="whatsapp" value="${v('whatsapp')}"></label>
      <label>City / location<input name="location" value="${v('location')}" placeholder="Kathmandu, Nepal"></label>
    </div>
    <label>Street address <span class="hint">shown on Contact page + Google Map</span><input name="address" value="${v('address')}"></label>
    <label>Service area<input name="serviceArea" value="${v('serviceArea')}" placeholder="Kathmandu valley"></label>
  </fieldset>

  <fieldset><legend>Domain + hosting</legend>
    <div class="grid2">
      <label>Domain<input name="domain" value="${esc(hosting.domain || '')}" placeholder="clientbusiness.com"></label>
      <label>Do you already have hosting?<select name="hasHosting"><option value="no">No / not sure</option><option value="yes" ${hosting.hasHosting ? 'selected' : ''}>Yes</option></select></label>
    </div>
    <label>Hosting notes <span class="hint">provider, who has the login. Don't put passwords here.</span><textarea name="hostingNotes" rows="2">${esc(hosting.notes || '')}</textarea></label>
  </fieldset>

  <button class="btn" type="submit">${editing ? 'Save changes' : 'Submit project'}</button>
</form>`
  );
}

function project(p, { wpStatus, flash, pushLog } = {}) {
  const i = p.intake;
  const warnings = intakeWarnings(i);
  const progress = phaseProgress(p);
  const cur = currentPhase(p);
  const due = daysUntil(p.review.deadline);

  const assets = {
    logo: i.logo ? { url: `/uploads/${p.id}/${i.logo.stored}`, alt: i.logo.alt } : null,
    media: i.media.map((m) => ({ url: `/uploads/${p.id}/${m.stored}`, alt: m.alt })),
  };
  const pages = generateSite(i, assets);
  const wpPages = p.wordpress.pages || {};
  const siteUrl = p.wordpress.siteUrl;

  const checklist = progress
    .map(
      (ph) => `<div class="phase ${ph.complete ? 'complete' : ''} ${cur && cur.id === ph.id ? 'current' : ''}">
  <div class="phase-head"><strong>${esc(ph.name)}</strong> <span class="tag ${ph.owner === 'client' ? 'client' : ''}">${ph.owner}</span> <span class="muted">${esc(ph.days)} · ${ph.done}/${ph.total}</span></div>
  ${ph.tasks.map((t) => `<label class="check"><input type="checkbox" name="tasks" value="${esc(t.id)}" ${p.checklist[t.id] ? 'checked' : ''}> ${esc(t.label)}</label>`).join('')}
</div>`
    )
    .join('');

  const pageCards = pages
    .map((pg) => {
      const remote = wpPages[pg.slug];
      const drafts = countPlaceholders(pg.content);
      return `<details class="page-card"><summary><strong>${esc(pg.title)}</strong> <span class="muted">/${pg.slug === 'home' ? '' : esc(pg.slug) + '/'}</span>
  ${drafts ? `<span class="tag warn">${drafts} placeholder${drafts === 1 ? '' : 's'} to rewrite</span>` : pg.isPosts ? '<span class="tag">posts page</span>' : '<span class="tag good">no placeholders</span>'}
  ${remote ? `<a href="${esc(remote.link)}" target="_blank" rel="noopener">view on staging</a> · <a href="${esc(siteUrl)}/wp-admin/post.php?post=${remote.id}&amp;action=edit" target="_blank" rel="noopener">edit</a>` : ''}</summary>
  <pre>${esc(pg.content || '(empty: WordPress lists blog posts here)')}</pre></details>`;
    })
    .join('');

  const reviewNotes = p.review.notes
    .slice()
    .reverse()
    .map((n) => `<li><span class="muted">${fmtDate(n.at)} · round ${n.round}</span><br>${esc(n.text)}</li>`)
    .join('');

  return layout(
    i.businessName,
    `<div class="row-between">
  <div><h1>${esc(i.businessName)}</h1><p class="muted">${esc(i.email)}${i.phone ? ' · ' + esc(i.phone) : ''}${i.location ? ' · ' + esc(i.location) : ''}</p></div>
  <div class="actions"><a class="btn secondary" href="/p/${esc(p.id)}/edit">Edit intake</a></div>
</div>
${flash ? `<div class="flash ${esc(flash.type)}">${esc(flash.text)}</div>` : ''}
${pushLog ? `<div class="flash ok"><strong>Pushed to staging.</strong><ul>${pushLog.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>` : ''}

<div class="cols">
<section>
  ${warnings.length ? `<div class="card warnbox"><h2>Intake gaps (${warnings.length})</h2><ul>${warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul><p class="muted">Chase these with the client now. Each one turns into rework later.</p></div>` : ''}

  <div class="card">
    <h2>Staging site</h2>
    <p class="status ${wpStatus.ok ? 'ok' : 'warn'}">${esc(wpStatus.message)}</p>
    ${p.wordpress.lastPushAt ? `<p class="muted">Last pushed ${fmtDate(p.wordpress.lastPushAt)} to <a href="${esc(siteUrl)}" target="_blank" rel="noopener">${esc(siteUrl)}</a></p>` : '<p class="muted">Not pushed yet.</p>'}
    <form method="post" action="/p/${esc(p.id)}/push" onsubmit="this.querySelector('button').disabled=true;this.querySelector('button').textContent='Pushing…'">
      <button class="btn" ${wpStatus.ok ? '' : 'disabled'}>${p.wordpress.lastPushAt ? 'Push again (overwrites page content)' : 'Push draft to staging'}</button>
    </form>
    <p class="hint">Creates or updates Home/About/Services/Contact by slug, uploads the logo + photos, sets the site title, logo, front page and brand colours. Pushing again <strong>overwrites</strong> edits you made to those pages in WordPress.</p>
  </div>

  <div class="card">
    <h2>Generated pages</h2>
    <p class="muted">Structure follows the PDF wireframes. Text in [brackets] is a placeholder, not copy.</p>
    ${pageCards}
  </div>

  <div class="card">
    <h2>Client review</h2>
    <p>Round <strong>${p.review.round}</strong> of 2 included.
    ${due === null ? '' : due < 0 ? `<span class="tag bad">deadline passed ${-due} day(s) ago</span>` : `<span class="tag">${due} day(s) left</span>`}</p>
    <form method="post" action="/p/${esc(p.id)}/review" class="inline">
      <label>Feedback deadline <input type="date" name="deadline" value="${esc(p.review.deadline || '')}"></label>
      <label>Round <select name="round">${[0, 1, 2, 3].map((n) => `<option ${n === p.review.round ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="grow">Client feedback / note <textarea name="note" rows="2" placeholder="Paste the client's feedback for this round"></textarea></label>
      <button class="btn secondary">Save</button>
    </form>
    ${p.review.round > 2 ? '<p class="tag bad">Over the 2 included rounds: this round is billable.</p>' : ''}
    ${reviewNotes ? `<ul class="notes">${reviewNotes}</ul>` : ''}
  </div>

  <div class="card">
    <h2>LocalBusiness schema</h2>
    <p class="muted">Paste into your SEO plugin's schema field (or a header snippet) after launch.</p>
    <pre>${esc(localBusinessSchema(i, i.hosting.domain ? `https://${i.hosting.domain}` : siteUrl, null))}</pre>
  </div>
</section>

<aside>
  <form method="post" action="/p/${esc(p.id)}/checklist" class="card">
    <h2>Workflow</h2>
    ${checklist}
    <button class="btn secondary">Save checklist</button>
  </form>

  <div class="card">
    <h2>Assets</h2>
    ${i.logo ? `<div class="logo"><img src="/uploads/${esc(p.id)}/${esc(i.logo.stored)}" alt="${esc(i.logo.alt)}"><span class="muted">${i.logo.width ? `${i.logo.width}×${i.logo.height}px` : ''}</span></div>` : '<p>No logo.</p>'}
    <div class="thumbs">${i.media.map((m) => `<img src="/uploads/${esc(p.id)}/${esc(m.stored)}" alt="${esc(m.alt)}" title="${esc(m.original)}">`).join('') || '<p class="muted">No photos.</p>'}</div>
    <p class="muted">Colours:</p>
    <div class="swatches">${['primary', 'secondary', 'accent'].map((k) => `<span style="background:${esc(i.colours[k])}" title="${k} ${esc(i.colours[k])}"></span>`).join('')}</div>
  </div>

  <div class="card">
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

  <form method="post" action="/p/${esc(p.id)}/delete" onsubmit="return confirm('Delete this project and its uploaded files? This does not touch WordPress.')">
    <button class="btn danger small">Delete project</button>
  </form>
</aside>
</div>`
  );
}

function notFound() {
  return layout('Not found', '<h1>Not found</h1><p><a href="/">Back to projects</a></p>');
}

module.exports = { layout, dashboard, intakeForm, project, notFound };
