// Pricing calculator and the printable one-pager for prospects.
const { esc } = require('./blocks');
const { PHASES } = require('./phases');
const pricing = require('./pricing');

function pricingPage(settings, { layout, flash } = {}) {
  const ready = settings.hourlyRate > 0;
  const head = PHASES.map((ph) => `<th title="${esc(ph.name)}">${esc(ph.name.replace(/^\d+\.\s*/, '').split(' ')[0])}</th>`).join('');
  const rows = settings.packages
    .map((pkg) => {
      const q = pricing.quote(settings, pkg);
      return `<tr>
  <td><input name="name_${pkg.id}" value="${esc(pkg.name)}" aria-label="Package name"><textarea name="summary_${pkg.id}" rows="2" aria-label="Package summary">${esc(pkg.summary)}</textarea>
    <div class="mini-fields"><label>Pages <input name="pages_${pkg.id}" value="${pkg.pages}" inputmode="numeric"></label><label>Revision rounds <input name="rounds_${pkg.id}" value="${pkg.revisionRounds}" inputmode="numeric"></label></div></td>
  ${PHASES.map((ph) => `<td><input class="hrs" name="h_${pkg.id}_${ph.id}" value="${pkg.hours[ph.id] ?? 0}" inputmode="decimal" aria-label="${esc(pkg.name)} ${esc(ph.name)} hours"></td>`).join('')}
  <td class="num"><strong>${q.hours}</strong> h</td>
  <td class="num price">${ready ? `<strong>${esc(pricing.money(settings, q.price))}</strong><span class="muted small">${esc(pricing.money(settings, q.effectiveRate))}/h</span>` : '<span class="muted">set rate</span>'}</td>
</tr>`;
    })
    .join('');
  const care = pricing.careQuote(settings);

  return layout(
    'Pricing',
    `<section class="page-head"><div><h1>Pricing</h1><p class="muted">Package prices worked out from your hours and rate. The one-pager uses these.</p></div>
  <a class="btn secondary" href="/one-pager" target="_blank" rel="noopener">Open the one-pager</a></section>
${flash ? `<div class="flash ok" data-autohide>${esc(flash)}</div>` : ''}
${ready ? '' : '<div class="flash warn">Set your hourly rate and currency to see prices. Until then, the one-pager shows packages without prices.</div>'}
<form method="post" action="/pricing" class="pricing">
  <div class="card">
    <h2>Your rate</h2>
    <div class="grid4 grid5">
      <label class="field">Currency<input name="currency" value="${esc(settings.currency)}" placeholder="NPR, USD, EUR…" maxlength="8"></label>
      <label class="field">Hourly rate<input name="hourlyRate" value="${settings.hourlyRate || ''}" inputmode="decimal" placeholder="e.g. 1500"></label>
      <label class="field">Buffer %<span class="hint">Covers overruns, calls, slow clients.</span><input name="bufferPercent" value="${settings.bufferPercent}" inputmode="numeric"></label>
      <label class="field">Care plan hours/month<input name="careHours" value="${settings.care.hoursPerMonth}" inputmode="decimal"></label>
      <label class="field">Online shop add-on hours<span class="hint">${ready ? esc(pricing.money(settings, pricing.shopQuote(settings).price)) : 'Set a rate'}</span><input name="shopHours" value="${settings.shop.hours}" inputmode="decimal"></label>
    </div>
    <p class="hint">How to pick a rate: what you need to earn per month ÷ the hours you can actually bill (usually 60–70% of working hours, the rest goes on sales and admin). Then check 3–5 local competitors' prices, and don't price far below them: cheap reads as low quality.</p>
  </div>
  <div class="card">
    <div class="card-head"><h2>Packages</h2><span class="muted small">Hours per phase. These are starting guesses; replace them with your real times.</span></div>
    <div class="table-wrap"><table class="pricing-table">
      <thead><tr><th>Package</th>${head}<th>Total</th><th>Price</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <p class="small">Care plan: <strong>${ready ? esc(pricing.money(settings, care.price)) + ' / month' : 'set rate'}</strong> (${settings.care.hoursPerMonth} h). Hosting and domain are extra: pass them on at cost, or add a margin, but say which.</p>
  </div>
  <div class="card">
    <h2>Your details <span class="muted small">(shown on the one-pager)</span></h2>
    <div class="grid4">
      <label class="field">Studio name<input name="studioName" value="${esc(settings.studio.name)}" placeholder="Your business name"></label>
      <label class="field">Email<input name="studioEmail" value="${esc(settings.studio.email)}" type="email"></label>
      <label class="field">Phone / WhatsApp<input name="studioPhone" value="${esc(settings.studio.phone)}"></label>
      <label class="field">Website<input name="studioWebsite" value="${esc(settings.studio.website)}"></label>
    </div>
  </div>
  <div class="submit-bar"><span class="muted">Prices are rounded up to tidy figures.</span><button class="btn">Save pricing</button></div>
</form>`,
    { active: 'pricing' }
  );
}

