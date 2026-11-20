const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

test('agency site build: homepage, one landing page per niche, valid structured data and sitemap', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-'));
  try {
    execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'build-agency.js'), out], { stdio: 'ignore' });
    const { niches } = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'agency', 'niches.json'), 'utf8'));
    const pages = ['index.html', ...niches.map((n) => `websites-for/${n.slug}/index.html`)];
    for (const page of pages) {
      const html = fs.readFileSync(path.join(out, page), 'utf8');
      assert.ok(!/\{\{\w+\}\}/.test(html), `${page} has no unfilled placeholders`);
      assert.strictEqual((html.match(/<h1[\s>]/g) || []).length, 1, `${page} has one h1`);
      assert.match(html, /<meta name="description" content="[^"]{50,}">/, `${page} has a description`);
      assert.match(html, /<link rel="canonical" href="https?:\/\//, `${page} has a canonical URL`);
      const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
      assert.ok(ld['@graph'].some((g) => g['@type'] === 'FAQPage'), `${page} has FAQ structured data`);
    }
    const sitemap = fs.readFileSync(path.join(out, 'sitemap.xml'), 'utf8');
    assert.strictEqual((sitemap.match(/<url>/g) || []).length, pages.length);
    for (const f of ['404.html', 'robots.txt', 'site.webmanifest', 'assets/site.css', 'assets/icons/icon-512.png']) assert.ok(fs.existsSync(path.join(out, f)), f);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});
