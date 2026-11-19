// Small helpers that write WordPress block markup (Gutenberg) as strings.
// The markup has to match what the block editor itself saves, or the editor shows
// "This block contains unexpected or invalid content". After changing anything here,
// push a project and open each page in the WordPress editor to confirm no block
// shows that warning (see README, "Checking block markup").

function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Block attributes live inside an HTML comment, so "--" and angle brackets must be
// escaped the same way WordPress does it.
function attrs(obj) {
  if (!obj || Object.keys(obj).length === 0) return '';
  const json = JSON.stringify(obj)
    .replace(/--/g, '\\u002d\\u002d')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  return ` ${json}`;
}

function wrap(name, attributes, html) {
  return `<!-- wp:${name}${attrs(attributes)} -->\n${html}\n<!-- /wp:${name} -->`;
}

const heading = (text, level = 2) =>
  wrap('heading', level === 2 ? null : { level }, `<h${level} class="wp-block-heading">${esc(text)}</h${level}>`);

const paragraph = (text) => wrap('paragraph', null, `<p>${esc(text)}</p>`);

// Paragraph whose content is trusted inline HTML (links). Callers must escape their parts.
const paragraphHtml = (html) => wrap('paragraph', null, `<p>${html}</p>`);

function button(text, href, outline = false) {
  const cls = outline ? 'wp-block-button is-style-outline' : 'wp-block-button';
  return wrap(
    'button',
    outline ? { className: 'is-style-outline' } : null,
    `<div class="${cls}"><a class="wp-block-button__link wp-element-button" href="${esc(href)}">${esc(text)}</a></div>`
  );
}

const buttons = (...items) => wrap('buttons', null, `<div class="wp-block-buttons">${items.join('')}</div>`);

function image(img) {
  if (!img) return '';
  const a = {};
  if (img.id) a.id = img.id;
  a.sizeSlug = 'large';
  a.linkDestination = 'none';
  const cls = img.id ? ` class="wp-image-${img.id}"` : '';
  return wrap(
    'image',
    a,
    `<figure class="wp-block-image size-large"><img src="${esc(img.url)}" alt="${esc(img.alt)}"${cls}/></figure>`
  );
}

function gallery(images) {
  if (!images.length) return '';
  return wrap(
    'gallery',
    { linkTo: 'none' },
    `<figure class="wp-block-gallery has-nested-images columns-default is-cropped">${images.map(image).join('\n\n')}</figure>`
  );
}

const column = (...inner) => wrap('column', null, `<div class="wp-block-column">${inner.filter(Boolean).join('\n\n')}</div>`);
const columns = (...cols) => wrap('columns', null, `<div class="wp-block-columns">${cols.join('\n\n')}</div>`);

function group(inner, { background, text } = {}) {
  if (!background) {
    return wrap('group', { layout: { type: 'constrained' } }, `<div class="wp-block-group">${inner.join('\n\n')}</div>`);
  }
  const color = { background };
  if (text) color.text = text;
  const pad = 'var:preset|spacing|50';
  const padCss = 'var(--wp--preset--spacing--50)';
  const classes = ['wp-block-group', text && 'has-text-color', 'has-background'].filter(Boolean).join(' ');
  const style = [
    text && `color:${text}`,
    `background-color:${background}`,
    `padding-top:${padCss}`,
    `padding-right:${padCss}`,
    `padding-bottom:${padCss}`,
    `padding-left:${padCss}`,
  ]
    .filter(Boolean)
    .join(';');
  return wrap(
    'group',
    { style: { color, spacing: { padding: { top: pad, right: pad, bottom: pad, left: pad } } }, layout: { type: 'constrained' } },
    `<div class="${classes}" style="${style}">${inner.join('\n\n')}</div>`
  );
}

function quote(text, cite) {
  const citeHtml = cite ? `<cite>${esc(cite)}</cite>` : '';
  return wrap('quote', null, `<blockquote class="wp-block-quote">${paragraph(text)}${citeHtml}</blockquote>`);
}

const spacer = (height = 48) =>
  wrap('spacer', { height: `${height}px` }, `<div style="height:${height}px" aria-hidden="true" class="wp-block-spacer"></div>`);

const html = (raw) => wrap('html', null, raw);

module.exports = { esc, attrs, heading, paragraph, paragraphHtml, button, buttons, image, gallery, column, columns, group, quote, spacer, html };
