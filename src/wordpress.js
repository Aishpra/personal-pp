// Pushes a project to a WordPress site through the REST API, authenticated with an
// Application Password (Users > Profile > Application Passwords in wp-admin).
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { generateSite } = require('./generator');
const theme = require('./theme');
const staging = require('./staging');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

class WpError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function authHeader() {
  const token = Buffer.from(`${config.wp.user}:${config.wp.appPassword.replace(/\s+/g, '')}`).toString('base64');
  return `Basic ${token}`;
}

// A REST client bound to one site (the network root, or a client's subsite).
function api(base) {
  return (route, opts) => request(base, route, opts);
}

async function request(base, route, { method = 'GET', json, body, headers = {} } = {}) {
  const url = `${base}/wp-json${route}`;
  const init = { method, headers: { Authorization: authHeader(), ...headers } };
  if (json !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(json);
  } else if (body !== undefined) {
    init.body = body;
  }
  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    throw new WpError(`Cannot reach WordPress at ${base} (${err.cause?.code || err.message}). Is it running? Try: npm run wp:up`);
  }
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new WpError(`WordPress returned non-JSON from ${route} (HTTP ${res.status}). Check WP_URL and that permalinks are enabled.`, res.status);
  }
  if (!res.ok) {
    throw new WpError(`${method} ${route} failed (HTTP ${res.status}): ${data?.message || text.slice(0, 200)}`, res.status);
  }
  return data;
}

