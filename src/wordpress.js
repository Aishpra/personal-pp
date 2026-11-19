// Pushes a project to a WordPress site through the REST API, authenticated with an
// Application Password (Users > Profile > Application Passwords in wp-admin).
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { generateSite } = require('./generator');

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

async function wp(route, { method = 'GET', json, body, headers = {} } = {}) {
  const url = `${config.wp.url}/wp-json${route}`;
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
    throw new WpError(`Cannot reach WordPress at ${config.wp.url} (${err.cause?.code || err.message}). Is it running? Try: npm run wp:up`);
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
    const me = await wp('/wp/v2/users/me?context=edit');
    if (!me.capabilities?.manage_options) {
      return { ok: false, message: `Connected as ${me.slug}, but that user is not an administrator.` };
    }
    return { ok: true, message: `Connected to ${config.wp.url} as ${me.slug}.` };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

async function mediaExists(id) {
  try {
    await wp(`/wp/v2/media/${id}?context=edit`);
    return true;
  } catch (err) {
    if (err.status === 404) return false;
    throw err;
  }
}

// Uploads a file once per WordPress site; later pushes reuse the stored media id.
async function ensureMedia(project, file, log) {
  const cacheKey = `${config.wp.url}|${file.stored}`;
  const cached = project.wordpress.media[cacheKey];
  if (cached && (await mediaExists(cached.id))) return cached;

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

async function savePage(id, payload) {
  return wp(id ? `/wp/v2/pages/${id}` : '/wp/v2/pages', { method: 'POST', json: payload });
}

async function upsertPage(page) {
  const existing = await wp(`/wp/v2/pages?slug=${encodeURIComponent(page.slug)}&status=publish,draft,private,pending&context=edit`);
  const id = existing[0]?.id;
  const payload = { title: page.title, slug: page.slug, content: page.content, status: 'publish', menu_order: page.menuOrder };
  // The homepage hero has its own H1, so hide the theme's page title there.
  // Block themes like Twenty Twenty-Five ship a "page-no-title" template; others may not.
  if (page.isFront) payload.template = 'page-no-title';
  let saved;
  try {
    saved = await savePage(id, payload);
  } catch (err) {
    if (!payload.template || err.status !== 400) throw err;
    delete payload.template;
    saved = await savePage(id, payload);
  }
  return { id: saved.id, link: saved.link, created: !id };
}

// Writes the client's brand colours into the active block theme's Global Styles,
// so buttons and links pick them up. Non-fatal: classic themes don't support this.
async function applyBrandColours(colours, log) {
  try {
    const themes = await wp('/wp/v2/themes?status=active');
    const href = themes[0]?._links?.['wp:user-global-styles']?.[0]?.href;
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
    await wp(`/wp/v2/global-styles/${id}`, { method: 'POST', json: { settings, styles } });
    log('Applied brand colours to theme Global Styles.');
  } catch (err) {
    log(`Could not apply brand colours: ${err.message}`);
  }
}

// Full push: media -> pages -> site settings -> colours. Returns a log of what happened.
async function pushProject(project) {
  const lines = [];
  const log = (msg) => lines.push(msg);
  const intake = project.intake;

  const check = await status();
  if (!check.ok) throw new WpError(check.message);

  const logo = intake.logo ? await ensureMedia(project, intake.logo, log) : null;
  const media = [];
  for (const file of intake.media) media.push(await ensureMedia(project, file, log));

  const pages = generateSite(intake, { logo, media });
  const ids = {};
  for (const page of pages) {
    const result = await upsertPage(page);
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
    // Older WordPress versions reject site_logo/site_icon; retry without them.
    delete settings.site_logo;
    delete settings.site_icon;
    await wp('/wp/v2/settings', { method: 'POST', json: settings });
    log(`Logo not set as site logo (${err.message}); set it in the Site Editor.`);
  }
  log(`Set site title, tagline and front page${logo ? ', logo and favicon' : ''}.`);

  await applyBrandColours(intake.colours, log);

  project.wordpress.pages = Object.fromEntries(Object.entries(ids).map(([slug, r]) => [slug, { id: r.id, link: r.link }]));
  project.wordpress.lastPushAt = new Date().toISOString();
  project.wordpress.siteUrl = config.wp.url;
  return lines;
}

module.exports = { pushProject, status, WpError };
