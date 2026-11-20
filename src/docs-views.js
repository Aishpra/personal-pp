// Client-facing pages and documents for the automated pipeline: the review page (draft site,
// comments, approve), the proposal and invoices (printable A4), and the Outbox of email drafts.
const { esc } = require('./blocks');
const pricing = require('./pricing');

const money = (settings, n, currency) => {
  const formatted = Math.round(n || 0).toLocaleString('en-US');
  const cur = currency ?? settings.currency;
  return cur ? `${cur} ${formatted}` : formatted;
};
const date = (iso, addDays = 0) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + addDays);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

const DOC_CSS = `
:root{--ink:#111827;--muted:#4b5563;--line:#e5e7eb;--brand:#4f46e5;--soft:#eef2ff}
*{box-sizing:border-box}
body{margin:0;background:#e5e7eb;font:14px/1.55 Inter,system-ui,sans-serif;color:var(--ink);-webkit-font-smoothing:antialiased}
.toolbar{max-width:210mm;margin:16px auto 0;display:flex;gap:12px;align-items:center;justify-content:space-between;font-size:13px;padding:0 8px}
.toolbar a{color:var(--muted)}
.toolbar button{background:var(--brand);color:#fff;border:0;border-radius:8px;padding:9px 14px;font:inherit;font-weight:600;cursor:pointer}
.page{width:210mm;max-width:100%;min-height:297mm;margin:12px auto 24px;background:#fff;padding:16mm 16mm 12mm;box-shadow:0 4px 24px rgba(0,0,0,.1)}
.head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;border-bottom:2px solid var(--ink);padding-bottom:12px;margin-bottom:22px}
.head strong{font-size:20px;letter-spacing:-.01em;display:block}.head .muted{color:var(--muted);font-size:12.5px}
.doc-type{text-align:right}.doc-type b{font-size:22px;letter-spacing:.06em;text-transform:uppercase;display:block}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:22px;font-size:13px}
.parties h3,.box h3{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin:0 0 4px}
table{width:100%;border-collapse:collapse;margin:8px 0 18px;font-size:13.5px}
th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);border-bottom:1px solid var(--line);padding:8px 6px}
td{padding:10px 6px;border-bottom:1px solid var(--line);vertical-align:top}
td.num,th.num{text-align:right;white-space:nowrap}
.total td{font-weight:700;font-size:15px;border-bottom:2px solid var(--ink)}
.box{background:var(--soft);border-radius:12px;padding:14px 16px;margin-bottom:14px;font-size:13px}
.box ul{margin:6px 0 0;padding-left:18px}
.sign{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:40px;font-size:12.5px;color:var(--muted)}
.sign div{border-top:1px solid var(--ink);padding-top:6px}
.foot{margin-top:26px;font-size:11.5px;color:var(--muted)}
@page{size:A4;margin:0}
@media print{body{background:#fff}.toolbar{display:none}.page{margin:0;box-shadow:none;min-height:auto}}
@media (max-width:820px){.page{padding:20px}.parties,.sign{grid-template-columns:1fr}}
`;

function studioOf(settings) {
  const s = settings.studio || {};
  return { name: s.name || 'Your Studio', email: s.email || 'hello@example.com', phone: s.phone || '', website: s.website || '' };
}

function docShell(title, body, backHref) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><meta name="robots" content="noindex"><style>${DOC_CSS}</style></head><body>
<div class="toolbar"><a href="${esc(backHref)}">← Back</a><button onclick="print()">Print / Save as PDF</button></div>
<main class="page">${body}</main></body></html>`;
}

function header(studio, type, number, rows) {
  return `<div class="head"><div><strong>${esc(studio.name)}</strong><span class="muted">${[studio.email, studio.phone, studio.website].filter(Boolean).map(esc).join(' · ')}</span></div>
