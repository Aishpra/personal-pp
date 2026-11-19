#!/usr/bin/env node
// Opens every page SiteKit generated in the real WordPress block editor and reports
// any block the editor considers invalid ("This block contains unexpected or invalid
// content"). Also checks the header/footer markup via a temporary draft page.
//
// Needs Playwright:  npm i -D playwright && npx playwright install chromium
const config = require('../src/config');
const store = require('../src/store');
const theme = require('../src/theme');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('Playwright is not installed. Run:\n  npm i -D playwright\n  npx playwright install chromium');
  process.exit(1);
}

const adminPassword = process.env.WP_ADMIN_PASSWORD;
if (!adminPassword) {
  console.error('WP_ADMIN_PASSWORD is not set in .env (npm run wp:up sets it for the Docker WordPress).');
  process.exit(1);
}

const auth = `Basic ${Buffer.from(`${config.wp.user}:${config.wp.appPassword.replace(/\s+/g, '')}`).toString('base64')}`;
let siteBase = config.wp.url;
async function api(route, init = {}) {
  const res = await fetch(`${siteBase}/wp-json${route}`, { ...init, headers: { Authorization: auth, 'Content-Type': 'application/json', ...init.headers } });
  if (!res.ok) throw new Error(`${route}: HTTP ${res.status}`);
  return res.json();
}

(async () => {
  // Usage: npm run check:blocks [project-id]   (default: the most recently pushed project)
  const wanted = process.argv[2];
  const pushed = store
    .list()
    .filter((p) => p.wordpress.siteUrl?.startsWith(config.wp.url) && Object.keys(p.wordpress.pages || {}).length)
    .sort((a, b) => (b.wordpress.lastPushAt || '').localeCompare(a.wordpress.lastPushAt || ''));
  const project = wanted ? pushed.find((p) => p.id === wanted) : pushed[0];
  if (!project) {
    console.error(wanted ? `Project ${wanted} hasn't been pushed to ${config.wp.url}.` : 'No project has been pushed to this WordPress yet. Push one first.');
    process.exit(1);
  }
  siteBase = project.wordpress.siteUrl;
  console.log(`Checking ${project.intake.businessName} at ${siteBase}/`);
  const pages = Object.entries(project.wordpress.pages).filter(([slug]) => slug !== 'blog');
  const temp = await api('/wp/v2/pages', {
    method: 'POST',
    body: JSON.stringify({ title: 'sitekit-block-check', status: 'draft', content: `${theme.header(project.intake, siteBase)}\n\n${theme.footer(project.intake)}` }),
  });
  pages.push(['header + footer', { id: temp.id }]);

  const browser = await chromium.launch();
  let failures = 0;
  try {
    const page = await browser.newPage();
    await page.goto(`${config.wp.url}/wp-login.php`);
    await page.fill('#user_login', config.wp.user);
    await page.fill('#user_pass', adminPassword);
    await page.click('#wp-submit');
    await page.waitForURL(/wp-admin/);

    for (const [slug, { id }] of pages) {
      await page.goto(`${siteBase}/wp-admin/post.php?post=${id}&action=edit`);
      await page.waitForFunction(() => window.wp?.data?.select('core/block-editor')?.getBlocks().length > 0, null, { timeout: 60000 });
      const result = await page.evaluate(() => {
        const bad = [];
        let count = 0;
        const walk = (blocks) =>
          blocks.forEach((blk) => {
            count++;
            if (!blk.isValid) bad.push(blk.name);
            walk(blk.innerBlocks);
          });
        walk(window.wp.data.select('core/block-editor').getBlocks());
        return { count, bad };
      });
      failures += result.bad.length;
      console.log(`${result.bad.length ? '✗' : '✓'} ${slug}: ${result.count} blocks${result.bad.length ? `, invalid: ${result.bad.join(', ')}` : ''}`);
    }
  } finally {
    await browser.close();
    await api(`/wp/v2/pages/${temp.id}?force=true`, { method: 'DELETE' }).catch(() => {});
  }
  process.exit(failures ? 1 : 0);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
