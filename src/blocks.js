// Small helpers that write WordPress block markup (Gutenberg) as strings.
// The markup has to match what the block editor itself saves, or the editor shows
// "This block contains unexpected or invalid content". After changing anything here,
// run `npm run check:blocks` (see README) to validate every generated page in the real editor.

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

// Self-closing dynamic block (rendered by PHP, so there is no saved HTML to validate).
const dynamic = (name, attributes) => `<!-- wp:${name}${attrs(attributes)} /-->`;

const cls = (...names) => names.filter(Boolean).join(' ');
const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== false));
const join = (inner) => [].concat(inner).filter(Boolean).join('\n\n');

// Theme spacing preset (Twenty Twenty-Five: 20..80) in attribute and CSS form.
const spaceAttr = (n) => `var:preset|spacing|${n}`;
const spaceCss = (n) => `var(--wp--preset--spacing--${n})`;

// Shared "supports" handling for color / padding / radius / font size / alignment,
// returning the block attributes plus the class and style attributes WordPress saves.
function supports({ align, className, background, text, padding, radius, fontSize, textAlign, textAlignKey = 'textAlign' } = {}) {
  const a = clean({ [textAlignKey]: textAlign, align, className, fontSize });
  const style = {};
  const css = [];
  if (background || text) {
    style.color = clean({ background, text });
    if (text) css.push(`color:${text}`);
    if (background) css.push(`background-color:${background}`);
  }
  if (radius) {
    style.border = { radius: `${radius}px` };
    css.push(`border-radius:${radius}px`);
  }
  if (padding) {
    const [v, h] = Array.isArray(padding) ? padding : [padding, padding];
    style.spacing = { padding: { top: spaceAttr(v), right: spaceAttr(h), bottom: spaceAttr(v), left: spaceAttr(h) } };
    css.push(`padding-top:${spaceCss(v)}`, `padding-right:${spaceCss(h)}`, `padding-bottom:${spaceCss(v)}`, `padding-left:${spaceCss(h)}`);
  }
  if (Object.keys(style).length) a.style = style;
  const classes = cls(
    textAlign && `has-text-align-${textAlign}`,
    align && `align${align}`,
    className,
    fontSize && `has-${fontSize}-font-size`,
    text && 'has-text-color',
    background && 'has-background'
  );
  return { a, classes, styleAttr: css.length ? ` style="${css.join(';')}"` : '' };
}

function heading(textValue, level = 2, opts = {}) {
  const { a, classes, styleAttr } = supports(opts);
  if (level !== 2) a.level = level;
  return wrap('heading', a, `<h${level} class="${cls('wp-block-heading', classes)}"${styleAttr}>${esc(textValue)}</h${level}>`);
}

function paragraphHtml(html, opts = {}) {
  const { a, classes, styleAttr } = supports({ ...opts, textAlignKey: 'align' });
  return wrap('paragraph', a, `<p${classes ? ` class="${classes}"` : ''}${styleAttr}>${html}</p>`);
}

const paragraph = (textValue, opts) => paragraphHtml(esc(textValue), opts);

function button(textValue, href, outline = false) {
  return wrap(
    'button',
    outline ? { className: 'is-style-outline' } : null,
    `<div class="${cls('wp-block-button', outline && 'is-style-outline')}"><a class="wp-block-button__link wp-element-button" href="${esc(href)}">${esc(textValue)}</a></div>`
  );
}

// justify: 'center' | 'right' etc. Layout classes are added at render time, not saved.
function buttons(items, { justify } = {}) {
  const a = justify ? { layout: { type: 'flex', justifyContent: justify } } : null;
  return wrap('buttons', a, `<div class="wp-block-buttons">${[].concat(items).filter(Boolean).join('')}</div>`);
}

function image(img, { radius } = {}) {
  if (!img) return '';
  const a = {};
  if (img.id) a.id = img.id;
  a.sizeSlug = 'large';
  a.linkDestination = 'none';
  const imgClass = img.id ? ` class="wp-image-${img.id}"` : '';
  let imgStyle = '';
  if (radius) {
    a.style = { border: { radius: `${radius}px` } };
    imgStyle = ` style="border-radius:${radius}px"`;
  }
  return wrap(
    'image',
    a,
    `<figure class="${cls('wp-block-image', 'size-large', radius && 'has-custom-border')}"><img src="${esc(img.url)}" alt="${esc(img.alt)}"${imgClass}${imgStyle}/></figure>`
  );
}

