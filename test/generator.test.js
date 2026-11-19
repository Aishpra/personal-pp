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