<div class="doc-type"><b>${esc(type)}</b><span class="muted">${esc(number)}</span>${rows.map((r) => `<div class="muted">${r}</div>`).join('')}</div></div>`;
}

function clientBlock(p, title = 'For') {
  const i = p.intake;
  return `<div><h3>${esc(title)}</h3><b>${esc(i.businessName)}</b><br>${[i.address || i.location, i.email, i.phone].filter(Boolean).map(esc).join('<br>')}</div>`;
}

function proposal(p, backHref, settings = pricing.load()) {
  const d = p.documents.proposal;
  const studio = studioOf(settings);
  const pkg = settings.packages.find((x) => x.id === d.packageId) || {};
  const pages = p.intake.pages.map((x) => x[0].toUpperCase() + x.slice(1)).join(', ');
  const priced = d.total > 0;
  const body = `${header(studio, 'Proposal', d.number, [`Date: ${date(d.createdAt)}`, `Valid until: ${date(d.createdAt, d.validDays)}`])}
<div class="parties">${clientBlock(p, 'Prepared for')}<div><h3>Project</h3><b>${esc(d.packageName)} website</b><br>Pages: ${esc(pages)}<br>Design style: ${esc((p.intake.style || 'classic').replace(/^./, (c) => c.toUpperCase()))}</div></div>
<div class="box"><h3>What you get</h3>${esc(pkg.summary || '')}<ul>
<li>Copywriting for every page, written for your customers</li><li>Design and build on WordPress, in your brand colours</li>
<li>Works on phones, tablets and computers</li><li>Contact form, map, WhatsApp and call buttons</li>
<li>Google basics: titles, descriptions, sitemap, business details</li><li>${esc(String(d.revisionRounds))} revision round${d.revisionRounds === 1 ? '' : 's'}, then launch and a training video</li></ul></div>
<table><thead><tr><th>Item</th><th class="num">Amount</th></tr></thead><tbody>
<tr><td>${esc(d.packageName)} website (${esc(String(d.pages))} page${d.pages === 1 ? '' : 's'})</td><td class="num">${priced ? esc(money(settings, d.total, d.currency)) : 'To be confirmed'}</td></tr>
<tr><td>Domain and hosting</td><td class="num">At cost</td></tr>
<tr class="total"><td>Total</td><td class="num">${priced ? esc(money(settings, d.total, d.currency)) : 'To be confirmed'}</td></tr></tbody></table>
<div class="box"><h3>Payment</h3>50% to start${priced ? ` (${esc(money(settings, p.documents.deposit.amount, d.currency))})` : ''}, 50% at launch. Extra revision rounds are quoted separately. Timeline: about three weeks from your brief, depending on how quickly feedback comes back.</div>
<div class="sign"><div>Accepted by (name and date)</div><div>${esc(studio.name)}</div></div>
<p class="foot">This proposal is valid for ${d.validDays} days.</p>`;
  return docShell(`Proposal ${d.number}`, body, backHref);
}

function invoice(p, kind, backHref, settings = pricing.load()) {
  const d = p.documents[kind];
  const studio = studioOf(settings);
  const prop = p.documents.proposal;
  const priced = d.amount > 0;
  const body = `${header(studio, 'Invoice', d.number, [`Date: ${date(d.createdAt)}`, `Due: ${date(d.createdAt, d.dueDays)}`])}
<div class="parties">${clientBlock(p, 'Bill to')}<div><h3>Reference</h3>Proposal ${esc(prop.number)}<br>${esc(prop.packageName)} website</div></div>
<table><thead><tr><th>Description</th><th class="num">Amount</th></tr></thead><tbody>
<tr><td>${esc(prop.packageName)} website: ${esc(d.label)}</td><td class="num">${priced ? esc(money(settings, d.amount, d.currency)) : 'To be confirmed'}</td></tr>
<tr class="total"><td>Amount due</td><td class="num">${priced ? esc(money(settings, d.amount, d.currency)) : 'To be confirmed'}</td></tr></tbody></table>
<div class="box"><h3>How to pay</h3>Bank transfer, eSewa or Khalti. Please use <b>${esc(d.number)}</b> as the reference. Payment details are sent with this invoice.</div>
<p class="foot">Thank you for your business. Questions: ${esc(studio.email)}${studio.phone ? ` · ${esc(studio.phone)}` : ''}</p>`;
  return docShell(`Invoice ${d.number}`, body, backHref);
}

// The page the client opens from their email: draft site, comments, approve.
function review(p, { token, flash } = {}) {
  const i = p.intake;
  const site = p.wordpress?.siteUrl ? `${p.wordpress.siteUrl}/` : '';
  const pages = Object.keys(p.wordpress?.pages || {});
  const comments = p.review?.comments || [];
  const approved = p.review?.approvedAt;
  const docs = p.documents || {};
  const base = `/review/${esc(token)}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Review: ${esc(i.businessName)}</title><meta name="robots" content="noindex">
