#!/usr/bin/env node
// Builds your agency website (agency/site/) into dist/agency/, ready for any static host such
// as GitHub Pages: the homepage, one landing page per kind of business (agency/niches.json),
// a 404 page, sitemap, robots.txt, web manifest and structured data for search engines.
// Studio name, contact details and package prices come from the Pricing page; the portfolio
// comes from the sample sites in samples/samples.json.
//
//   npm run agency:build
//   FORMSPREE_ID=abcdwxyz npm run agency:build          the quote form sends through Formspree
//   SITE_URL=https://example.com/ npm run agency:build  the public address, when publishing (default: local demo)
//
// Without FORMSPREE_ID the quote form opens the visitor's email app with the message filled in.
const fs = require('fs');
const path = require('path');
const pricing = require('../src/pricing');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'agency', 'site');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'dist', 'agency'));
const FORMSPREE_ID = (process.env.FORMSPREE_ID || '').replace(/[^\w-]/g, '');
// Local demo by default (served by SiteKit at /agency/). To publish, build with the public
// address, e.g. SITE_URL=https://aishpra.github.io/ npm run agency:build
const SITE_URL = (process.env.SITE_URL || `http://localhost:${process.env.PORT || 3000}/agency/`).replace(/\/?$/, '/');
const NICHE_DIR = 'websites-for';

// Sample dir -> [filter category, short label]. Samples not listed go under "services".
const CATEGORIES = {
  'kettle-and-crow': ['food', 'Café'],
  'thakali-hearth': ['food', 'Restaurant'],
  'bandipur-hilltop': ['food', 'Homestay'],
  'summit-trail-treks': ['services', 'Trekking agency'],
  'northlight-dental': ['health', 'Dental clinic'],
  'rhododendron-hospital': ['health', 'Hospital'],
  'juniper-hall-yoga': ['health', 'Yoga studio'],
  'ironbark-fitness': ['health', 'Gym'],
  'himalayan-ridge-college': ['education', 'College'],
  'little-pine-school': ['education', 'School'],
  'dhaka-thread': ['retail', 'Clothing brand'],
  'bazaar-box': ['retail', 'Online store'],
  'golden-hour-frames': ['services', 'Photographer'],
  'pillar-legal': ['services', 'Law firm'],
  'courtyard-homes': ['services', 'Real estate'],
  'himal-crust-bakery': ['food', 'Bakery'],
  'utsav-event-venue': ['food', 'Event venue'],
  'patan-heritage-suites': ['food', 'Boutique hotel'],
  'ilam-tea-estate': ['food', 'Tea estate'],
  'paws-vet': ['health', 'Vet clinic'],
  'care-plus-pharmacy': ['health', 'Pharmacy'],
  'lotus-glow-salon': ['health', 'Salon & spa'],
  'sur-sangeet-music': ['education', 'Music school'],
  'bright-path-tuition': ['education', 'Tuition centre'],
  'steady-wheel-driving': ['education', 'Driving school'],
  'volt-electronics': ['retail', 'Electronics shop'],
  'saato-weddings': ['services', 'Wedding planner'],
  'yatra-travels': ['services', 'Travel agency'],
  'hive-cowork': ['services', 'Coworking space'],
  'code-sherpa': ['services', 'Software company'],
  'green-hands-ngo': ['services', 'Non-profit'],
  'nest-interiors': ['services', 'Interior design'],
  'bastu-architects': ['services', 'Architects'],
  'auto-care-garage': ['services', 'Car service'],
  'night-owl-dev': ['services', 'Developer portfolio'],
};
const STYLE_NAMES = { classic: 'Classic', bold: 'Bold', elegant: 'Elegant', playful: 'Playful', minimal: 'Minimal', luxe: 'Luxe', organic: 'Organic', corporate: 'Corporate' };
const HERO = ['saato-weddings', 'code-sherpa', 'himal-crust-bakery'];
const PHONE = 'himal-crust-bakery';
// The featured reel: one strong example per style and kind of business.
const FEATURED = ['rhododendron-hospital', 'code-sherpa', 'saato-weddings', 'himal-crust-bakery', 'bastu-architects', 'patan-heritage-suites', 'summit-trail-treks'];
const PLACEHOLDER = { name: 'Your Studio', email: 'hello@example.com', phone: '+977 1-555-0199' };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// Trims text to max characters at a word break (for search snippets).
const clip = (text, max) => (text.length <= max ? text : `${text.slice(0, text.lastIndexOf(' ', max - 1))}…`);
const jsonLd = (data) => JSON.stringify(data).replace(/</g, '\\u003c');
const fill = (tpl, values, file) => {
  const out = tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in values ? values[k] : m));
  const left = out.match(/\{\{\w+\}\}/g);
  if (left) throw new Error(`${file}: unfilled placeholders ${[...new Set(left)].join(', ')}`);
  return out;
};
const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

