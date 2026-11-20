const test = require('node:test');
const assert = require('node:assert');
const { parseIntake } = require('../src/intake');
const { generateSite } = require('../src/generator');
const theme = require('../src/theme');
const i18n = require('../src/i18n');

const base = { businessName: 'Momo House', email: 'a@b.co', pages: ['about', 'services', 'contact'], ctaLabel: 'Book a table' };

test('English sites are unchanged: no language fields on pages', () => {
  const pages = generateSite(parseIntake(base), { media: [] }, null, { siteUrl: 'http://x/s' });
  assert.deepStrictEqual(pages.map((p) => p.slug), ['home', 'about', 'services', 'contact']);
  assert.ok(pages.every((p) => p.lang === 'en' && !p.alt && !p.parentSlug));
});

test('bilingual: Nepali pages under /ne/, linked both ways, in Nepali', () => {
  const intake = parseIntake({ ...base, language: 'both', businessNameNe: 'मोमो घर', servicesNe: 'मम: हातले बनाएको' });
  const pages = generateSite(intake, { media: [] }, null, { siteUrl: 'http://x/s', contactForm: true });
  const ne = pages.filter((p) => p.lang === 'ne');
  assert.deepStrictEqual(ne.map((p) => [p.slug, p.parentSlug || '']), [['ne', ''], ['about', 'ne'], ['services', 'ne'], ['contact', 'ne']]);
  assert.strictEqual(pages.find((p) => p.lang === 'en' && p.slug === 'about').alt, 'http://x/s/ne/about/');
  assert.strictEqual(ne[0].alt, 'http://x/s/');
  const home = ne[0].content;
  assert.ok(home.includes('मोमो घर') && home.includes('हामी के गर्छौं') && home.includes('टेबल बुक गर्नुहोस्'), 'Nepali name, headings and button');
  assert.ok(home.includes('http://x/s/ne/services/'), 'links stay in Nepali');
  assert.ok(ne[3].content.includes('lang="ne"]'), 'Nepali contact form');
  assert.strictEqual(i18n.getLang(), 'en', 'language reset after generating');
});

test('Nepali-only site: Nepali pages at the root', () => {
  const pages = generateSite(parseIntake({ ...base, language: 'ne' }), { media: [] }, null, { siteUrl: 'http://x/s' });
  assert.deepStrictEqual(pages.map((p) => p.slug), ['home', 'about', 'services', 'contact']);
  assert.strictEqual(pages[1].title, 'हाम्रो बारेमा');
});

test('bilingual header and footer carry a menu per language and a switch', () => {
  const intake = parseIntake({ ...base, language: 'both' });
  const header = theme.header(intake, 'http://x/s');
  assert.ok(header.includes('"className":"sk-only-en"') && header.includes('"className":"sk-only-ne"'));
  assert.ok(header.includes('http://x/s/ne/about/') && header.includes('sk-langswitch'));
  const footer = theme.footer(intake, 'http://x/s');
  assert.ok(footer.includes('पृष्ठहरू') && footer.includes('>Pages<'), 'both footers, each in its language');
  assert.ok(!theme.header(parseIntake(base), 'http://x/s').includes('sk-langswitch'));
});
