const test = require('node:test');
const assert = require('node:assert');
const { generateCopy, findUnsupportedNumbers, applyEdits, intakeFingerprint } = require('../src/copywriter');
const { parseIntake } = require('../src/intake');
const { generateSite, countPlaceholders } = require('../src/generator');

const intake = parseIntake({
  businessName: 'Test Bakery',
  description: 'Sourdough bakery in Pokhara, open since 2019.',
  services: 'Bread: Daily sourdough\nCakes: Custom cakes',
  email: 'a@b.co',
  pages: ['about', 'services', 'contact'],
});

const seo = { title: 'T', description: 'D' };
const goodCopy = {
  home: { heroLead: 'Fresh sourdough in Pokhara since 2019.', aboutTeaser: 'A small bakery.', ctaLine: 'Order today.' },
  about: { headline: 'Bread worth waking up for', story: ['First paragraph.', 'Second paragraph [add owner name].'], mission: 'M.', values: 'V.', experience: 'E.' },
  services: {
    intro: 'What we bake.',
    // Out of order on purpose: copy must be matched to services by name.
    items: [
      { name: 'Cakes', summary: 'Cakes summary.', details: 'Cakes details.' },
      { name: 'Bread', summary: 'Bread summary.', details: 'Bread details.' },
    ],
  },
  contact: { intro: 'Email us.' },
  seo: { home: seo, about: seo, services: seo, contact: seo },
  checkWithClient: [],
};

// Fake Ollama: returns queued replies in order and records the requests.
function fakeChat(replies) {
  const calls = [];
  const fn = async (body) => {
    calls.push(body);
    const next = replies.shift();
    return { model: 'fake', message: { content: typeof next === 'string' ? next : JSON.stringify(next) } };
  };
  fn.calls = calls;
  return fn;
}

test('generateCopy returns validated copy, aligned to services by name', async () => {
  const chat = fakeChat([goodCopy, { unsupported: [] }]);
  const copy = await generateCopy(intake, { fetchChat: chat });
  assert.deepStrictEqual(copy.data.services.items.map((s) => s.name), ['Bread', 'Cakes']);
  assert.strictEqual(copy.data.services.items[0].summary, 'Bread summary.');
  assert.strictEqual(copy.data.about.story[1], 'Second paragraph.'); // [bracket] notes stripped
  assert.ok(chat.calls[0].format, 'requests JSON-schema constrained output');
  assert.strictEqual(copy.fingerprint, intakeFingerprint(intake));
});

test('generateCopy retries once on malformed output, then gives up', async () => {
  const ok = await generateCopy(intake, { fetchChat: fakeChat(['not json', goodCopy, { unsupported: [] }]) });
  assert.ok(ok.data.home.heroLead);
  await assert.rejects(generateCopy(intake, { fetchChat: fakeChat(['nope', '{"home":1}']) }), /didn't match the expected format/);
});

test('fact-check: model flags on sentences that only restate the intake are dropped', async () => {
  // Sentence 1 is the hero lead, which only uses intake words.
  const copy = await generateCopy(intake, { fetchChat: fakeChat([goodCopy, { unsupported: [{ sentence: 1, claim: 'x' }] }]) });
  assert.ok(!copy.data.checkWithClient.some((c) => c.includes('Fresh sourdough')));
});

test('fact-check: invented details are flagged as the actual sentence, even if the model misses them', async () => {
  const data = JSON.parse(JSON.stringify(goodCopy));
  data.about.experience = 'Our bakers trained in Paris and use organic flour.';
  const copy = await generateCopy(intake, { fetchChat: fakeChat([data, { unsupported: [] }]) });
  assert.ok(copy.data.checkWithClient.includes('About experience: "Our bakers trained in Paris and use organic flour."'));
});

test('fact-check: a model flag stands when the sentence adds a new detail', async () => {
  const data = JSON.parse(JSON.stringify(goodCopy));
  // Mostly intake words plus one new claim ("weekly"): above the low-overlap bar, below the model bar.
  data.contact.intro = 'Order sourdough bread and cakes in Pokhara weekly.'; // 4 of 5 words in the intake = 0.8
  const n = require('../src/copywriter').sentencesOf(require('../src/copywriter').CopySchema.parse(data)).findIndex((s) => s.where === 'Contact intro') + 1;
  const flagged = await generateCopy(intake, { fetchChat: fakeChat([data, { unsupported: [{ sentence: n, claim: 'x' }] }]) });
  const unflagged = await generateCopy(intake, { fetchChat: fakeChat([data, { unsupported: [] }]) });
  assert.ok(flagged.data.checkWithClient.some((c) => c.startsWith('Contact intro')));
  assert.ok(!unflagged.data.checkWithClient.some((c) => c.startsWith('Contact intro')));
});

test('a failed fact-check does not lose the copy', async () => {
  const copy = await generateCopy(intake, { fetchChat: fakeChat([goodCopy, 'garbage']) });
  assert.ok(copy.data.home.heroLead);
});

test('numbers not in the intake are flagged', () => {
  const data = JSON.parse(JSON.stringify(goodCopy));
  data.about.experience = 'Over 500 happy customers since 2019.';
  const flags = findUnsupportedNumbers(data, intake);
  assert.strictEqual(flags.length, 1);
  assert.match(flags[0], /"500"/);
});

test('AI copy replaces the placeholders on every page', async () => {
  const copy = await generateCopy(intake, { fetchChat: fakeChat([goodCopy, { unsupported: [] }]) });
  const without = generateSite(intake, { media: [] });
  const withCopy = generateSite(intake, { media: [] }, copy.data);
  const drafts = (pages) => pages.reduce((n, p) => n + (p.content.match(/\[Draft/g) || []).length, 0);
  assert.ok(drafts(without) > 5);
  assert.strictEqual(drafts(withCopy), 0);
  // What's left are real tasks, not copy: the contact form and the map.
  assert.ok(countPlaceholders(withCopy.find((p) => p.slug === 'contact').content) >= 1);
  assert.ok(withCopy[0].content.includes('Fresh sourdough in Pokhara since 2019.'));
});

test('applyEdits accepts only known fields and splits story paragraphs', async () => {
  const copy = await generateCopy(intake, { fetchChat: fakeChat([goodCopy, { unsupported: [] }]) });
  applyEdits(copy, { heroLead: '  New hero  ', aboutStory: 'One.\n\nTwo.\n\n\nThree.', serviceSummary1: 'Edited cakes', evil: 'x' }, intake);
  assert.strictEqual(copy.data.home.heroLead, 'New hero');
  assert.deepStrictEqual(copy.data.about.story, ['One.', 'Two.', 'Three.']);
  assert.strictEqual(copy.data.services.items[1].summary, 'Edited cakes');
  assert.strictEqual(copy.data.evil, undefined);
  assert.strictEqual(copy.edited, true);
});
