#!/usr/bin/env node
// Starts the local staging WordPress (Docker), installs it if needed, and writes an
// Application Password into .env so SiteKit can push to it. Safe to re-run.
const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env');

function readEnv() {
  const env = {};
  if (fs.existsSync(ENV_FILE)) {
    for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) env[m[1]] = m[2];
    }
  }
  return env;
}

function writeEnv(updates) {
  let text = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
  for (const [k, v] of Object.entries(updates)) {
    const re = new RegExp(`^${k}=.*$`, 'm');
    text = re.test(text) ? text.replace(re, `${k}=${v}`) : `${text}${text && !text.endsWith('\n') ? '\n' : ''}${k}=${v}\n`;
  }
  fs.writeFileSync(ENV_FILE, text);
}

function run(args, { capture = false, allowFail = false } = {}) {
  const res = spawnSync('docker', args, { cwd: ROOT, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
  if (res.error) {
    console.error(`\nCould not run docker: ${res.error.message}\nInstall Docker Desktop (https://docs.docker.com/get-docker/) and make sure it is running.`);
    process.exit(1);
  }
  if (res.status !== 0 && !allowFail) {
    if (capture) console.error(res.stderr || res.stdout);
    console.error(`\nCommand failed: docker ${args.join(' ')}`);
    process.exit(1);
  }
  return { ok: res.status === 0, out: (res.stdout || '').trim() };
}

const wpcli = (args, opts) => run(['compose', '--profile', 'cli', 'run', '--rm', '-T', 'cli', 'wp', ...args], opts);

async function waitForHttp(url, seconds = 120) {
  const until = Date.now() + seconds * 1000;
  while (Date.now() < until) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.error(`WordPress did not respond at ${url} within ${seconds}s. Check: docker compose logs wordpress`);
  process.exit(1);
}

async function main() {
  const env = readEnv();
  const port = env.WP_PORT || process.env.WP_PORT || '8080';
  const url = `http://localhost:${port}`;

  console.log('Starting WordPress + database containers...');
  run(['compose', 'up', '-d', 'db', 'wordpress']);
  await waitForHttp(url);

  if (!wpcli(['core', 'is-installed'], { capture: true, allowFail: true }).ok) {
    const adminPassword = crypto.randomBytes(9).toString('base64url');
    console.log('Installing WordPress...');
    wpcli(['core', 'install', `--url=${url}`, '--title=SiteKit Staging', '--admin_user=admin', `--admin_password=${adminPassword}`, '--admin_email=admin@example.test', '--skip-email'], { capture: true });
    writeEnv({ WP_ADMIN_PASSWORD: adminPassword });
  }

  // Pretty permalinks are needed for /about/ style links and a clean REST API.
  wpcli(['rewrite', 'structure', '/%postname%/', '--hard'], { capture: true });
  // The generator targets a block theme (Global Styles for brand colours).
  const theme = wpcli(['theme', 'activate', 'twentytwentyfive'], { capture: true, allowFail: true });
  if (!theme.ok) console.warn('Could not activate Twenty Twenty-Five; using the default theme.');
  // Remove the sample content so the staging site only shows the client's pages.
  wpcli(['post', 'delete', '1', '2', '--force'], { capture: true, allowFail: true });

  // One staging site per client: turn the install into a Multisite network (subdirectories).
  const isMulti = wpcli(['eval', 'echo is_multisite() ? "yes" : "no";'], { capture: true }).out === 'yes';
  if (!isMulti) {
    console.log('Converting to a Multisite network (one staging site per client)...');
    wpcli(['core', 'multisite-convert', '--title=SiteKit Staging'], { capture: true });
  }
  // Multisite needs its own Apache rewrite rules; WordPress doesn't write them itself.
  run(['compose', 'cp', 'wordpress/htaccess-multisite', 'wordpress:/var/www/html/.htaccess'], { capture: true });
  run(['compose', 'exec', '-T', 'wordpress', 'chown', 'www-data:www-data', '/var/www/html/.htaccess'], { capture: true });
  wpcli(['theme', 'enable', 'twentytwentyfive', '--network'], { capture: true, allowFail: true });
  wpcli(['plugin', 'activate', 'sitekit-contact-form', '--network'], { capture: true });
  wpcli(['plugin', 'activate', 'sitekit-motion', '--network'], { capture: true });
  wpcli(['plugin', 'activate', 'sitekit-seo', '--network'], { capture: true });

  // Fresh application password each run (old SiteKit ones are revoked).
  const existing = wpcli(['user', 'application-password', 'list', 'admin', '--name=sitekit', '--field=uuid'], { capture: true, allowFail: true });
  for (const uuid of existing.out.split(/\s+/).filter(Boolean)) {
    wpcli(['user', 'application-password', 'delete', 'admin', uuid], { capture: true, allowFail: true });
  }
  const appPassword = wpcli(['user', 'application-password', 'create', 'admin', 'sitekit', '--porcelain'], { capture: true }).out;

  // Without this network flag WordPress ignores application passwords on a multisite.
  wpcli(['site', 'option', 'update', 'using_application_passwords', '1'], { capture: true });

  writeEnv({ WP_URL: url, WP_USER: 'admin', WP_APP_PASSWORD: appPassword, WP_MULTISITE: 'true' });
  const finalEnv = readEnv();

  console.log(`
WordPress staging is ready (one site per client, created on first push).
  Network admin: ${url}/wp-admin/network/
  Admin:  ${url}/wp-admin   (user: admin, password: ${finalEnv.WP_ADMIN_PASSWORD || 'see .env'})
  .env updated with WP_URL / WP_USER / WP_APP_PASSWORD.

Restart SiteKit (npm start) if it is already running.`);
}

main();