const SAMPLE_SHOTS = [
  ['sample-kettle-and-crow', 'Café'],
  ['sample-juniper-hall-yoga', 'Yoga studio'],
  ['sample-northlight-dental', 'Dental clinic'],
];

// A self-contained, print-ready page (A4). Open it and use the browser's Print → Save as PDF.
function onePager(settings) {
  const ready = settings.hourlyRate > 0;
  const studio = settings.studio;
  const name = studio.name || 'Your studio name';
  const pkgs = settings.packages
    .map((pkg, i) => {
      const q = pricing.quote(settings, pkg);
      const featured = i === 1;
      return `<div class="pkg ${featured ? 'featured' : ''}">
  ${featured ? '<span class="badge">Most popular</span>' : ''}
  <h3>${esc(pkg.name)}</h3>
  <p class="price">${ready ? esc(pricing.money(settings, q.price)) : 'Ask for a quote'}</p>
  <p class="sum">${esc(pkg.summary)}</p>
  <ul><li>${pkg.pages} page${pkg.pages === 1 ? '' : 's'}</li><li>Copywriting and SEO basics</li><li>Contact form and map</li><li>${pkg.revisionRounds} revision round${pkg.revisionRounds === 1 ? '' : 's'}</li></ul>
</div>`;
    })
    .join('');
  const care = pricing.careQuote(settings);
  const contact = [studio.email, studio.phone, studio.website].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)}: websites for local businesses</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<style>
