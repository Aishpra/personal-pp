#!/usr/bin/env node
// Exports a pushed SiteKit site from the local WordPress to plain static files, so it can be
// hosted for free (GitHub Pages, Netlify, Cloudflare Pages...). Links become relative, so the
// export works at any address, e.g. https://you.github.io/your-repo/ or your own domain.
//
//   npm run export -- <project-id> [out-dir]      default out-dir: dist/<project-id>
//
// The WordPress contact form can't run on a static host. Set FORMSPREE_ID (from a free
// formspree.io form) to send messages through Formspree; without it the form is replaced
// with "email us" text and buttons.
const fs = require('fs');
const path = require('path');
const store = require('../src/store');

const [id, outArg] = process.argv.slice(2);
if (!id) {
  console.error('Usage: npm run export -- <project-id> [out-dir]');
  process.exit(1);
}
const project = store.get(id);
const site = project?.wordpress?.siteUrl;
if (!site) {
  console.error(`Project "${id}" hasn't been pushed to staging yet. Push it first.`);
  process.exit(1);
}
const OUT = path.resolve(outArg || path.join(__dirname, '..', 'dist', id));
const SITE = new URL(site.replace(/\/?$/, '/'));
const ORIGIN = SITE.origin;
const FORMSPREE_ID = (process.env.FORMSPREE_ID || '').replace(/[^\w-]/g, '');
const SKIP = /\/(wp-json|xmlrpc\.php|feed|comments\/feed|wp-admin|wp-login\.php)(\/|$|\?)/;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Local file path (relative to OUT) for a URL on the WordPress origin.
function localPath(u) {
  const url = new URL(u, ORIGIN);
  let p = decodeURIComponent(url.pathname);
  if (p.startsWith(SITE.pathname)) p = p.slice(SITE.pathname.length);
  else p = `_wp/${p.replace(/^\//, '')}`; // network-level files outside the site's folder
  if (p === '' || p.endsWith('/')) p += 'index.html';
  return p.split('/').filter((s) => s && s !== '..').join('/');
}

function relative(fromFile, toFile) {
  const r = path.posix.relative(path.posix.dirname(fromFile), toFile);
  return r.endsWith('index.html') ? r.slice(0, -'index.html'.length) || './' : r;
}

async function get(u) {
  const res = await fetch(u, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} for ${u}`);
  return Buffer.from(await res.arrayBuffer());
}

const assets = new Map(); // url -> local path
const queue = [];
function want(u) {
  const clean = u.split('#')[0].split('?')[0];
  if (!clean.startsWith(ORIGIN) || SKIP.test(clean)) return null;
  if (!assets.has(clean)) {
    assets.set(clean, localPath(clean));
    queue.push(clean);
  }
  return assets.get(clean);
}

function write(rel, data) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
}

function contactFallback(html, email) {
  return html.replace(/<form[^>]*#sk-contact[^>]*>[\s\S]*?<\/form>/, (form) => {
    if (FORMSPREE_ID) {
      return form
        .replace(/action="[^"]*"/, `action="https://formspree.io/f/${FORMSPREE_ID}"`)
        .replace(/<input type="hidden"[^>]*>\s*/g, '')
        .replace(/name="sk_website"/, 'name="_gotcha"')
        .replace(/name="sk_(name|email|phone|message)"/g, 'name="$1"');
    }
    const mail = email ? `<a href="mailto:${email}">${email}</a>` : 'email';
    return `<p>Email ${mail} with a few lines about what you need, or call us using the details on this page. We usually reply within one working day.</p>`;
  });
}

// Rewrites every same-origin URL in a page or stylesheet to a relative local path.
function rewrite(text, fromFile, { isCss = false, baseUrl } = {}) {
  // Absolute URLs, including JSON-escaped ones (http:\/\/localhost...) in inline scripts.
  const abs = new RegExp(`${esc(ORIGIN).replace(/\//g, '\\\\?/')}(?:\\\\?/[^"'\\s)<>]*)?`, 'g');
  text = text.replace(abs, (m) => {
    const escaped = m.includes('\\/');
    const u = m.replace(/\\\//g, '/');
    const query = u.match(/[?#].*$/)?.[0] || '';
    const bare = u.slice(0, u.length - query.length);
    if (SKIP.test(bare)) return '#';
    const isPage = !/\.[a-z0-9]{2,5}$/i.test(bare);
    const target = isPage ? localPath(bare.replace(/\/?$/, '/')) : want(bare);
    if (!target) return m;
    let r = relative(fromFile, target) + (isPage ? query.replace(/^\?[^#]*/, '') : '');
    if (escaped) r = r.replace(/\//g, '\\/');
    return r;
  });
  if (isCss) {
    // Relative url(...) in stylesheets: fetch them too, keep the same relative layout.
    text = text.replace(/url\((['"]?)(?!data:|https?:|#)([^'")]+)\1\)/g, (m, q, ref) => {
      const target = want(new URL(ref, baseUrl).href);
      return target ? `url(${q}${relative(fromFile, target)}${q})` : m;
    });
  }
  return text;
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  const email = project.intake?.email || '';
  const slugs = Object.keys(project.wordpress.pages || { home: 1 });
  const pageUrls = slugs.map((s) => (s === 'home' ? SITE.href : new URL(`${s}/`, SITE).href));

  for (const u of pageUrls) {
    const file = localPath(u);
    let html = (await get(u)).toString('utf8');
    html = html
      .replace(/<link[^>]+rel="(?:alternate|EditURI|https:\/\/api\.w\.org\/|pingback)"[^>]*>\s*/g, '')
      .replace(/<meta name="generator"[^>]*>\s*/g, '');
    html = contactFallback(html, email);
    html = rewrite(html, file);
    write(file, html);
    console.log(`page  ${file}`);
  }

  while (queue.length) {
    const u = queue.shift();
    const file = assets.get(u);
    try {
      let data = await get(u);
      if (file.endsWith('.css')) data = Buffer.from(rewrite(data.toString('utf8'), file, { isCss: true, baseUrl: u }));
      else if (file.endsWith('.js')) data = Buffer.from(rewrite(data.toString('utf8'), file));
      write(file, data);
    } catch (err) {
      console.warn(`skip  ${u} (${err.message})`);
    }
  }
  write('.nojekyll', ''); // GitHub Pages: serve folders starting with "_" as-is
  const left = [];
  for (const f of walk(OUT)) if (/\.(html|css|js)$/.test(f) && fs.readFileSync(f, 'utf8').includes(SITE.host)) left.push(path.relative(OUT, f));
  console.log(`\nExported ${pageUrls.length} pages and ${assets.size} files to ${OUT}`);
  console.log(FORMSPREE_ID ? `Contact form sends through Formspree (${FORMSPREE_ID}).` : 'Contact form replaced with email text (set FORMSPREE_ID to keep a form).');
  if (left.length) console.warn(`Warning: still mentions ${SITE.host}: ${left.join(', ')}`);
}

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