function gallery(images, { columns: cols, align } = {}) {
  if (!images.length) return '';
  const a = { linkTo: 'none' };
  if (cols) a.columns = cols;
  if (align) a.align = align;
  return wrap(
    'gallery',
    a,
    `<figure class="${cls('wp-block-gallery', 'has-nested-images', cols ? `columns-${cols}` : 'columns-default', 'is-cropped', align && `align${align}`)}">${images.map((i) => image(i)).join('\n\n')}</figure>`
  );
}

function column(inner, { valign, ...opts } = {}) {
  const { a, classes, styleAttr } = supports(opts);
  if (valign) a.verticalAlignment = valign;
  return wrap('column', a, `<div class="${cls('wp-block-column', valign && `is-vertically-aligned-${valign}`, classes)}"${styleAttr}>${join(inner)}</div>`);
}

function columns(cols, { valign, ...opts } = {}) {
  const { a, classes, styleAttr } = supports(opts);
  if (valign) a.verticalAlignment = valign;
  return wrap('columns', a, `<div class="${cls('wp-block-columns', valign && `are-vertically-aligned-${valign}`, classes)}"${styleAttr}>${join(cols)}</div>`);
}

// layout: 'constrained' (default: children centred at the theme's content width),
// 'flow' (children use the group's full width), 'flex' (row) or 'stack'.
function group(inner, { layout = 'constrained', justify, ...opts } = {}) {
  const { a, classes, styleAttr } = supports(opts);
  if (layout === 'flex') a.layout = clean({ type: 'flex', flexWrap: 'wrap', justifyContent: justify });
  else if (layout === 'stack') a.layout = { type: 'flex', orientation: 'vertical' };
  else if (layout === 'constrained') a.layout = { type: 'constrained' };
  return wrap('group', a, `<div class="${cls('wp-block-group', classes)}"${styleAttr}>${join(inner)}</div>`);
}

// Full-width image with a coloured overlay and content on top (the homepage hero).
function cover(inner, { img, overlay = '#000000', dim = 60, minHeight = 560, align = 'full', className } = {}) {
  const a = clean({ url: img?.url, id: img?.id, alt: img?.alt || undefined, dimRatio: dim, customOverlayColor: overlay, isUserOverlayColor: true, minHeight, align, className });
  a.layout = { type: 'constrained' };
  const dimClass = dim === 0 ? '' : `has-background-dim-${dim} has-background-dim`;
  const span = `<span aria-hidden="true" class="${cls('wp-block-cover__background', dimClass)}" style="background-color:${overlay}"></span>`;
  const imgTag = img
    ? `<img class="${cls('wp-block-cover__image-background', img.id && `wp-image-${img.id}`)}" alt="${esc(img.alt || '')}" src="${esc(img.url)}" data-object-fit="cover"/>`
    : '';
  return wrap(
    'cover',
    a,
    `<div class="${cls('wp-block-cover', align && `align${align}`, className)}" style="min-height:${minHeight}px">${span}${imgTag}<div class="wp-block-cover__inner-container">${join(inner)}</div></div>`
  );
}

function quote(textValue, cite, opts = {}) {
  const { a, classes, styleAttr } = supports(opts);
  const citeHtml = cite ? `<cite>${esc(cite)}</cite>` : '';
  return wrap('quote', a, `<blockquote class="${cls('wp-block-quote', classes)}"${styleAttr}>${paragraph(textValue)}${citeHtml}</blockquote>`);
}

const spacer = (height = 48) =>
  wrap('spacer', { height: `${height}px` }, `<div style="height:${height}px" aria-hidden="true" class="wp-block-spacer"></div>`);

const separator = () => wrap('separator', null, '<hr class="wp-block-separator has-alpha-channel-opacity"/>');

const html = (raw) => wrap('html', null, raw);

// Shortcode block: the text is saved as-is and expanded by the plugin when the page renders.
const shortcode = (code) => wrap('shortcode', null, code);

module.exports = {
  esc, attrs, dynamic, heading, paragraph, paragraphHtml, button, buttons, image, gallery,
  column, columns, group, cover, quote, spacer, separator, html, shortcode,
};