function main() {
  const settings = pricing.load();
  const ready = settings.hourlyRate > 0;
  const price = (id) => {
    const pkg = settings.packages.find((p) => p.id === id);
    return ready && pkg ? pricing.money(settings, pricing.quote(settings, pkg).price) : 'Ask us';
  };
  const careText = ready ? pricing.money(settings, pricing.careQuote(settings).price) : 'Ask us';
  const shopText = ready ? pricing.money(settings, pricing.shopQuote(settings).price) : 'Ask us';
  const studio = {
    name: settings.studio.name || PLACEHOLDER.name,
    email: settings.studio.email || PLACEHOLDER.email,
    phone: settings.studio.phone || PLACEHOLDER.phone,
  };
  const digits = studio.phone.replace(/[^\d+]/g, '');
  const today = new Date().toISOString().slice(0, 10);

  const { samples } = JSON.parse(fs.readFileSync(path.join(ROOT, 'samples', 'samples.json'), 'utf8'));
  const byDir = Object.fromEntries(samples.map((s) => [s.dir, s]));
  const { niches } = JSON.parse(fs.readFileSync(path.join(ROOT, 'agency', 'niches.json'), 'utf8'));
  const nicheOf = (dir) => niches.find((n) => n.samples.includes(dir));
  const nicheUrl = (n, root) => `${root}${NICHE_DIR}/${n.slug}/`;

  const shotsDir = path.join(SRC, 'assets', 'work');
  const shown = samples.filter((s) => fs.existsSync(path.join(shotsDir, `${s.dir}-full.webp`)));

  // A portfolio card; links to the matching landing page when there is one.
  const shot = (s, i, root) => {
    const [cat, label] = CATEGORIES[s.dir] || ['services', 'Business'];
    const style = s.intake.style || 'classic';
    const niche = nicheOf(s.dir);
    const link = niche ? `<a class="niche-link" href="${nicheUrl(niche, root)}"><span>Websites for ${esc(niche.plural)}</span></a>` : '';
    return `        <figure class="shot reveal" style="--d:${i % 3}" data-cat="${cat}" data-style="${esc(style)}">${link}<div class="img"><img src="${root}assets/work/${esc(s.dir)}-full.webp" alt="${esc(s.intake.businessName)} website, ${esc(STYLE_NAMES[style] || style)} style" loading="lazy" decoding="async"></div><figcaption><div><b>${esc(s.intake.businessName)}</b><small>${esc(s.intake.location)} · ${esc(STYLE_NAMES[style] || style)} style</small></div><span class="tag">${esc(label)}</span></figcaption></figure>`;
  };

  const featured = FEATURED.filter((d) => byDir[d] && fs.existsSync(path.join(shotsDir, `${d}.webp`)))
    .map((d, i) => {
      const s = byDir[d];
      const style = STYLE_NAMES[s.intake.style || 'classic'];
      const niche = nicheOf(d);
      const href = niche ? nicheUrl(niche, './') : './#work';
      return `        <a class="feat-card" href="${href}"><span class="num">${String(i + 1).padStart(2, '0')}</span><img src="assets/work/${esc(d)}.webp" alt="${esc(s.intake.businessName)} website, ${esc(style)} style" width="1200" height="750" loading="lazy" decoding="async"><span class="meta"><span><b>${esc(s.intake.businessName)}</b><small>${esc((CATEGORIES[d] || [])[1] || '')} · ${esc(style)} style</small></span><span class="go">${ARROW}</span></span></a>`;
    })
    .join('\n');

  const shared = {
    name: esc(studio.name),
    email: esc(studio.email),
    phone: esc(studio.phone),
    phoneHref: esc(`tel:${digits}`),
    whatsappHref: esc(`https://wa.me/${digits.replace(/^\+/, '')}`),
    starter: esc(price('starter')),
    standard: esc(price('standard')),
    plus: esc(price('plus')),
    care: esc(careText),
    shop: esc(shopText),
    year: String(new Date().getFullYear()),
    siteUrl: esc(SITE_URL),
  };

  // Footer: taken from the homepage template, so every page shares it.
  const indexTpl = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  const footerTpl = indexTpl.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)[0];
  const footerFor = (root) =>
    fill(footerTpl, { ...shared, root, nicheLinks: niches.map((n) => `<a href="${nicheUrl(n, root)}">${esc(n.label)}</a>`).join('') }, 'footer');

  // Homepage structured data: the business, the website, its FAQ and price list.
  const faqs = [...indexTpl.matchAll(/<details[^>]*><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)].map((m) => [m[1], m[2]]);
  const business = {
    '@type': 'ProfessionalService',
    '@id': `${SITE_URL}#business`,
    name: studio.name,
    url: SITE_URL,
    email: studio.email,
    telephone: studio.phone,
    image: `${SITE_URL}assets/og.jpg`,
    logo: `${SITE_URL}assets/icons/icon-512.png`,
    description: 'Done-for-you websites for small businesses: copywriting, design, Google setup and launch at fixed prices.',
    areaServed: ['Nepal', 'Worldwide'],
    priceRange: ready ? `${price('starter')} to ${price('plus')}` : undefined,
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Website packages',
      itemListElement: [
        ['Starter website', 'A one-page website with copywriting, SEO basics and a contact form.', 'starter'],
        ['Standard website', 'A five-page business website with copywriting, SEO basics and training.', 'standard'],
        ['Plus website', 'Up to eight pages for businesses with more to show.', 'plus'],
      ].map(([n, d, id]) => {
        const pkg = settings.packages.find((p) => p.id === id);
        const amount = ready && pkg ? pricing.quote(settings, pkg).price : undefined;
        return { '@type': 'Offer', itemOffered: { '@type': 'Service', name: n, description: d }, price: amount, priceCurrency: ready ? settings.currency || undefined : undefined };
      }),
    },
  };
  const homeLd = {
    '@context': 'https://schema.org',
    '@graph': [
      business,
      { '@type': 'WebSite', '@id': `${SITE_URL}#website`, url: SITE_URL, name: studio.name, publisher: { '@id': `${SITE_URL}#business` }, inLanguage: 'en' },
      { '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    ],
  };

  const work = shown.map((s, i) => shot(s, i, './')).join('\n');
  const homeValues = {
    ...shared,
    root: './',
    workCount: String(shown.length),
    heroShot1: HERO[0],
    heroShot2: HERO[1],
    heroShot3: HERO[2],
    phoneShot: PHONE,
    jsonld: jsonLd(homeLd),
    formAction: esc(FORMSPREE_ID ? `https://formspree.io/f/${FORMSPREE_ID}` : `mailto:${studio.email}`),
    formButton: FORMSPREE_ID ? 'Send my request' : 'Write the email',
    formNote: FORMSPREE_ID ? 'We reply within one working day.' : 'This opens your email app with your message filled in.',
    work,
    featured,
    nicheLinks: niches.map((n) => `<a href="${nicheUrl(n, './')}">${esc(n.label)}</a>`).join(''),
    // "Try it yourself": one option per kind of business, with its photos, tagline and features.
    tryOptions: niches
      .map(
        (n) =>
          `              <option value="${esc(n.slug)}" data-label="${esc(n.label)}" data-tagline="${esc(n.tagline || n.label)}" data-features="${esc(n.features.slice(0, 3).map(([h]) => h).join('|'))}" data-photo1="assets/try/${esc(n.slug)}-1.webp" data-photo2="assets/try/${esc(n.slug)}-2.webp">${esc(n.label)}</option>`
      )
      .join('\n'),
    // The mini-site styles are SiteKit's own (public/style.css), so both previews stay in step.
    previewCss: (() => {
      const css = fs.readFileSync(path.join(ROOT, 'public', 'style.css'), 'utf8');
      const start = css.indexOf('/* ---- Live style preview (intake form) ----');
      if (start < 0) throw new Error('Preview styles not found in public/style.css');
      return css.slice(start);
    })(),
  };
  let html = fill(indexTpl, homeValues, 'index.html');
  // One shared stylesheet for every page (cached after the first visit).
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  html = html.replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="assets/site.css">');

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  fs.cpSync(path.join(SRC, 'assets'), path.join(OUT, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'assets', 'site.css'), css.trim() + '\n');
  fs.writeFileSync(path.join(OUT, 'index.html'), html);

  // Landing pages, one per kind of business.
  const nicheTpl = fs.readFileSync(path.join(SRC, 'niche.html'), 'utf8');
  const urls = [{ loc: SITE_URL, priority: '1.0' }];
  for (const n of niches) {
    const root = '../../';
    const url = `${SITE_URL}${NICHE_DIR}/${n.slug}/`;
    const examples = n.samples.map((d) => byDir[d]).filter((s) => s && fs.existsSync(path.join(shotsDir, `${s.dir}-full.webp`)));
    const titleCase = n.label.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const title = `Website Design for ${titleCase} in Nepal | ${studio.name}`;
    const description = clip(`Website design for ${n.plural} in Nepal. ${n.intro.split('. ')[0]}. Live in about three weeks, from ${price('starter')}.`, 158);
    const ld = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Service', name: `Website design for ${n.plural}`, serviceType: 'Website design', areaServed: ['Nepal', 'Worldwide'], provider: { '@type': 'ProfessionalService', name: studio.name, url: SITE_URL }, url },
        { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: `Websites for ${n.label}`, item: url }] },
        { '@type': 'FAQPage', mainEntity: n.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
      ],
    };
    const page = fill(
      nicheTpl,
      {
        ...shared,
        root,
        title: esc(title),
        description: esc(description),
        url: esc(url),
        ogImage: esc(examples[0] ? `${SITE_URL}assets/work/${examples[0].dir}.webp` : `${SITE_URL}assets/og.jpg`),
        jsonld: jsonLd(ld),
        label: esc(n.label),
        plural: esc(n.plural),
        intro: esc(n.intro),
        shots: examples.map((s, i) => shot(s, i, root)).join('\n'),
        features: n.features.map(([h, p], i) => `        <div class="feature reveal" style="--d:${i % 4}">${CHECK}<h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join('\n'),
        faq: n.faq.map(([q, a], i) => `        <details${i ? '' : ' open'}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n'),
        mailSubject: encodeURIComponent(`Website for my ${n.label.toLowerCase()} business`),
        others: niches.filter((o) => o !== n).map((o) => `<a href="${nicheUrl(o, root)}">${esc(o.label)}</a>`).join(''),
        footer: footerFor(root),
      },
      `niche ${n.slug}`
    );
    fs.mkdirSync(path.join(OUT, NICHE_DIR, n.slug), { recursive: true });
    fs.writeFileSync(path.join(OUT, NICHE_DIR, n.slug, 'index.html'), page);
    urls.push({ loc: url, priority: '0.8' });
  }

  // 404 page (GitHub Pages serves /404.html for missing pages). Absolute links, since it can
  // be shown at any depth.
  fs.writeFileSync(
    path.join(OUT, '404.html'),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page not found | ${esc(studio.name)}</title><meta name="robots" content="noindex"><link rel="icon" href="${SITE_URL}assets/icons/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="${SITE_URL}assets/site.css"></head><body><main class="hero niche-hero" style="min-height:100vh;display:grid;place-items:center"><div class="wrap hero-copy" style="text-align:center"><p class="eyebrow" style="justify-content:center">404</p><h1 style="margin:14px 0 18px">This page went <span class="accent">trekking.</span></h1><p class="lead" style="margin-inline:auto;text-align:center">We couldn't find that page. It may have moved.</p><div class="hero-ctas" style="justify-content:center"><a class="btn" href="${SITE_URL}">Back to the homepage</a><a class="btn ghost" href="${SITE_URL}#contact">Get a quote</a></div></div></main></body></html>\n`
  );
  fs.writeFileSync(
    path.join(OUT, 'site.webmanifest'),
    JSON.stringify({ name: studio.name, short_name: studio.name.slice(0, 12), start_url: './', display: 'browser', background_color: '#fbf8f3', theme_color: '#0b1533', icons: [{ src: 'assets/icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'assets/icons/icon-512.png', sizes: '512x512', type: 'image/png' }] }, null, 2)
  );
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}sitemap.xml\n`);
  fs.writeFileSync(
    path.join(OUT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`).join('\n')}\n</urlset>\n`
  );

  console.log(`Built ${studio.name} into ${OUT}: homepage, ${niches.length} landing pages, ${shown.length} portfolio sites.`);
  console.log(FORMSPREE_ID ? `Quote form sends through Formspree (${FORMSPREE_ID}).` : "Quote form opens the visitor's email app (set FORMSPREE_ID for a real form).");
  const missing = Object.keys(PLACEHOLDER).filter((k) => !settings.studio[k]);
  if (missing.length) console.log(`Still placeholders: ${missing.join(', ')}. Fill them in on the Pricing page, then build again.`);
  if (!ready) console.log('No hourly rate set on the Pricing page, so prices show "Ask us".');
}

main();
