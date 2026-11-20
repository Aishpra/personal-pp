const test = require('node:test');
const assert = require('node:assert');
const { parseIntake } = require('../src/intake');
const { generateSite } = require('../src/generator');
const theme = require('../src/theme');

const base = { businessName: 'Momo <Mandala>', email: 'a@b.co', pages: ['about', 'services', 'contact'] };
const media = [1, 2, 3, 4, 5].map((n) => ({ url: `/p${n}.jpg`, alt: `Photo ${n}` }));
const page = (pages, slug) => pages.find((p) => p.slug === slug).content;

test('new sections only appear when the client gave the content', () => {
  const pages = generateSite(parseIntake(base), { media });
  const all = pages.map((p) => p.content).join('');
  for (const cls of ['sk-team', 'sk-hours', 'sk-faq', 'sk-ba', 'sk-tslider', 'sk-visit']) assert.ok(!all.includes(`class="${cls}`), cls);
});

test('team, hours, FAQ, testimonial slider and before/after are placed and escaped', () => {
  const intake = parseIntake({
    ...base,
    team: 'Pema <b>Sherpa</b> - Head chef\nAnita - Manager',
    hours: 'Sun - Fri: 10am - 9pm\nSaturday: Closed',
    faq: 'Do you deliver? Yes, across <Kathmandu>.',
    testimonials: 'Great momos - Ram\nBest in town - Sita',
    beforeAfter: 'yes',
  });
  const pages = generateSite(intake, { media });
  const home = page(pages, 'home');
  assert.ok(home.includes('class="sk-tslider"'), 'two testimonials become a slider');
  assert.ok(home.includes('sk-visit'), 'hours on the homepage');
  assert.ok(home.includes('data-sk-ba') && home.includes('/p4.jpg') && home.includes('/p5.jpg'), 'last two photos as before/after');
  const hero = home.split('sk-scroll-cue')[0];
  assert.ok(!hero.includes('/p4.jpg') && !hero.includes('/p5.jpg'), 'pair not reused in the hero');
  const about = page(pages, 'about');
  assert.ok(about.includes('Pema &lt;b&gt;Sherpa&lt;/b&gt;') && about.includes('>A</span>'), 'team escaped, initials avatar');
  const contact = page(pages, 'contact');
  assert.ok(contact.includes('data-days="Sun - Fri"'));
  assert.ok(contact.includes('<summary>Do you deliver?</summary>') && contact.includes('&lt;Kathmandu&gt;'));
});

test('hero layouts', () => {
  for (const layout of ['centered', 'split', 'editorial']) {
    const home = page(generateSite(parseIntake({ ...base, heroLayout: layout }), { media }), 'home');
    assert.ok(home.includes(`sk-hero--${layout}`), layout);
    assert.strictEqual(home.includes('sk-hero-collage'), false, `${layout} has no collage`);
  }
  assert.ok(page(generateSite(parseIntake({ ...base, heroLayout: 'split' }), { media }), 'home').includes('sk-hero-photo'));
  assert.strictEqual(parseIntake({ ...base, heroLayout: 'nope' }).heroLayout, 'auto');
});

test('dark mode CSS is in every style except luxe, which is dark already', () => {
  assert.ok(theme.customCss('classic').includes('html.sk-dark'));
  assert.ok(!theme.customCss('luxe').includes('html.sk-dark'));
  assert.ok(theme.customCss('luxe').includes('.sk-darktoggle{display:none'));
});
