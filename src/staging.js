// One staging site per client, on the local Docker WordPress, which `npm run wp:up`
// turns into a Multisite network. Each project gets http://localhost:8080/<slug>/.
//
// Sites are created with WP-CLI (WordPress has no REST endpoint for that), so this
// only works with the Docker WordPress. With your own WordPress (WP_MULTISITE unset),
// every project pushes to that one site, as before.
const { execFile } = require('child_process');
const path = require('path');
const config = require('./config');

const ROOT = path.join(__dirname, '..');

class StagingError extends Error {}

function wpcli(args, { timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      'docker',
      ['compose', '--profile', 'cli', 'run', '--rm', '-T', 'cli', 'wp', ...args],
      { cwd: ROOT, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          const detail = (stderr || err.message).split('\n').filter((l) => /error|warning/i.test(l)).join(' ') || err.message;
          return reject(new StagingError(`WP-CLI failed (${args.slice(0, 3).join(' ')}): ${detail.slice(0, 300)}`));
        }
        resolve(stdout.trim());
      }
    );
  });
}

// Site slugs: lowercase letters, numbers and hyphens, unique per project.
function siteSlug(project) {
  return project.id.replace(/[^a-z0-9-]/g, '').slice(0, 60);
}

function siteUrlFor(project) {
  return project.wordpress.siteUrl && project.wordpress.blogId ? project.wordpress.siteUrl : null;
}

// Creates the client's site if it doesn't exist yet. Returns its URL.
async function ensureSite(project, log = () => {}) {
  if (!config.wp.multisite) return config.wp.url;
  const existing = siteUrlFor(project);
  if (existing) {
    const ids = await wpcli(['site', 'list', '--field=blog_id', '--format=csv']);
    if (ids.split(/\s+/).includes(String(project.wordpress.blogId))) return existing;
    log('The staging site for this project was deleted; creating a new one.');
  }

  const slug = siteSlug(project);
  const url = `${config.wp.url}/${slug}`;
  const blogId = await wpcli([
    'site', 'create', `--slug=${slug}`, `--title=${project.intake.businessName}`, '--email=admin@example.test', '--porcelain',
  ]);
  const at = `--url=${url}/`;
  await wpcli(['theme', 'activate', 'twentytwentyfive', at]).catch(() => log('Could not activate Twenty Twenty-Five on the new site.'));
  await wpcli(['rewrite', 'structure', '/%postname%/', at]);
  // Remove WordPress's sample post and page so only the client's pages exist.
  const sample = await wpcli(['post', 'list', '--post_type=post,page', '--format=ids', at]).catch(() => '');
  if (sample) await wpcli(['post', 'delete', ...sample.split(/\s+/), '--force', at]).catch(() => {});

  project.wordpress.blogId = Number(blogId);
  project.wordpress.siteUrl = url;
  project.wordpress.pages = {};
  project.wordpress.media = {};
  log(`Created this client's staging site: ${url}/`);
  return url;
}

// Online shop (once per site): WooCommerce + eSewa/Khalti switched on for this client's site
// only, its shop/cart/checkout pages created, Nepali rupees, cash on delivery on.
async function enableShop(project, log = () => {}) {
  if (!config.wp.multisite) {
    log('Online shop: install WooCommerce and the SiteKit Nepal Payments plugin on this WordPress yourself (see README).');
    return false;
  }
  if (project.wordpress.shopReady) return true;
  const at = `--url=${project.wordpress.siteUrl}/`;
  try {
    await wpcli(['plugin', 'activate', 'woocommerce', at], { timeoutMs: 240000 });
    await wpcli(['plugin', 'activate', 'sitekit-nepal-payments', at]);
  } catch (err) {
    log(`Online shop not set up: ${err.message}. Is WooCommerce installed? Run npm run wp:up.`);
    return false;
  }
  await wpcli(['wc', 'tool', 'run', 'install_pages', '--user=admin', at], { timeoutMs: 240000 }).catch((e) => log(`Shop pages: ${e.message}`));
  const opts = [
    ['woocommerce_currency', 'NPR'], ['woocommerce_default_country', 'NP'], ['woocommerce_currency_pos', 'left_space'],
    ['woocommerce_price_num_decimals', '0'], ['woocommerce_coming_soon', 'no'], ['woocommerce_store_pages_only', 'no'],
  ];
  for (const [k, v] of opts) await wpcli(['option', 'update', k, v, at]).catch(() => {});
  await wpcli(['option', 'update', 'woocommerce_cod_settings', JSON.stringify({ enabled: 'yes', title: 'Cash on delivery', description: 'Pay in cash when your order arrives.', instructions: 'Pay in cash when your order arrives.', enable_for_methods: '', enable_for_virtual: 'yes' }), '--format=json', at]).catch(() => {});
  await wpcli(['rewrite', 'flush', at]).catch(() => {});
  project.wordpress.shopReady = true;
  log('Online shop switched on: WooCommerce with eSewa (test mode), Khalti (demo checkout until you add a key) and cash on delivery.');
  return true;
}

async function deleteSite(project) {
  if (!config.wp.multisite || !project.wordpress.blogId) return false;
  await wpcli(['site', 'delete', String(project.wordpress.blogId), '--yes']);
  return true;
}

module.exports = { enableShop, ensureSite, deleteSite, siteSlug, wpcli, StagingError };
