// Takes dashboard thumbnails of every project that has a staging site: npm run thumbs
const store = require('../src/store');
const thumbs = require('../src/thumbs');

(async () => {
  if (!thumbs.findBrowser()) {
    console.error('No Chromium or Chrome found. Install chromium, or set CHROME_BIN.');
    process.exit(1);
  }
  const projects = store.list().filter((p) => p.wordpress?.siteUrl);
  let ok = 0;
  for (const p of projects) {
    const done = await thumbs.capture(p);
    ok += done ? 1 : 0;
    console.log(`${done ? '✓' : '✗'} ${p.intake.businessName}`);
  }
  console.log(`\n${ok} of ${projects.length} thumbnails saved in data/thumbs/.`);
})();