:root{--ink:#111827;--muted:#4b5563;--line:#e5e7eb;--brand:#4f46e5;--soft:#eef2ff}
*{box-sizing:border-box}
body{margin:0;background:#e5e7eb;font:14px/1.5 Inter,system-ui,sans-serif;color:var(--ink);-webkit-font-smoothing:antialiased}
.page{width:210mm;min-height:297mm;margin:16px auto;background:#fff;padding:9mm 14mm 6mm;box-shadow:0 4px 24px rgba(0,0,0,.1);position:relative}
.toolbar{max-width:210mm;margin:16px auto 0;display:flex;gap:12px;align-items:center;justify-content:space-between;font-size:13px}
.toolbar button{background:var(--brand);color:#fff;border:0;border-radius:8px;padding:8px 14px;font:inherit;font-weight:600;cursor:pointer}
.warn{background:#fff7e0;color:#92400e;padding:8px 12px;border-radius:8px}
.brand{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid var(--ink);padding-bottom:8px;margin-bottom:18px}
.brand strong{font-size:18px;letter-spacing:-.01em}.brand span{color:var(--muted);font-size:12px}
h1{font-size:26px;line-height:1.15;letter-spacing:-.025em;margin:0 0 8px;max-width:24em}
.lead{font-size:14px;color:var(--muted);margin:0 0 12px;max-width:44em}
.deal{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px;font-size:13px}
.deal div{background:var(--soft);border-radius:10px;padding:8px 12px}
.deal b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--brand);margin-bottom:2px}
h2{font-size:11.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin:12px 0 6px}
.shots{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.shots figure{margin:0}.shots img{width:100%;aspect-ratio:16/9;object-fit:cover;object-position:top;border-radius:8px;border:1px solid var(--line);display:block}
.shots figcaption{font-size:11px;color:var(--muted);margin-top:3px}
.incl{columns:2;column-gap:24px;padding-left:18px;margin:0;font-size:12.5px}.incl li{margin-bottom:1px;break-inside:avoid}
.pkgs{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.pkg{border:1px solid var(--line);border-radius:12px;padding:12px 12px 10px;position:relative}
.pkg.featured{border:2px solid var(--brand)}
.badge{position:absolute;top:-9px;left:12px;background:var(--brand);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;text-transform:uppercase;letter-spacing:.06em}
.pkg h3{margin:0;font-size:15px}.pkg .price{font-size:20px;font-weight:700;letter-spacing:-.02em;margin:2px 0 4px}
.pkg .sum{color:var(--muted);font-size:11.5px;margin:0 0 6px;line-height:1.4}.pkg ul{margin:0;padding-left:16px;font-size:12px}
.care{font-size:12.5px;color:var(--muted);margin:8px 0 0}
.steps{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;counter-reset:s}
.steps div{border-top:3px solid var(--brand);padding-top:6px;font-size:12px}
.steps div::before{counter-increment:s;content:counter(s);font-weight:700;color:var(--brand);margin-right:4px}
.steps b{display:block;font-size:13px}
.terms{display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:12.5px}
.terms p{margin:0}
.foot{margin-top:10px;border-top:1px solid var(--line);padding-top:8px;display:flex;justify-content:space-between;font-size:12px}
.foot strong{font-size:13px}
.note{font-size:10px;color:var(--muted);margin:4px 0 0}
@page{size:A4;margin:0}
@media print{body{background:#fff}.toolbar{display:none}.page{margin:0;box-shadow:none;width:auto;min-height:0}}
@media screen and (max-width:820px){.page{width:auto;min-height:0;margin:8px;padding:20px}.deal,.terms{grid-template-columns:1fr}.shots,.pkgs{grid-template-columns:1fr}.steps{grid-template-columns:1fr 1fr}.foot{flex-direction:column;gap:4px}.incl{columns:1}}
</style></head>
<body>
<div class="toolbar"><span>${ready && studio.name ? 'Ready to print.' : `<span class="warn">Fill in your rate and studio details on the <a href="/pricing">Pricing</a> page first.</span>`}</span><button onclick="print()">Print / Save as PDF</button></div>
<main class="page">
  <div class="brand"><strong>${esc(name)}</strong><span>Websites for local businesses</span></div>
  <h1>A professional website for your business, ready in about three weeks.</h1>
  <p class="lead">You send us your name, logo and photos. We write the words, design and build the site, set it up for Google, and launch it. You review it before it goes live.</p>
  <div class="deal"><div><b>You provide</b>Business name, logo, photos, and a few details about what you do.</div><div><b>We deliver</b>Copywriting, design, development, SEO basics and launch.</div></div>

  <h2>Recent work <span style="text-transform:none;letter-spacing:0;font-weight:400">· sample sites for fictional businesses, built with our standard process</span></h2>
  <div class="shots">${SAMPLE_SHOTS.map(([id, label]) => `<figure><img src="/samples/screenshots/${id}-desktop.jpg" alt="${label} website example"><figcaption>${label}</figcaption></figure>`).join('')}</div>

  <h2>Every site includes</h2>
  <ul class="incl">
    <li>Works on phones, tablets and computers</li><li>Your logo, colours and photos throughout</li>
    <li>Copy written for your customers</li><li>Contact form that emails you, plus a saved copy</li>
    <li>Google Map, phone and WhatsApp buttons</li><li>Page titles and descriptions for Google</li>
    <li>Fast-loading, compressed images</li><li>A short training video when we hand over</li>
  </ul>

  <h2>Packages</h2>
  <div class="pkgs">${pkgs}</div>
  <p class="care"><strong>${esc(settings.care.name)}${ready ? `: ${esc(pricing.money(settings, care.price))} / month` : ''}.</strong> ${esc(settings.care.summary)} Optional. Domain and hosting are billed separately.</p>

  <h2>How it works</h2>
  <div class="steps">
    <div><b>Brief</b>You fill in a short form and send your files.</div>
    <div><b>Plan</b>We agree the pages and the look.</div>
    <div><b>Write &amp; build</b>We write the copy and build the site.</div>
    <div><b>Review</b>You check it and ask for changes.</div>
    <div><b>Launch</b>We go live and show you how to use it.</div>
  </div>

  <h2>Terms</h2>
  <div class="terms"><p><strong>Payment:</strong> 50% to start, 50% at launch.</p><p><strong>Changes:</strong> revision rounds as listed per package; extra rounds are quoted separately.</p></div>

  <div class="foot"><strong>${esc(name)}</strong><span>${contact || 'your email · phone · website'}</span></div>
</main>
</body></html>`;
}

module.exports = { pricingPage, onePager };