<link rel="stylesheet" href="/static/style.css"><style>
.rv{max-width:1280px;margin:0 auto;padding:24px clamp(14px,3vw,32px)}
.rv-head{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-end;margin-bottom:18px}
.rv-head h1{margin:0}.rv-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:22px;align-items:start}
.rv-frame{background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:0 24px 50px -30px rgba(15,23,42,.45)}
.rv-bar{display:flex;gap:8px;align-items:center;padding:10px 12px;border-bottom:1px solid var(--line);background:var(--bg-2)}
.rv-bar select{flex:1;min-width:0}.rv-bar button{border:1px solid var(--line);background:var(--card);border-radius:8px;padding:7px 10px;cursor:pointer;font:inherit}
.rv-bar button[aria-pressed=true]{background:var(--primary);color:#fff;border-color:var(--primary)}
.rv-view{display:flex;justify-content:center;background:#e5e7eb}
.rv-view iframe{width:100%;height:78vh;border:0;background:#fff;transition:width .3s}
.rv-view.phone iframe{width:390px;max-width:100%}
.rv-side{display:grid;gap:16px}
.rv-comments{list-style:none;padding:0;margin:0;display:grid;gap:10px;max-height:340px;overflow:auto}
.rv-comments li{background:var(--bg-2);border-radius:10px;padding:10px 12px;font-size:14px}
.rv-comments small{display:block;color:var(--muted);font-size:12px;margin-bottom:2px}
.rv-docs a{display:block;padding:8px 0}
.approved{background:var(--good-bg);color:var(--good);border-radius:12px;padding:14px 16px;font-weight:600}
@media (max-width:980px){.rv-grid{grid-template-columns:1fr}.rv-view iframe{height:70vh}}
</style></head><body>
<div class="rv">
  <div class="rv-head"><div><p class="muted small" style="margin:0">Website draft for review</p><h1>${esc(i.businessName)}</h1></div>
  ${approved ? `<div class="approved">Approved on ${esc(date(approved))}. Thank you!</div>` : ''}</div>
  ${flash ? `<div class="flash ok">${esc(flash)}</div>` : ''}
  <div class="rv-grid">
    <div class="rv-frame">
      ${site
        ? `<div class="rv-bar"><select id="rvPage" aria-label="Page">${pages.map((slug) => `<option value="${esc(slug === 'home' ? site : `${site}${slug}/`)}">${esc(slug === 'home' ? 'Home' : slug[0].toUpperCase() + slug.slice(1))}</option>`).join('')}</select>
           <button type="button" data-view="desktop" aria-pressed="true">Computer</button><button type="button" data-view="phone" aria-pressed="false">Phone</button>
           <a class="btn ghost small" href="${esc(site)}" target="_blank" rel="noopener">Open</a></div>
           <div class="rv-view" id="rvView"><iframe id="rvFrame" src="${esc(site)}" title="Website draft"></iframe></div>`
        : '<p style="padding:20px">The draft is being built. Refresh this page in a few minutes.</p>'}
    </div>
    <aside class="rv-side">
      ${approved ? '' : `<form method="post" action="${base}/approve" class="card">
        <h2>Happy with it?</h2><p class="small muted">Approving lets us prepare the launch. You can still send small changes after.</p>
        <label class="field">Your name<input name="name" required maxlength="80"></label>
        <label class="chip" style="margin:6px 0 12px"><input type="checkbox" name="confirm" value="yes" required><span>I approve this website for launch</span></label>
        <button class="btn" type="submit">Approve the website</button></form>`}
      <form method="post" action="${base}/comment" class="card">
        <h2>Request a change</h2>
        <label class="field">Your name<input name="name" required maxlength="80"></label>
        <label class="field">Page<select name="page">${['Whole site', ...pages.map((s) => (s === 'home' ? 'Home' : s[0].toUpperCase() + s.slice(1)))].map((x) => `<option>${esc(x)}</option>`).join('')}</select></label>
        <label class="field">What should change?<textarea name="text" rows="4" required maxlength="2000"></textarea></label>
        <button class="btn ghost" type="submit">Send comment</button>
      </form>
      ${comments.length ? `<div class="card"><h2>Comments (${comments.length})</h2><ul class="rv-comments">${comments.slice().reverse().map((c) => `<li><small>${esc(c.name)} · ${esc(c.page)} · ${esc(date(c.at))}</small>${esc(c.text)}</li>`).join('')}</ul></div>` : ''}
      <div class="card rv-docs"><h2>Your documents</h2>
        ${docs.proposal ? `<a href="${base}/proposal">Proposal ${esc(docs.proposal.number)}</a>` : ''}
        ${docs.deposit ? `<a href="${base}/invoice/deposit">Deposit invoice ${esc(docs.deposit.number)}</a>` : ''}
        ${docs.final ? `<a href="${base}/invoice/final">Final invoice ${esc(docs.final.number)}</a>` : ''}
      </div>
    </aside>
  </div>
</div>
<script>
(() => {
  const frame = document.getElementById('rvFrame'), view = document.getElementById('rvView'), page = document.getElementById('rvPage');
  if (!frame) return;
  page.addEventListener('change', () => { frame.src = page.value; });
  document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('[data-view]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    view.classList.toggle('phone', b.dataset.view === 'phone');
  }));
})();
</script></body></html>`;
}

function outbox(drafts, projectsById) {
  const open = drafts.filter((d) => !d.done);
  const rows = drafts
    .map((d) => {
      const p = projectsById[d.projectId];
      return `<article class="card reveal ${d.done ? 'muted' : ''}">
  <div class="card-head"><h2>${esc(d.subject)}</h2>${d.done ? '<span class="tag good">Sent</span>' : '<span class="tag you">To send</span>'}</div>
  <p class="small muted">To ${esc(d.to)} · ${esc(date(d.createdAt))}${p ? ` · <a href="/p/${esc(p.id)}">${esc(p.intake.businessName)}</a>` : ''}</p>
  <pre class="outbox-body" id="mail-${esc(d.id)}">${esc(d.body)}</pre>
  <div class="row-actions" style="display:flex;gap:8px;flex-wrap:wrap">
    <a class="btn small" href="mailto:${esc(d.to)}?subject=${encodeURIComponent(d.subject)}&amp;body=${encodeURIComponent(d.body)}">Open in email app</a>
    <button type="button" class="btn ghost small" data-copy="#mail-${esc(d.id)}">Copy text</button>
    <form method="post" action="/outbox/${esc(d.id)}/done"><input type="hidden" name="done" value="${d.done ? '0' : '1'}"><button class="btn ghost small">${d.done ? 'Mark as not sent' : 'Mark as sent'}</button></form>
  </div>
</article>`;
    })
    .join('\n');
  return {
    title: 'Outbox',
    body: `<section class="page-head"><div><h1>Outbox</h1><p class="muted">Emails SiteKit has drafted for your clients. Nothing is sent automatically: open each in your email app, or copy the text. ${open.length} to send.</p></div></section>
<style>.outbox-body{white-space:pre-wrap;font:inherit;font-size:14px;background:var(--bg-2);border-radius:10px;padding:12px 14px;margin:10px 0}</style>
${drafts.length ? `<div style="display:grid;gap:16px">${rows}</div>` : '<section class="empty card"><h2>No emails yet</h2><p class="muted">When a brief comes in or a client approves a site, the email to send appears here.</p></section>'}`,
  };
}

function thanks(businessName) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Thank you</title>
<link rel="stylesheet" href="/static/style.css"></head><body><main style="max-width:620px;margin:12vh auto;padding:0 20px;text-align:center">
<h1>Thank you${businessName ? `, ${esc(businessName)}` : ''}!</h1><p class="muted">We've received your brief and photos. We'll send you a link to review the first draft of your website, usually within a few days.</p></main></body></html>`;
}

module.exports = { proposal, invoice, review, outbox, thanks };
