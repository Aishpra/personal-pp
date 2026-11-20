const test = require('node:test');
const assert = require('node:assert');
const theme = require('../src/theme');
const { parseIntake, DESIGN_STYLES } = require('../src/intake');

test('intake keeps a known design style and falls back to classic', () => {
  assert.strictEqual(parseIntake({ style: 'elegant' }).style, 'elegant');
  assert.strictEqual(parseIntake({ style: 'nonsense' }).style, 'classic');
  assert.strictEqual(parseIntake({}).style, 'classic');
});

test('every design style adds its own CSS on top of the base, using brand colours', () => {
  assert.deepStrictEqual(theme.DESIGN_STYLES, DESIGN_STYLES);
  const base = theme.customCss('classic');
  assert.ok(base.includes('--sk-primary'));
  for (const style of DESIGN_STYLES.filter((s) => s !== 'classic')) {
    const css = theme.customCss(style);
    assert.ok(css.startsWith(base.slice(0, 200)), `${style} keeps the base CSS`);
    assert.ok(css.length > base.length + 500, `${style} adds styling`);
    assert.ok(!/<|<\/style/i.test(css), `${style} CSS is safe to store in Global Styles`);
  }
  assert.strictEqual(theme.customCss('unknown'), base);
});