async function status() {
  if (!config.wp.appPassword) {
    return { ok: false, message: 'WP_APP_PASSWORD is not set. Run `npm run wp:up` to start a local WordPress and create one.' };
  }
  try {
    const me = await api(config.wp.url)('/wp/v2/users/me?context=edit');
    if (!me.capabilities?.manage_options) {
      return { ok: false, message: `Connected as ${me.slug}, but that user is not an administrator.` };
    }
    const mode = config.wp.multisite ? ' Each client gets its own staging site.' : '';
    return { ok: true, message: `Connected to ${config.wp.url} as ${me.slug}.${mode}` };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

async function mediaExists(wp, id) {
  try {
    await wp(`/wp/v2/media/${id}?context=edit`);
    return true;
  } catch (err) {
    if (err.status === 404) return false;
    throw err;
  }
}

// Uploads a file once per WordPress site; later pushes reuse the stored media id.
async function ensureMedia(wp, base, project, file, log) {
  const cacheKey = `${base}|${file.stored}`;
  const cached = project.wordpress.media[cacheKey];
  if (cached && (await mediaExists(wp, cached.id))) return cached;

  const buf = fs.readFileSync(path.join(UPLOADS_DIR, project.id, file.stored));
  const created = await wp('/wp/v2/media', {
    method: 'POST',
    body: buf,
    headers: {
      'Content-Type': file.mime,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file.original).replace(/"/g, '')}"`,
    },
  });
  await wp(`/wp/v2/media/${created.id}`, { method: 'POST', json: { alt_text: file.alt || '' } });
  const entry = { id: created.id, url: created.source_url, alt: file.alt || '' };
  project.wordpress.media[cacheKey] = entry;
  log(`Uploaded ${file.original} (media #${created.id})`);
  return entry;
}

async function savePage(wp, id, payload) {
  return wp(id ? `/wp/v2/pages/${id}` : '/wp/v2/pages', { method: 'POST', json: payload });
}

async function upsertPage(wp, page) {
  const existing = await wp(`/wp/v2/pages?slug=${encodeURIComponent(page.slug)}&status=publish,draft,private,pending&context=edit`);
  const id = existing[0]?.id;
  const payload = { title: page.title, slug: page.slug, content: page.content, status: 'publish', menu_order: page.menuOrder };
  // Generated pages carry their own H1 (hero or page banner), so hide the theme's title.
  // Block themes like Twenty Twenty-Five ship a "page-no-title" template; others may not.
  if (!page.isPosts) payload.template = 'page-no-title';
  let saved;
  try {
    saved = await savePage(wp, id, payload);
  } catch (err) {
    if (!payload.template || err.status !== 400) throw err;
    delete payload.template;
    saved = await savePage(wp, id, payload);
  }
  return { id: saved.id, link: saved.link, created: !id };
}

async function activeTheme(wp) {
  const themes = await wp('/wp/v2/themes?status=active');
  return themes[0];
}

// Writes the client's brand colours and SiteKit's custom CSS (animations, card hover,
// sticky header) into the active block theme's Global Styles.
// Non-fatal: classic themes don't support this.
async function applyBrandColours(wp, colours, log) {
  try {
    const active = await activeTheme(wp);
    const href = active?._links?.['wp:user-global-styles']?.[0]?.href;
    if (!href) {
      log('Active theme has no Global Styles (not a block theme); skipped brand colours.');
      return;
    }
    const id = href.split('/').pop();
    const current = await wp(`/wp/v2/global-styles/${id}?context=edit`);
    const settings = current.settings || {};
    const styles = current.styles || {};
    settings.color = settings.color || {};
    settings.color.palette = {
      ...(settings.color.palette || {}),
      custom: [
        { slug: 'brand-primary', color: colours.primary, name: 'Brand primary' },
        { slug: 'brand-secondary', color: colours.secondary, name: 'Brand secondary' },
        { slug: 'brand-accent', color: colours.accent, name: 'Brand accent' },
      ],
    };
    styles.elements = styles.elements || {};
    styles.elements.button = { ...(styles.elements.button || {}), color: { background: colours.primary, text: '#ffffff' } };
    styles.elements.link = { ...(styles.elements.link || {}), color: { text: colours.primary } };
    styles.css = theme.customCss();
    await wp(`/wp/v2/global-styles/${id}`, { method: 'POST', json: { settings, styles } });
    log('Applied brand colours, animations and styling to the theme.');
  } catch (err) {
    log(`Could not apply brand colours: ${err.message}`);
  }
}

// Replaces the theme's header and footer with SiteKit's (logo + menu + CTA; NAP footer).
async function applyThemeParts(wp, base, intake, log) {
  let active;
  try {
    active = await activeTheme(wp);
  } catch (err) {
    log(`Could not read the active theme: ${err.message}`);
    return;
  }
  const slug = active?.stylesheet;
  const parts = { header: theme.header(intake, base), footer: theme.footer(intake) };
  for (const [area, content] of Object.entries(parts)) {
    try {
      await wp(`/wp/v2/template-parts/${slug}//${area}`, { method: 'POST', json: { content } });
      log(`Updated the site ${area}.`);
    } catch (err) {
      log(`Could not update the ${area} (${err.message}). This theme may not have a "${area}" template part.`);
    }
  }
}

// Full push: media -> pages -> site settings -> colours. Returns a log of what happened.
async function pushProject(project) {
  const lines = [];
  const log = (msg) => lines.push(msg);
  const intake = project.intake;

  const check = await status();
  if (!check.ok) throw new WpError(check.message);

  // Each client's own site on the Docker multisite; otherwise the one configured site.
  const base = await staging.ensureSite(project, log);
  const wp = api(base);

  const logo = intake.logo ? await ensureMedia(wp, base, project, intake.logo, log) : null;
  const media = [];
  for (const file of intake.media) media.push(await ensureMedia(wp, base, project, file, log));

  const hasForm = await hasContactForm(wp);
  if (!hasForm && intake.pages.includes('contact')) {
    log('The SiteKit Contact Form plugin is not active on this WordPress, so the Contact page keeps a placeholder. See README, "Contact form".');
  }
  const pages = generateSite(intake, { logo, media }, project.copy?.data || null, { contactForm: hasForm, siteUrl: base });
  const ids = {};
  for (const page of pages) {
    const result = await upsertPage(wp, page);
    ids[page.slug] = result;
    log(`${result.created ? 'Created' : 'Updated'} page "${page.title}" (#${result.id})`);
  }

  const settings = {
    title: intake.businessName,
    description: intake.tagline || '',
    show_on_front: 'page',
    page_on_front: ids.home.id,
  };
  if (ids.blog) settings.page_for_posts = ids.blog.id;
  if (logo) {
    settings.site_logo = logo.id;
    settings.site_icon = logo.id;
  }
  try {
    await wp('/wp/v2/settings', { method: 'POST', json: settings });
  } catch (err) {
    if (err.status !== 400) throw err;
    // Older WordPress versions reject site_logo/site_icon; retry without them.
    delete settings.site_logo;
    delete settings.site_icon;
    await wp('/wp/v2/settings', { method: 'POST', json: settings });
    log(`Logo not set as site logo (${err.message}); set it in the Site Editor.`);
  }
  log(`Set site title, tagline and front page${logo ? ', logo and favicon' : ''}.`);

  await applyBrandColours(wp, intake.colours, log);
  await applyThemeParts(wp, base, intake, log);

  project.wordpress.pages = Object.fromEntries(Object.entries(ids).map(([slug, r]) => [slug, { id: r.id, link: r.link }]));
  project.wordpress.lastPushAt = new Date().toISOString();
  project.wordpress.siteUrl = base;
  return lines;
}

// The SiteKit Contact Form plugin (wordpress/sitekit-contact-form) registers this route.
async function hasContactForm(wp) {
  try {
    const res = await wp('/sitekit/v1/contact-form');
    return Boolean(res?.active);
  } catch {
    return false;
  }
}

module.exports = { pushProject, status, api, WpError };
