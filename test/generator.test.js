const test = require('node:test');
const assert = require('node:assert');
const { parseIntake, validateIntake, intakeWarnings, parseServices, parseTestimonials } = require('../src/intake');
const { generateSite, countPlaceholders } = require('../src/generator');
const b = require('../src/blocks');

const body = {
  businessName: 'Test <Co>',
  description: 'We do things.',
  services: 'Repairs: Fixing stuff\nInstalls',
  email: 'a@b.co',
  phone: '+1 555 0100',
  pages: ['about', 'services', 'contact', 'nonsense'],
  colourPrimary: '#ABCDEF',
  colourSecondary: 'red',
};

test('parseIntake cleans input and drops unknown pages / bad colours', () => {
  const i = parseIntake(body);
  assert.deepStrictEqual(i.pages, ['home', 'about', 'services', 'contact']);
  assert.strictEqual(i.colours.primary, '#abcdef');
  assert.strictEqual(i.colours.secondary, '#1e293b'); // fallback
  assert.deepStrictEqual(i.services, [
    { name: 'Repairs', description: 'Fixing stuff' },
    { name: 'Installs', description: '' },
  ]);
});

test('validateIntake requires name, email and logo', () => {
  const errors = validateIntake(parseIntake({}));
  assert.strictEqual(errors.length, 3);
  assert.deepStrictEqual(validateIntake({ ...parseIntake(body), logo: {} }), []);
});

test('intakeWarnings flags thin intake', () => {
  const w = intakeWarnings({ ...parseIntake(body), logo: {} }).join(' ');
  assert.match(w, /very short/);
  assert.match(w, /no description/);
  assert.match(w, /No testimonials/);
});

test('parseTestimonials splits quote and author', () => {
  assert.deepStrictEqual(parseTestimonials('"Great" - Sam\nNo author'), [
    { quote: 'Great', author: 'Sam' },
    { quote: 'No author', author: '' },
  ]);
});

test('parseServices caps the list', () => {
  assert.strictEqual(parseServices(Array.from({ length: 30 }, (_, i) => `S${i}`).join('\n')).length, 12);
});

test('generateSite builds the selected pages with escaped content', () => {
  const intake = { ...parseIntake(body), logo: {} };
  const pages = generateSite(intake, { logo: null, media: [{ id: 5, url: 'http://x/a.jpg', alt: 'A "photo"' }] });
  assert.deepStrictEqual(pages.map((p) => p.slug), ['home', 'about', 'services', 'contact']);
  const home = pages[0].content;
  assert.ok(home.includes('Test &lt;Co&gt;'));
  assert.ok(!home.includes('<Co>'));
  assert.ok(home.includes('alt="A &quot;photo&quot;"'));
  assert.ok(home.includes('class="wp-image-5"'));
  assert.ok(home.includes('href="tel:+15550100"'));
  // No testimonials given -> no quote block (we never invent social proof).
  assert.ok(!home.includes('wp:quote'));
  assert.ok(countPlaceholders(pages[1].content) > 0);
});

test('every opened block is closed', () => {
  const intake = { ...parseIntake({ ...body, pages: ['about', 'services', 'contact', 'blog'], testimonials: 'Nice - Al' }), logo: {} };
  for (const page of generateSite(intake, { media: [{ url: 'u', alt: '' }, { url: 'v', alt: '' }, { url: 'w', alt: '' }] })) {
    const opens = (page.content.match(/<!-- wp:[a-z/-]+/g) || []).filter((s) => !s.startsWith('<!-- wp:/'));
    const closes = page.content.match(/<!-- \/wp:/g) || [];
    assert.strictEqual(opens.length, closes.length, `unbalanced blocks on ${page.slug}`);
  }
});

test('block attributes escape comment-breaking sequences', () => {
  assert.strictEqual(b.attrs({ a: 'x -- <y>' }), ' {"a":"x \\u002d\\u002d \\u003cy\\u003e"}');
});

test('readableOn picks legible text for any brand colour', () => {
  const { readableOn } = require('../src/colour');
  assert.strictEqual(readableOn('#7c4a1e'), '#ffffff'); // dark brown
  assert.strictEqual(readableOn('#facc15'), '#111111'); // yellow
  assert.strictEqual(readableOn('#f5ede4'), '#111111'); // cream
});

