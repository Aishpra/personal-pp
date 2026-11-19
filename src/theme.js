// Site-wide parts pushed into the active block theme: header, footer, and custom CSS
// (stored in Global Styles, so no plugin or child theme is needed).
const b = require('./blocks');
const { palette, telHref } = require('./generator');

// A wide logo is usually a wordmark that already contains the name, so it is shown
// larger and the text site title is dropped. A square-ish mark gets the name beside it.
function isWordmark(logo) {
  return Boolean(logo && logo.width && logo.height && logo.width / logo.height >= 1.8);
}

function header(intake = {}) {
  const wordmark = isWordmark(intake.logo);
  const brand = [];
  if (intake.logo) brand.push(b.dynamic('site-logo', { width: wordmark ? 170 : 52, shouldSyncIcon: false }));
  if (!wordmark) brand.push(b.dynamic('site-title', { level: 0 }));
  return b.group(
    [
      b.group(brand, { layout: 'flex', className: 'sk-brand' }),
      b.group(
        [b.dynamic('navigation', { overlayMenu: 'mobile', layout: { type: 'flex', justifyContent: 'right' } }), b.buttons(b.button('Get a quote', '/contact/'))],
        { layout: 'flex', className: 'sk-nav' }
      ),
    ],
    { align: 'full', layout: 'flex', justify: 'space-between', className: 'sk-header', padding: [30, 50] }
  );
}

// Footer with NAP (name, address, phone) details for local SEO, per the PDF.
function footer(intake) {
  const c = palette(intake);
  const contact = [];
  if (intake.address) contact.push(b.esc(intake.address));
  if (intake.phone) contact.push(`<a href="${b.esc(telHref(intake.phone))}">${b.esc(intake.phone)}</a>`);
  if (intake.email) contact.push(`<a href="mailto:${b.esc(intake.email)}">${b.esc(intake.email)}</a>`);

  return b.group(
    [
      b.columns([
        b.column([
          b.dynamic('site-title', { level: 0 }),
          intake.tagline ? b.paragraph(intake.tagline) : '',
        ]),
        b.column([b.paragraph('Contact', { className: 'sk-eyebrow' }), contact.length ? b.paragraphHtml(contact.join('<br>')) : '']),
        b.column([b.paragraph('Pages', { className: 'sk-eyebrow' }), b.dynamic('page-list')]),
      ], { align: 'wide' }),
      b.group([b.separator(), b.paragraph(`© ${intake.businessName}. All rights reserved.`, { fontSize: 'small' })], { align: 'wide', layout: 'flow' }),
    ],
    { align: 'full', className: 'sk-footer', background: c.overlay, text: '#ffffff', padding: [70, 50] }
  );
}

// Animations are progressive: scroll reveals use CSS scroll-driven animations where the
// browser supports them, and everything is switched off for prefers-reduced-motion.
function customCss() {
  return `
/* Full-width bands sit flush against each other, the header and the footer. */
.wp-block-post-content>.alignfull,main>.wp-block-post-content,footer.wp-block-template-part,main.wp-block-group{margin-block:0!important}
main.wp-block-group{padding-block:0!important}
.wp-block-post-content>.alignfull+.alignfull{margin-block-start:0!important}
header.wp-block-template-part{position:sticky;top:0;z-index:50;background:var(--wp--preset--color--base,#fff);box-shadow:0 1px 0 rgba(0,0,0,.06)}
body.admin-bar header.wp-block-template-part{top:32px}
@media (max-width:782px){body.admin-bar header.wp-block-template-part{top:46px}}
.sk-header{gap:1rem}
.sk-brand{gap:.75rem;align-items:center}
.sk-nav{gap:1.5rem;align-items:center}
.sk-header{flex-wrap:nowrap!important}
@media (max-width:600px){.sk-nav .wp-block-buttons{display:none}.sk-brand .wp-block-site-logo img{max-width:120px;height:auto}}
.sk-eyebrow{text-transform:uppercase;letter-spacing:.14em;font-size:.78rem;font-weight:600;opacity:.8}
.sk-hero .wp-block-cover__inner-container{max-width:760px}
.sk-hero h1{line-height:1.05;letter-spacing:-.02em}
.sk-section h2{letter-spacing:-.01em}
.sk-card{height:100%;box-shadow:0 1px 3px rgba(0,0,0,.06);transition:transform .3s cubic-bezier(.2,.7,.2,1),box-shadow .3s ease}
.sk-card:hover{transform:translateY(-6px);box-shadow:0 18px 40px rgba(0,0,0,.12)}
.sk-card a{text-decoration:none;font-weight:600}
.wp-block-columns:has(.sk-card)>.wp-block-column{display:flex;flex-direction:column}
.wp-element-button{transition:transform .2s ease,box-shadow .2s ease,background-color .2s ease,color .2s ease}
.wp-element-button:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(0,0,0,.15)}
.wp-block-image img,.sk-map{box-shadow:0 20px 50px rgba(0,0,0,.12)}
.sk-gallery .wp-block-gallery figure{overflow:hidden;border-radius:12px}
.sk-gallery .wp-block-gallery img{transition:transform .6s cubic-bezier(.2,.7,.2,1)}
.sk-gallery .wp-block-gallery figure:hover img{transform:scale(1.06)}
.sk-facts h3{margin-bottom:0}
.sk-footer a{color:inherit;text-decoration:none;overflow-wrap:normal;word-break:normal}
.sk-footer .wp-block-site-title a{font-weight:700}
.sk-footer a:hover{text-decoration:underline}
.sk-footer .wp-block-page-list{list-style:none;padding:0;margin:0;display:grid;gap:.4rem}
.sk-footer .wp-block-separator{opacity:.25}
@keyframes sk-rise{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:no-preference){
  .sk-hero .wp-block-cover__inner-container>*{animation:sk-rise .9s cubic-bezier(.2,.7,.2,1) both}
  .sk-hero .wp-block-cover__inner-container>:nth-child(2){animation-delay:.08s}
  .sk-hero .wp-block-cover__inner-container>:nth-child(3){animation-delay:.16s}
  .sk-hero .wp-block-cover__inner-container>:nth-child(4){animation-delay:.24s}
  .sk-hero .wp-block-cover__inner-container>:nth-child(5){animation-delay:.32s}
  .sk-hero .wp-block-cover__image-background{animation:sk-zoom 14s ease-out both}
  @keyframes sk-zoom{from{transform:scale(1.08)}to{transform:scale(1)}}
  @supports (animation-timeline:view()){
    .sk-reveal>*{animation:sk-rise linear both;animation-timeline:view();animation-range:entry 5% cover 25%}
  }
}
@media (prefers-reduced-motion:reduce){
  .sk-card,.wp-element-button,.sk-gallery .wp-block-gallery img{transition:none}
  .sk-card:hover,.wp-element-button:hover{transform:none}
}
`.trim();
}

module.exports = { header, footer, customCss, isWordmark };