test('header shows a wide logo large and drops the text title', () => {
  const theme = require('../src/theme');
  const wide = theme.header({ logo: { width: 800, height: 240 } });
  const square = theme.header({ logo: { width: 400, height: 400 } });
  assert.ok(!wide.includes('wp:site-title'));
  assert.ok(square.includes('wp:site-title'));
});

test('a light hero colour is never used as the overlay behind white text', () => {
  const { palette } = require('../src/generator');
  const p = palette({ colours: { primary: '#2563eb', secondary: '#fef9c3', accent: '#ffffff' } });
  assert.strictEqual(p.overlay, '#111111');
});

test('internal links stay inside the client site on a multisite', () => {
  const intake = { ...parseIntake({ ...body, pages: ['about', 'services', 'contact'] }), logo: {} };
  const pages = generateSite(intake, { media: [] }, null, { siteUrl: 'http://localhost:8080/client-a/' });
  const links = pages.flatMap((p) => p.content.match(/href="[^"]*\/(contact|about|services)\/"/g) || []);
  assert.ok(links.length > 3);
  for (const l of links) assert.match(l, /^href="http:\/\/localhost:8080\/client-a\/(contact|about|services)\/"$/);
  // Without a site URL (preview), links are root-relative as before.
  assert.ok(generateSite(intake, { media: [] })[0].content.includes('href="/contact/"'));
});

test('contact page uses the SiteKit form when the plugin is active', () => {
  const intake = { ...parseIntake({ ...body, pages: ['contact'] }), logo: {} };
  const withForm = generateSite(intake, { media: [] }, null, { contactForm: true }).find((p) => p.slug === 'contact').content;
  const without = generateSite(intake, { media: [] }).find((p) => p.slug === 'contact').content;
  assert.ok(withForm.includes('[sitekit_contact to="a@b.co"]'));
  assert.ok(!/\[Replace with a contact form/.test(withForm));
  assert.ok(/\[Replace with a contact form/.test(without));
});

test('a one-page site never links to pages it does not have', () => {
  const theme = require('../src/theme');
  const intake = { ...parseIntake({ businessName: 'Solo', email: 'a@b.co', phone: '+1 555 0100', services: 'A: x\nB: y' }), logo: {} };
  const pages = generateSite(intake, { media: [] }, null, { siteUrl: 'http://site' });
  assert.deepStrictEqual(pages.map((p) => p.slug), ['home']);
  const html = pages[0].content + theme.header(intake, 'http://site');
  assert.ok(!/href="http:\/\/site\/(contact|about|services)\/"/.test(html), 'no links to missing pages');
  assert.ok(html.includes('href="tel:+15550100"'), 'main button calls the business instead');
});

test('the main button text comes from the intake', () => {
  const intake = { ...parseIntake({ ...body, ctaLabel: 'Book a class', pages: ['contact'] }), logo: {} };
  const html = generateSite(intake, { media: [] })[0].content;
  assert.ok(html.includes('>Book a class</a>'));
  assert.ok(!html.includes('Get a quote'));
  assert.strictEqual(parseIntake({}).ctaLabel, 'Get a quote');
});

test('contact page skips the map placeholder for businesses with a service area but no address', () => {
  const remote = { ...parseIntake({ ...body, pages: ['contact'], serviceArea: 'Clients anywhere' }), logo: {} };
  const unknown = { ...parseIntake({ ...body, pages: ['contact'] }), logo: {} };
  const contactOf = (i) => generateSite(i, { media: [] }, null, { contactForm: true }).find((p) => p.slug === 'contact').content;
  assert.ok(!contactOf(remote).includes('[Add a map'));
  assert.ok(contactOf(remote).includes('Clients anywhere'));
  assert.ok(contactOf(unknown).includes('[Add a map'));
});

test('hero shows a photo collage with a badge when there are enough photos, and text only otherwise', () => {
  const intake = { ...parseIntake({ ...body, yearsInBusiness: '12', pages: ['about'] }), logo: {} };
  const photos = [1, 2, 3].map((n) => ({ url: `http://x/p${n}.jpg`, alt: `Photo ${n}` }));
  const withPhotos = generateSite(intake, { media: photos })[0].content;
  assert.ok(withPhotos.includes('sk-hero-grid') && withPhotos.includes('sk-hero-collage'));
  assert.ok(withPhotos.includes('<strong>12+</strong>'));
  assert.ok(withPhotos.includes('sk-hero-decor') && withPhotos.includes('sk-scroll-cue'));
  const onePhoto = generateSite(intake, { media: photos.slice(0, 1) })[0].content;
  assert.ok(!onePhoto.includes('sk-hero-collage') && onePhoto.includes('sk-hero-text'));
  // The business name in the decorative marquee is escaped like everywhere else.
  assert.ok(!withPhotos.includes('<Co>'));
});

test('inner pages get photo banners with breadcrumbs, service jump links, contact quick actions and an About mosaic', () => {
  const intake = { ...parseIntake({ ...body, location: 'Patan', services: 'Repairs: Fixing\nInstalls: Fitting', pages: ['about', 'services', 'contact'] }), logo: {} };
  const media = [1, 2, 3, 4, 5, 6].map((n) => ({ url: `http://x/p${n}.jpg`, alt: `Photo ${n}` }));
  const pages = Object.fromEntries(generateSite(intake, { media }, null, { contactForm: true, siteUrl: 'http://localhost:8080/client-a' }).map((p) => [p.slug, p.content]));
  for (const slug of ['about', 'services', 'contact']) {
    assert.ok(pages[slug].includes('sk-pagehero'), `${slug} has a photo banner`);
    assert.ok(pages[slug].includes('class="sk-breadcrumb"') && pages[slug].includes('href="http://localhost:8080/client-a/"'), `${slug} breadcrumb links home`);
  }
  assert.ok(pages.services.includes('href="#service-1"') && pages.services.includes('id="service-2"'), 'jump links match row anchors');
  assert.ok(pages.contact.includes('class="sk-qcard" href="tel:'), 'contact has a call card');
  assert.ok(pages.contact.includes('google.com/maps/search/'), 'contact has a directions card');
  assert.ok(pages.about.includes('sk-mosaic') && pages.about.includes('sk-card-num'), 'about has a mosaic and numbered values');
  // Without photos, banners fall back to the plain brand band and still show breadcrumbs.
  const plain = generateSite(intake, { media: [] }).find((p) => p.slug === 'about').content;
  assert.ok(!plain.includes('sk-pagehero') && plain.includes('sk-breadcrumb'));
});

test('header top bar shows only the details the client gave', () => {
  const theme = require('../src/theme');
  const full = theme.header({ ...parseIntake({ ...body, location: 'Patan', whatsapp: '+977 9800000000' }), logo: null }, 'http://x');
  assert.ok(full.includes('sk-topbar') && full.includes('tel:') && full.includes('wa.me') && full.includes('mailto:a@b.co'));
  const none = theme.header({ ...parseIntake({ businessName: 'X', email: '' }), logo: null }, 'http://x');
  assert.ok(!none.includes('sk-topbar'));
});

test('every page carries an SEO title and description: written copy first, sensible defaults otherwise', () => {
  const intake = { ...parseIntake({ ...body, tagline: 'Fixing things since 1999', location: 'Patan, Lalitpur', pages: ['about', 'contact'] }), logo: {} };
  const copy = { seo: { home: { title: 'Test Co | Repairs in Patan', description: 'Repairs and installs in Patan.' } } };
  const pages = generateSite(intake, { media: [] }, copy);
  const home = pages.find((p) => p.slug === 'home');
  assert.deepStrictEqual(home.seo, { title: 'Test Co | Repairs in Patan', description: 'Repairs and installs in Patan.' });
  assert.strictEqual(pages.find((p) => p.slug === 'about').seo.title, 'About | Test <Co>');
  const noCopy = generateSite({ ...intake, description: 'word '.repeat(80) }, { media: [] }).find((p) => p.slug === 'home').seo;
  assert.strictEqual(noCopy.title, 'Test <Co> | Fixing things since 1999');
  assert.ok(noCopy.description.length <= 160 && noCopy.description.endsWith('…'));
});
