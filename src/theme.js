// Site-wide parts pushed into the active block theme: header, footer, and custom CSS
// (stored in Global Styles, so no plugin or child theme is needed).
const b = require('./blocks');
const { palette, telHref, waHref, ctaHref } = require('./generator');
const icons = require('./icons');

// A wide logo is usually a wordmark that already contains the name, so it is shown
// larger and the text site title is dropped. A square-ish mark gets the name beside it.
function isWordmark(logo) {
  return Boolean(logo && logo.width && logo.height && logo.width / logo.height >= 1.8);
}

// Thin bar above the header with the details visitors look for first (location, phone,
// email, WhatsApp). Desktop only; it folds away once the page scrolls.
function topbar(intake = {}) {
  const left = [];
  const right = [];
  const place = intake.location || intake.serviceArea;
  if (place) left.push(`<span>${icons.pin}${b.esc(place)}</span>`);
  if (intake.phone) right.push(`<a href="${b.esc(telHref(intake.phone))}">${icons.phone}${b.esc(intake.phone)}</a>`);
  if (intake.whatsapp) right.push(`<a href="${b.esc(waHref(intake.whatsapp))}">${icons.chat}WhatsApp</a>`);
  if (intake.email) right.push(`<a href="mailto:${b.esc(intake.email)}">${icons.mail}${b.esc(intake.email)}</a>`);
  if (!left.length && !right.length) return '';
  return b.html(`<div class="sk-topbar"><div class="sk-topbar__inner"><div class="sk-topbar__left">${left.join('')}</div><div class="sk-topbar__right">${right.join('')}</div></div></div>`);
}

function header(intake = {}, siteUrl = '') {
  const wordmark = isWordmark(intake.logo);
  const brand = [];
  if (intake.logo) brand.push(b.dynamic('site-logo', { width: wordmark ? 170 : 52, shouldSyncIcon: false }));
  if (!wordmark) brand.push(b.dynamic('site-title', { level: 0 }));
  return topbar(intake) + '\n\n' + b.group(
    [
      b.group(brand, { layout: 'flex', className: 'sk-brand' }),
      b.group(
        [b.dynamic('navigation', { overlayMenu: 'mobile', layout: { type: 'flex', justifyContent: 'right' } }), intake.pages ? b.buttons(b.button(intake.ctaLabel || 'Get a quote', ctaHref(intake, siteUrl))) : ''],
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
function customCss(style = 'classic') {
  return (baseCss() + (STYLES[style] || '')).trim();
}

function baseCss() {
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
.sk-eyebrow{text-transform:uppercase;letter-spacing:.14em;font-size:max(12px,.78rem);font-weight:600;opacity:.8}
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
/* ---- Design layer: every colour comes from the client's brand palette. ---- */
:root{--sk-primary:var(--wp--preset--color--brand-primary,#2563eb);--sk-ease:cubic-bezier(.2,.8,.2,1)}
html{scroll-behavior:smooth}
body{-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
::selection{background:color-mix(in srgb,var(--sk-primary) 25%,transparent)}
h1.wp-block-heading,h2.wp-block-heading,h3.wp-block-heading{font-weight:700;letter-spacing:-.03em;line-height:1.08;text-wrap:balance}
h1.wp-block-heading{font-weight:800}
.wp-block-post-content p{text-wrap:pretty}
/* Header: frosted glass, animated underline on menu links */
header.wp-block-template-part{background:color-mix(in srgb,#fff 84%,transparent);-webkit-backdrop-filter:saturate(1.6) blur(14px);backdrop-filter:saturate(1.6) blur(14px)}
.sk-nav .wp-block-navigation-item__content{position:relative;font-weight:500}
.sk-nav .wp-block-navigation-item__content::after{content:"";position:absolute;left:0;right:0;bottom:-4px;height:2px;border-radius:2px;background:var(--sk-primary);transform:scaleX(0);transform-origin:left;transition:transform .35s var(--sk-ease)}
.sk-nav .wp-block-navigation-item__content:hover::after,.sk-nav .current-menu-item>.wp-block-navigation-item__content::after{transform:scaleX(1)}
/* Buttons: pill shape, brand-tinted shadow, arrow that slides on hover */
.wp-element-button{border-radius:999px!important;padding:.9em 1.55em!important;font-weight:600!important;letter-spacing:.005em}
.wp-block-button:not(.is-style-outline) .wp-element-button{box-shadow:0 10px 24px -10px color-mix(in srgb,var(--sk-primary) 75%,transparent)}
.wp-block-button:not(.is-style-outline) .wp-element-button:hover{box-shadow:0 16px 30px -12px color-mix(in srgb,var(--sk-primary) 85%,transparent)}
.sk-hero .wp-block-button:first-child .wp-element-button::after,.sk-cta .wp-block-button:first-child .wp-element-button::after{content:"→";display:inline-block;margin-left:.55em;transition:transform .3s var(--sk-ease)}
.sk-hero .wp-block-button:first-child .wp-element-button:hover::after,.sk-cta .wp-block-button:first-child .wp-element-button:hover::after{transform:translateX(4px)}
/* Hero: bigger, bolder, with a brand-tinted gradient over the photo */
.sk-hero h1{font-size:clamp(2.5rem,6vw,4.75rem)!important;letter-spacing:-.045em;line-height:1!important}
.sk-hero::after{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(100deg,rgba(0,0,0,.5) 0%,rgba(0,0,0,.12) 55%,transparent 80%),radial-gradient(60% 90% at 100% 100%,color-mix(in srgb,var(--sk-primary) 45%,transparent),transparent 70%)}
.sk-section h2.wp-block-heading{font-size:clamp(2rem,3.6vw,2.9rem)!important}
.sk-hero .sk-eyebrow{display:inline-block;padding:.5em 1em;border-radius:999px;background:rgba(255,255,255,.14);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.2);opacity:1}
.sk-hero .sk-eyebrow::before{display:none}
/* ---- Hero: split layout, floating photo collage, living background ---- */
.sk-hero{overflow:hidden;isolation:isolate}
/* The cover is a flex box, so its inner container would form its own layer and sit under the
   overlay; z-index:auto lets the text and decor layer against the overlay directly. */
.sk-hero .wp-block-cover__inner-container{position:static!important;z-index:auto!important;width:100%;max-width:min(1240px,100%)!important}
.sk-hero .wp-block-cover__inner-container>*{position:relative;z-index:3}
.sk-hero .wp-block-cover__image-background{transform:scale(1.12)}
.sk-hero .sk-hero-decor{position:absolute!important;inset:0;z-index:2;margin:0!important;max-width:none!important;pointer-events:none;overflow:hidden}
.sk-hero-grid{gap:clamp(28px,5vw,80px)!important;margin-block:0!important}
.sk-hero-text{max-width:680px}
.sk-hero-grid .sk-hero-text h1{font-size:clamp(2.4rem,4.6vw,4.4rem)!important}
.sk-hero-collage{position:relative;height:clamp(320px,36vw,500px);margin:0!important}
.sk-hero-collage>figure{position:absolute!important;margin:0!important;overflow:hidden;border-radius:22px;border:6px solid rgba(255,255,255,.92);box-shadow:0 40px 80px -30px rgba(0,0,0,.7)}
.sk-hero-collage>figure img{width:100%;height:100%;object-fit:cover;border-radius:0!important}
.sk-hero-collage>figure:nth-of-type(1){width:70%;aspect-ratio:4/5;right:2%;top:0;rotate:3deg}
.sk-hero-collage>figure:nth-of-type(2){width:50%;aspect-ratio:1;left:0;bottom:0;rotate:-6deg}
.sk-hero-badge{position:absolute;left:30%;top:10%;z-index:4;display:grid;gap:2px;padding:16px 20px;border-radius:18px;color:#fff;background:color-mix(in srgb,var(--sk-primary) 82%,rgba(0,0,0,.4));-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.3),0 20px 40px -20px rgba(0,0,0,.55)}
.sk-hero-badge strong{font-size:2.3rem;line-height:1;font-weight:800;letter-spacing:-.03em}
.sk-hero-badge span{font-size:max(12px,.72rem);font-weight:600;text-transform:uppercase;letter-spacing:.14em;opacity:.85}
.sk-hero-glow{position:absolute;width:55vmax;height:55vmax;right:-14vmax;top:-22vmax;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--sk-primary) 70%,transparent),transparent);opacity:.5}
.sk-hero-ring,.sk-shape,.sk-hero-marquee{display:none}
.sk-scroll-cue{position:absolute!important;left:50%;bottom:26px;z-index:4;width:26px;height:42px;margin:0!important;translate:-50% 0;border:2px solid rgba(255,255,255,.7);border-radius:14px}
.sk-scroll-cue span{position:absolute;left:50%;top:8px;width:4px;height:8px;margin-left:-2px;border-radius:2px;background:#fff}
/* Stacked hero (phones and small tablets): room above the collage, gentler tilts. */
@media (max-width:781px){.sk-hero-visual{margin-top:40px!important}.sk-hero-collage{height:clamp(260px,72vw,400px)}.sk-hero-collage>figure:nth-of-type(1){rotate:2deg}.sk-hero-collage>figure:nth-of-type(2){rotate:-3deg}.sk-hero-badge strong{font-size:1.7rem}.sk-scroll-cue{display:none}}
/* ---- Every screen size ---- */
/* Tablets (600-959px): the full-screen menu instead of a squeezed desktop menu. WordPress only
   switches below 600px, so the hamburger is shown up to 960px here. */
@media (min-width:600px) and (max-width:959px){
  .sk-nav .wp-block-navigation__responsive-container-open:not(.always-shown){display:flex!important}
  .sk-nav .wp-block-navigation__responsive-container:not(.hidden-by-default):not(.is-menu-open){display:none!important}
  .sk-nav{flex-wrap:nowrap!important;gap:14px!important}
}
.sk-header .sk-nav{flex-wrap:nowrap}
/* Comfortable tap targets for footer and contact links on touch screens. */
@media (pointer:coarse),(max-width:781px){.sk-footer a,.sk-footer .wp-block-pages-list__item__link,.sk-breadcrumb a,.sk-card a{display:inline-block;padding-block:10px}.sk-footer .wp-block-page-list{gap:0!important}}
/* Long words and emails never push the page sideways. */
.wp-block-post-content p,.wp-block-post-content h1,.wp-block-post-content h2,.wp-block-post-content h3,.sk-footer p{overflow-wrap:break-word}
/* Very wide screens: keep line lengths readable. */
@media (min-width:1600px){.sk-hero .wp-block-cover__inner-container,.sk-pagehero .wp-block-cover__inner-container{max-width:1320px!important}}

@keyframes sk-hero-rise{from{opacity:0;translate:0 28px}to{opacity:1;translate:0 0}}
@keyframes sk-pop{from{opacity:0;scale:.82}to{opacity:1;scale:1}}
@keyframes sk-bob{50%{translate:0 -10px}}
@keyframes sk-kenburns{from{transform:scale(1.12) translate(0,0)}to{transform:scale(1.24) translate(-2.5%,-2%)}}
@keyframes sk-glow{to{transform:translate(-14vw,22vh) scale(1.2)}}
@keyframes sk-spin{to{rotate:360deg}}
@keyframes sk-marquee{to{transform:translateX(-50%)}}
@keyframes sk-float{50%{translate:0 -24px;rotate:25deg}}
@keyframes sk-cue{0%{opacity:0;transform:translateY(0)}30%{opacity:1}100%{opacity:0;transform:translateY(14px)}}
/* ---- Top bar, navigation and mobile menu ---- */
html{scroll-padding-top:120px}
/* The top bar scrolls away while the main bar stays pinned: the sticky header sits 38px above
   the top of the screen, so nothing below it moves when the page scrolls. */
.sk-topbar{height:38px;background:var(--wp--preset--color--brand-secondary,#111);color:rgba(255,255,255,.8);font-size:.82rem;overflow:hidden}
@media (min-width:782px){header.wp-block-template-part:has(.sk-topbar){top:-38px}body.admin-bar header.wp-block-template-part:has(.sk-topbar){top:-6px}}
.sk-topbar__inner{display:flex;justify-content:space-between;align-items:center;gap:20px;height:100%;padding:0 var(--wp--preset--spacing--50)}
.sk-topbar__left,.sk-topbar__right{display:flex;flex-wrap:wrap;gap:22px}
.sk-topbar a,.sk-topbar span{display:inline-flex;align-items:center;gap:7px;color:inherit;text-decoration:none;transition:color .2s}
.sk-topbar a:hover{color:#fff}
.sk-topbar .sk-icon{width:14px;height:14px;opacity:.75}
@media (max-width:781px){.sk-topbar{display:none}}
.sk-nav .wp-block-navigation-item__content{padding:.45em .85em!important;border-radius:999px;transition:background-color .25s,color .25s}
.sk-nav .wp-block-navigation-item__content:hover{background:color-mix(in srgb,var(--sk-primary) 10%,transparent)}
.sk-nav .wp-block-navigation-item__content::after{left:.85em!important;right:.85em!important;bottom:.2em!important}
.wp-block-navigation__responsive-container-open{width:46px;height:46px;border-radius:14px;align-items:center;justify-content:center;background:var(--sk-primary);color:#fff;transition:transform .2s}
.wp-block-navigation__responsive-container-open:active{transform:scale(.94)}
.wp-block-navigation__responsive-container.is-menu-open{background:var(--wp--preset--color--brand-secondary,#111)!important;color:#fff!important;padding:clamp(22px,6vw,44px)!important;overflow:hidden}
.wp-block-navigation__responsive-container.is-menu-open::before{content:"";position:absolute;width:120vw;height:120vw;right:-60vw;top:-60vw;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--sk-primary) 55%,transparent),transparent);pointer-events:none}
.is-menu-open .wp-block-navigation__responsive-container-content{align-items:flex-start!important;justify-content:center!important;padding-top:40px!important}
.wp-block-navigation__responsive-container.is-menu-open{--navigation-layout-justification-setting:flex-start;--navigation-layout-justify:flex-start;text-align:left}
.is-menu-open .wp-block-navigation__container{flex-direction:column!important;align-items:flex-start!important;gap:.1em!important}
.is-menu-open .wp-block-navigation__container,.is-menu-open .wp-block-page-list,.is-menu-open .wp-block-pages-list__item{align-items:flex-start!important}
.is-menu-open .wp-block-page-list{flex-direction:column!important;gap:.1em!important}
.is-menu-open .wp-block-navigation-item__content{font-size:clamp(2.1rem,10vw,3.4rem)!important;font-weight:800!important;letter-spacing:-.03em;line-height:1.15;color:#fff!important;padding:.08em 0!important;background:none!important}
.is-menu-open .wp-block-navigation-item__content::after{left:0!important;right:0!important;bottom:.06em!important;height:4px!important}
.is-menu-open .wp-block-navigation-item{opacity:0;transform:translateY(26px);animation:sk-menu-in .6s cubic-bezier(.2,.8,.2,1) forwards}
.is-menu-open .wp-block-navigation-item:nth-child(2){animation-delay:.06s}.is-menu-open .wp-block-navigation-item:nth-child(3){animation-delay:.12s}
.is-menu-open .wp-block-navigation-item:nth-child(4){animation-delay:.18s}.is-menu-open .wp-block-navigation-item:nth-child(5){animation-delay:.24s}.is-menu-open .wp-block-navigation-item:nth-child(6){animation-delay:.3s}
.is-menu-open .wp-block-navigation__responsive-container-close{color:#fff;width:46px;height:46px;border-radius:14px;background:rgba(255,255,255,.1);display:grid;place-items:center}
/* A blurred (backdrop-filter) header would trap the fixed full-screen menu inside itself,
   so the blur is switched off while the menu is open. */
.has-modal-open header.wp-block-template-part,header.wp-block-template-part:has(.is-menu-open){-webkit-backdrop-filter:none!important;backdrop-filter:none!important}
.sk-menu-extra{display:none}
.is-menu-open .sk-menu-extra{display:grid;gap:14px;margin-top:34px;opacity:0;animation:sk-menu-in .6s .36s cubic-bezier(.2,.8,.2,1) forwards}
.sk-menu-extra a{color:rgba(255,255,255,.8)!important;text-decoration:none;display:inline-flex;align-items:center;gap:10px;font-size:1rem}
.sk-menu-extra .wp-element-button{justify-self:start;color:#fff!important;background:var(--sk-primary)!important;font-size:1rem}
@keyframes sk-menu-in{to{opacity:1;transform:none}}
/* ---- Inner pages: photo banner with breadcrumbs ---- */
.sk-pagehero{overflow:hidden;isolation:isolate}
.sk-pagehero .wp-block-cover__inner-container{position:static!important;z-index:auto!important;width:100%;max-width:min(1240px,100%)!important}
.sk-pagehero .wp-block-cover__inner-container>*{position:relative;z-index:3}
.sk-pagehero .sk-hero-decor{position:absolute!important;inset:0;z-index:2;margin:0!important;max-width:none!important;pointer-events:none;overflow:hidden}
.sk-banner.sk-pagehero::after{content:""!important;display:block!important;position:absolute;inset:0!important;z-index:1;width:auto!important;height:auto!important;aspect-ratio:auto!important;border-radius:0!important;transform:none!important;animation:none!important;background:linear-gradient(100deg,rgba(0,0,0,.55),rgba(0,0,0,.08) 72%)!important}
.sk-pagehero .wp-block-cover__image-background{transform:scale(1.1)}
.sk-pagehero-text{max-width:780px}
.sk-pagehero h1,.sk-pagehero p{color:#fff}
.sk-breadcrumb{display:flex;flex-wrap:wrap;gap:10px;align-items:center;font-size:max(12px,.8rem)!important;font-weight:600;letter-spacing:.12em;text-transform:uppercase;opacity:.85;margin-bottom:.8em!important}
.sk-breadcrumb a{color:inherit!important;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.45);transition:border-color .2s}
.sk-breadcrumb a:hover{border-color:currentColor}
.sk-banner:not(.sk-pagehero) .sk-breadcrumb a{border-color:color-mix(in srgb,currentColor 35%,transparent)}
.sk-breadcrumb__sep{opacity:.5}
/* ---- Services: jump links, anchors, big outlined numbers ---- */
.wp-block-post-content{counter-reset:sk-svc}
.sk-jump-wrap{border-bottom:1px solid rgba(0,0,0,.07)}
.sk-jump{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:center}
.sk-jump__label{font-size:max(12px,.75rem);font-weight:600;letter-spacing:.16em;text-transform:uppercase;opacity:.6;margin-right:6px}
.sk-jump a{padding:.55em 1.15em;border-radius:999px;border:1.5px solid color-mix(in srgb,var(--sk-primary) 35%,transparent);color:inherit;text-decoration:none;font-weight:600;font-size:.92rem;transition:background-color .25s,border-color .25s,color .25s,transform .25s}
.sk-jump a:hover{background:var(--sk-primary);border-color:var(--sk-primary);color:#fff;transform:translateY(-2px)}
.sk-anchor{display:block;height:0;margin:0!important}
.sk-service-row{counter-increment:sk-svc;position:relative;overflow:hidden}
.sk-service-row::before{content:counter(sk-svc,decimal-leading-zero);position:absolute;top:0;right:2%;font-size:clamp(6rem,15vw,13rem);font-weight:800;line-height:1;letter-spacing:-.05em;color:transparent;-webkit-text-stroke:1.5px color-mix(in srgb,var(--sk-primary) 28%,transparent);pointer-events:none;z-index:0}
.sk-service-row:nth-of-type(odd)::before{right:auto;left:2%}
.sk-service-row>*{position:relative;z-index:1}
/* ---- About: numbered value cards, photo mosaic ---- */
.sk-card-num{font-size:2.6rem!important;font-weight:800;line-height:1!important;letter-spacing:-.04em;color:var(--sk-primary);margin:0 0 .35em!important}
.sk-mosaic .wp-block-gallery{display:grid!important;grid-template-columns:2fr 1fr 1fr;grid-auto-rows:230px;gap:14px!important}
.sk-mosaic .wp-block-gallery>figure{width:auto!important;height:100%!important;margin:0!important}
.sk-mosaic .wp-block-gallery>figure:first-child{grid-row:span 2}
.sk-mosaic .wp-block-gallery.columns-4>figure:nth-child(2){grid-column:span 2}
.sk-mosaic .wp-block-gallery.columns-3{grid-template-columns:2fr 1fr}
.sk-mosaic .wp-block-gallery.columns-2{grid-template-columns:1fr 1fr;grid-auto-rows:320px}
.sk-mosaic .wp-block-gallery.columns-2>figure:first-child{grid-row:auto}
.sk-mosaic .wp-block-gallery>figure img{height:100%!important;object-fit:cover}
@media (max-width:781px){.sk-mosaic .wp-block-gallery{grid-template-columns:1fr 1fr;grid-auto-rows:160px}}
/* ---- Contact: quick action cards ---- */
.sk-qcards{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px;max-width:var(--wp--style--global--wide-size,1200px);margin-inline:auto}
.sk-qcard{display:grid;gap:4px;align-content:start;padding:24px;border-radius:18px;background:#fff;border:1px solid rgba(0,0,0,.07);color:inherit!important;text-decoration:none!important;box-shadow:0 1px 3px rgba(0,0,0,.05);transition:transform .3s var(--sk-ease),box-shadow .3s}
.sk-qcard:hover{transform:translateY(-5px);box-shadow:0 24px 50px -20px color-mix(in srgb,var(--sk-primary) 45%,rgba(0,0,0,.3))}
.sk-qcard__icon{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;margin-bottom:10px;background:color-mix(in srgb,var(--sk-primary) 12%,transparent);color:var(--sk-primary);transition:background-color .3s,color .3s,transform .3s}
.sk-qcard:hover .sk-qcard__icon{background:var(--sk-primary);color:#fff;transform:rotate(-6deg)}
.sk-qcard__icon .sk-icon{width:22px;height:22px}
.sk-qcard strong{font-size:1.1rem}
.sk-qcard span:last-child{font-size:.9rem;opacity:.7;overflow-wrap:anywhere}
/* Eyebrows: brand colour with a short rule */
.sk-section .sk-eyebrow,.sk-banner .sk-eyebrow{color:var(--sk-primary);opacity:1}
.sk-cta .sk-eyebrow,.sk-footer .sk-eyebrow{color:inherit}
.sk-eyebrow::before{content:"";display:inline-block;width:1.5em;height:2px;margin-right:.6em;vertical-align:middle;border-radius:2px;background:currentColor}
.sk-facts .sk-eyebrow::before,.sk-footer .sk-eyebrow::before{display:none}
/* Facts strip: big brand-coloured numbers */
.sk-facts h3{font-size:clamp(2rem,4vw,3.1rem)!important;font-weight:800;letter-spacing:-.04em;color:var(--sk-primary)}
/* The last fact is the service area or location: words, not a number, so it stays smaller. */
.sk-facts .wp-block-column:last-child h3{font-size:clamp(1.3rem,2.3vw,1.85rem)!important;letter-spacing:-.02em;line-height:1.2}
/* Inner-page banner and call-to-action band: soft glows */
.sk-banner,.sk-cta{position:relative;overflow:hidden;isolation:isolate}
.sk-banner h1{font-size:clamp(2.4rem,5vw,3.9rem)!important;letter-spacing:-.04em}
.sk-banner::after{content:"";position:absolute;z-index:-1;right:-8%;top:-70%;width:55%;aspect-ratio:1;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--sk-primary) 24%,transparent),transparent);pointer-events:none}
.sk-cta::before{content:"";position:absolute;z-index:-1;inset:0;background:radial-gradient(55% 140% at 0% 0%,rgba(255,255,255,.2),transparent 60%),radial-gradient(45% 120% at 100% 100%,rgba(0,0,0,.28),transparent 60%);pointer-events:none}
.sk-cta h2{font-size:clamp(2rem,4.2vw,3.2rem)!important;font-weight:800}
/* Cards: hairline border, brand bar that sweeps in on hover */
.sk-card{position:relative;overflow:hidden;border:1px solid rgba(0,0,0,.07)}
.sk-card::before{content:"";position:absolute;inset:0 0 auto;height:4px;background:var(--sk-primary);transform:scaleX(0);transform-origin:left;transition:transform .5s var(--sk-ease)}
.sk-card:hover::before{transform:scaleX(1)}
.sk-card:hover{box-shadow:0 24px 50px -20px color-mix(in srgb,var(--sk-primary) 40%,rgba(0,0,0,.35))}
.sk-card h3{font-weight:700}
.sk-card a{display:inline-flex;gap:.35em;transition:gap .3s var(--sk-ease)}
.sk-card a:hover{gap:.6em}
.sk-testimonials .sk-card>p:first-child::before{content:"“";display:block;font-size:3.5em;line-height:.6;font-weight:800;color:var(--sk-primary);margin-bottom:.15em}
/* Images: rounded, with a slow zoom on hover */
.wp-block-post-content .wp-block-image{overflow:hidden;border-radius:22px;box-shadow:0 24px 50px -24px rgba(0,0,0,.35)}
.wp-block-post-content .wp-block-image img{box-shadow:none;border-radius:0!important;transition:transform 1.2s var(--sk-ease)}
.wp-block-post-content .wp-block-image:hover img{transform:scale(1.04)}
.sk-gallery .wp-block-gallery figure{border-radius:18px}
.sk-map{border-radius:22px!important}
/* Contact form */
.wp-block-post-content form input:not([type=hidden]):not([type=checkbox]),.wp-block-post-content form textarea{width:100%;font:inherit;padding:.85em 1em;border:1.5px solid rgba(0,0,0,.12);border-radius:12px;background:#fcfcfb;transition:border-color .2s,box-shadow .2s}
.wp-block-post-content form input:focus,.wp-block-post-content form textarea:focus{outline:none;border-color:var(--sk-primary);box-shadow:0 0 0 4px color-mix(in srgb,var(--sk-primary) 18%,transparent)}
.wp-block-post-content form button{border:0;cursor:pointer}
/* Footer: brand stripe on top */
.sk-footer{position:relative}
.sk-footer::before{content:"";position:absolute;inset:0 0 auto;height:4px;background:linear-gradient(90deg,var(--sk-primary),color-mix(in srgb,var(--sk-primary) 35%,#fff))}
@keyframes sk-rise{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}
@keyframes sk-progress{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@media (prefers-reduced-motion:no-preference){
  .sk-hero-text>*{animation:sk-hero-rise .9s cubic-bezier(.2,.7,.2,1) both}
  .sk-hero-text>:nth-child(2){animation-delay:.08s}
  .sk-hero-text>:nth-child(3){animation-delay:.16s}
  .sk-hero-text>:nth-child(4){animation-delay:.24s}
  .sk-hero-text>:nth-child(5){animation-delay:.32s}
  .sk-hero .wp-block-cover__image-background,.sk-pagehero .wp-block-cover__image-background{animation:sk-kenburns 28s ease-in-out infinite alternate}
  .sk-hero-collage>figure{animation:sk-pop 1.1s cubic-bezier(.2,.8,.2,1) both}
  .sk-hero-collage>figure:nth-of-type(1){animation-delay:.3s}
  .sk-hero-collage>figure:nth-of-type(2){animation-delay:.5s}
  .sk-hero-badge{animation:sk-pop .9s .8s cubic-bezier(.2,.8,.2,1) both,sk-bob 5s 1.7s ease-in-out infinite}
  .sk-hero-glow{animation:sk-glow 16s ease-in-out infinite alternate}
  .sk-hero-ring{animation:sk-spin 70s linear infinite}
  .sk-hero-marquee{animation:sk-marquee 45s linear infinite}
  .sk-shape-1{animation:sk-float 9s ease-in-out infinite}
  .sk-shape-2{animation:sk-float 7s -2s ease-in-out infinite}
  .sk-shape-3{animation:sk-float 8s -4s ease-in-out infinite}
  .sk-scroll-cue span{animation:sk-cue 1.8s ease-in-out infinite}
  @supports (animation-timeline:view()){
    .sk-reveal>*{animation:sk-rise linear both;animation-timeline:view();animation-range:entry 5% cover 25%}
    .sk-reveal .wp-block-columns>.wp-block-column{animation:sk-rise linear both;animation-timeline:view();animation-range:entry 0% cover 22%}
    .sk-reveal .wp-block-columns>.wp-block-column:nth-child(2){animation-range:entry 6% cover 28%}
    .sk-reveal .wp-block-columns>.wp-block-column:nth-child(3){animation-range:entry 12% cover 34%}
    body::before{content:"";position:fixed;z-index:9999;top:0;left:0;width:100%;height:3px;background:var(--sk-primary);transform-origin:0 50%;animation:sk-progress linear both;animation-timeline:scroll(root);pointer-events:none}
  }
}
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  .sk-card,.sk-card::before,.wp-element-button,.sk-gallery .wp-block-gallery img,.wp-block-post-content .wp-block-image img{transition:none}
  .sk-card:hover,.wp-element-button:hover,.wp-block-post-content .wp-block-image:hover img{transform:none}
}
`;
}

// Design styles a client can pick (intake "Design style"). Each is a layer on top of the
// base CSS above and still uses the client's own brand colours. Fonts are the ones that
// ship with the Twenty Twenty-Five theme, so nothing is loaded from outside.
const FONTS = '/wp-content/themes/twentytwentyfive/assets/fonts';
const face = (family, file, weight = '100 900', style = 'normal') =>
  `@font-face{font-family:"${family}";src:url(${FONTS}/${file}) format("woff2");font-weight:${weight};font-style:${style};font-display:swap}`;
const H = 'h1.wp-block-heading,h2.wp-block-heading,h3.wp-block-heading';

const STYLES = {
  classic: '',

  // Brutalist: huge uppercase type, square shapes and hard offset shadows.
  bold: `
${face('SK Fira', 'fira-sans/FiraSans-Black.woff2', '900')}
${face('SK Fira', 'fira-sans/FiraSans-ExtraBold.woff2', '800')}
${H}{font-family:"SK Fira",var(--wp--preset--font-family--manrope),sans-serif;font-weight:900;text-transform:uppercase;letter-spacing:-.01em;line-height:.95}
.sk-hero h1{font-size:clamp(3rem,8vw,6.6rem)!important;letter-spacing:-.02em}
.sk-hero::after{background:linear-gradient(0deg,rgba(0,0,0,.72),rgba(0,0,0,.15) 65%)}
.wp-element-button{border-radius:0!important;border:2.5px solid #0a0a0a!important;box-shadow:5px 5px 0 #0a0a0a!important;text-transform:uppercase;letter-spacing:.06em;font-weight:800!important}
.wp-element-button:hover{transform:translate(-2px,-2px)!important;box-shadow:8px 8px 0 #0a0a0a!important}
.sk-hero .wp-element-button,.sk-cta .wp-element-button,.sk-header .wp-element-button{border-color:#fff!important;box-shadow:5px 5px 0 rgba(255,255,255,.85)!important}
.sk-header .wp-element-button{border-color:#0a0a0a!important;box-shadow:4px 4px 0 #0a0a0a!important}
header.wp-block-template-part{box-shadow:none;border-bottom:2.5px solid #0a0a0a}
.sk-eyebrow{font-weight:800;letter-spacing:.2em}
.sk-hero .sk-eyebrow{border-radius:0;background:var(--sk-primary);box-shadow:none}
.sk-hero-grid .sk-hero-text h1{font-size:clamp(2.7rem,5.4vw,5.2rem)!important}
.sk-hero-marquee{display:flex;position:absolute;left:0;bottom:6%;white-space:nowrap;font:900 clamp(5rem,13vw,11rem)/1 "SK Fira",sans-serif;text-transform:uppercase;color:transparent;-webkit-text-stroke:2px rgba(255,255,255,.16)}
.sk-hero-marquee span{padding-right:.35em}.sk-hero-marquee i{font-style:normal}
.sk-hero-glow{border-radius:0;opacity:.45}
.sk-hero-collage>figure{border-radius:0!important;border:3px solid #0a0a0a;box-shadow:12px 12px 0 var(--sk-primary)!important}
.sk-hero-badge{border-radius:0;background:var(--sk-primary);box-shadow:6px 6px 0 #0a0a0a;-webkit-backdrop-filter:none;backdrop-filter:none}
.sk-hero h1 .sk-word-last{color:transparent;-webkit-text-stroke:2px #fff;--sk-ul:0px}
.sk-card{border-radius:0!important;border:2.5px solid #0a0a0a;box-shadow:8px 8px 0 var(--sk-primary)!important;transition:transform .15s,box-shadow .15s}
.sk-card:hover{transform:translate(-3px,-3px)!important;box-shadow:12px 12px 0 var(--sk-primary)!important}
.sk-card::before{display:none}
.wp-block-post-content .wp-block-image,.sk-map{border-radius:0!important;border:2.5px solid #0a0a0a;box-shadow:12px 12px 0 #0a0a0a!important}
.sk-gallery .wp-block-gallery figure{border-radius:0!important;border:2.5px solid #0a0a0a}
.sk-facts{border-bottom:2.5px solid #0a0a0a}
.sk-facts h3{font-size:clamp(2.6rem,5.5vw,4.4rem)!important}
.sk-facts .wp-block-column:last-child h3{font-size:clamp(1.3rem,2.4vw,2rem)!important}
.sk-banner h1{font-size:clamp(3rem,7vw,5.6rem)!important}
.sk-banner::after{border-radius:0;top:0;bottom:0;right:0;width:38%;aspect-ratio:auto;background:repeating-linear-gradient(45deg,color-mix(in srgb,var(--sk-primary) 35%,transparent) 0 3px,transparent 3px 16px)}
.sk-cta h2{font-size:clamp(2.4rem,5.5vw,4.6rem)!important}
.sk-footer::before{height:10px;background:var(--sk-primary)}
.sk-nav .wp-block-navigation-item__content{text-transform:uppercase;font-weight:700!important;letter-spacing:.06em;font-size:.88rem;border-radius:0}
.wp-block-navigation__responsive-container-open{border-radius:0;border:2.5px solid #0a0a0a;box-shadow:4px 4px 0 #0a0a0a}
.is-menu-open .wp-block-navigation-item__content{font-family:"SK Fira",sans-serif!important;font-weight:900!important;text-transform:uppercase;letter-spacing:-.01em}
.sk-pagehero h1{font-size:clamp(3rem,7vw,5.8rem)!important}
.sk-jump a,.sk-qcard,.sk-qcard__icon{border-radius:0!important}
.sk-jump a{border:2px solid #0a0a0a;box-shadow:3px 3px 0 #0a0a0a}
.sk-qcard{border:2.5px solid #0a0a0a;box-shadow:7px 7px 0 var(--sk-primary)}
.sk-qcard:hover{transform:translate(-3px,-3px);box-shadow:10px 10px 0 var(--sk-primary)}
.sk-card-num{font-family:"SK Fira",sans-serif}
.sk-service-row::before{font-family:"SK Fira",sans-serif;font-weight:900;-webkit-text-stroke-width:2px}
`,

  // Luxury: serif with italics, centred hero, arch-shaped photos, spaced capitals.
  elegant: `
${face('SK Vollkorn', 'vollkorn/Vollkorn-VariableFont_wght.woff2', '400 900')}
${face('SK Vollkorn', 'vollkorn/Vollkorn-Italic-VariableFont_wght.woff2', '400 900', 'italic')}
${H}{font-family:"SK Vollkorn",Georgia,serif;font-weight:500;letter-spacing:-.01em;line-height:1.1}
.sk-hero h1{font-weight:400;font-style:italic;font-size:clamp(2.8rem,6.6vw,5.4rem)!important;letter-spacing:-.02em;line-height:1.02!important}
.sk-hero-visual{display:none!important}
.sk-hero-grid>.sk-hero-text{flex-basis:100%!important;max-width:880px;margin-inline:auto;text-align:center}
.sk-hero-text>p{margin-inline:auto}
.sk-hero .wp-block-buttons{justify-content:center}
.sk-hero-grid .sk-hero-text h1{font-size:clamp(2.8rem,6.4vw,5.4rem)!important}
.sk-hero-ring{display:block;position:absolute;left:50%;top:50%;width:min(86vh,760px);aspect-ratio:1;translate:-50% -50%;border:1px solid rgba(255,255,255,.25);border-radius:50%}
.sk-hero-ring::before{content:"";position:absolute;inset:7%;border:1px dashed rgba(255,255,255,.18);border-radius:50%}
.sk-hero-ring::after{content:"";position:absolute;top:-5px;left:50%;width:10px;height:10px;margin-left:-5px;border-radius:50%;background:color-mix(in srgb,var(--sk-primary) 60%,#fff)}
.sk-hero-glow{right:auto;left:50%;top:50%;margin:-27vmax 0 0 -27vmax;opacity:.22}
.sk-hero h1 .sk-word-last{color:color-mix(in srgb,var(--sk-primary) 45%,#fff);--sk-ul:0px}
.sk-hero::after{background:linear-gradient(180deg,rgba(0,0,0,.2),rgba(0,0,0,.55))}
.sk-hero p.has-x-large-font-size,.sk-banner p.has-large-font-size{font-family:"SK Vollkorn",Georgia,serif;font-style:italic}
.sk-hero .sk-eyebrow{background:none;box-shadow:none;-webkit-backdrop-filter:none;backdrop-filter:none;padding:0}
.sk-eyebrow{letter-spacing:.32em;font-weight:500}
.sk-eyebrow::before{width:2.6em;height:1px}
.wp-element-button{border-radius:0!important;text-transform:uppercase;letter-spacing:.2em;font-size:.8rem!important;font-weight:600!important;padding:1.2em 2.2em!important;box-shadow:none!important}
.sk-hero .wp-block-button:first-child .wp-element-button::after,.sk-cta .wp-block-button:first-child .wp-element-button::after{display:none}
.sk-card{border:0;border-radius:0!important;text-align:center;box-shadow:0 30px 60px -38px rgba(0,0,0,.35)}
.sk-card::before{inset:auto 35% 0;height:2px}
.sk-card h3{font-size:1.65rem!important}
.sk-card a{justify-content:center}
.wp-block-post-content .wp-block-image{border-radius:999px 999px 0 0!important}
.sk-gallery .wp-block-gallery figure{border-radius:0!important}
.sk-facts h3{font-family:"SK Vollkorn",Georgia,serif;font-weight:400;font-style:italic}
.sk-banner{text-align:center;border-bottom:1px solid color-mix(in srgb,var(--sk-primary) 35%,transparent)}
.sk-banner::after{display:none}
.sk-banner h1{font-weight:400;font-style:italic}
.sk-section h2.wp-block-heading{font-size:clamp(2.3rem,4.2vw,3.4rem)!important;font-weight:400}
.sk-cta h2{font-weight:400!important;font-style:italic}
.sk-footer .wp-block-site-title{font-family:"SK Vollkorn",Georgia,serif;font-style:italic;font-size:1.5rem}
.sk-footer::before{height:1px;background:color-mix(in srgb,var(--sk-primary) 60%,#fff)}
.sk-nav .wp-block-navigation-item__content{text-transform:uppercase;letter-spacing:.16em;font-size:max(12px,.78rem);font-weight:500!important}
.wp-block-navigation__responsive-container-open{border-radius:50%}
.is-menu-open .wp-block-navigation-item__content{font-family:"SK Vollkorn",Georgia,serif!important;font-style:italic;font-weight:400!important;letter-spacing:-.01em}
.sk-pagehero-text{margin-inline:auto;text-align:center}
.sk-breadcrumb{justify-content:center}
.sk-jump a{border-radius:0;border-width:1px;text-transform:uppercase;letter-spacing:.12em;font-size:max(12px,.78rem)}
.sk-qcard{text-align:center;justify-items:center;border-radius:0;border:0;box-shadow:0 30px 60px -38px rgba(0,0,0,.35)}
.sk-qcard__icon{border-radius:50%}
.sk-card-num{font-family:"SK Vollkorn",Georgia,serif;font-style:italic;font-weight:400}
.sk-service-row::before{font-family:"SK Vollkorn",Georgia,serif;font-style:italic;font-weight:400;-webkit-text-stroke-width:1px}
`,

  // Friendly: quirky headings, tilted cards, blob-shaped photos, bouncy buttons, dots.
  playful: `
${face('SK Platypi', 'platypi/Platypi-VariableFont_wght.woff2', '300 800')}
${H}{font-family:"SK Platypi",var(--wp--preset--font-family--manrope),sans-serif;font-weight:800;letter-spacing:-.02em}
.sk-hero h1{font-size:clamp(2.8rem,7vw,5.6rem)!important;transform:rotate(-2deg);transform-origin:left center}
.sk-hero .sk-eyebrow{border-radius:14px;background:var(--sk-primary);box-shadow:none;transform:rotate(-3deg)}
.sk-shape{display:block;position:absolute;opacity:.9}
.sk-shape-1{width:130px;height:130px;left:4%;top:12%;background:var(--sk-primary);border-radius:38% 62% 55% 45% / 45% 40% 60% 55%}
.sk-shape-2{width:76px;height:76px;right:6%;top:9%;border:11px solid #fff;border-radius:50%;opacity:.55}
.sk-shape-3{width:48px;height:48px;left:47%;bottom:11%;background:#fde047;border-radius:12px;rotate:20deg}
.sk-hero-collage>figure{border-width:8px}
.sk-hero-badge{border-radius:24px;background:var(--sk-primary);rotate:-6deg}
.sk-hero h1 .sk-word-last{--sk-ul:40%;--sk-ul-color:color-mix(in srgb,var(--sk-primary) 75%,transparent)}
.sk-eyebrow::before{width:.55em;height:.55em;border-radius:50%}
.wp-element-button{border-radius:18px!important;transition:transform .4s cubic-bezier(.34,1.56,.64,1),box-shadow .3s!important}
.wp-element-button:hover{transform:translateY(-3px) rotate(-2deg) scale(1.05)!important}
.sk-card{border:0;border-radius:32px!important;box-shadow:0 14px 0 -4px color-mix(in srgb,var(--sk-primary) 30%,transparent);transition:transform .45s cubic-bezier(.34,1.56,.64,1),box-shadow .3s}
.wp-block-column:nth-child(odd) .sk-card{transform:rotate(-1.4deg)}
.wp-block-column:nth-child(even) .sk-card{transform:rotate(1.4deg)}
.wp-block-column .sk-card:hover{transform:rotate(0) translateY(-8px) scale(1.02)}
.sk-card::before{display:none}
.sk-card h3::before{content:"";display:block;width:46px;height:46px;margin-bottom:.8em;border-radius:15px;background:var(--sk-primary);transform:rotate(-8deg)}
.wp-block-post-content .wp-block-image{border-radius:42% 58% 55% 45% / 45% 40% 60% 55%!important;transition:border-radius 1.4s ease}
.wp-block-post-content .wp-block-image:hover{border-radius:58% 42% 40% 60% / 60% 55% 45% 40%!important}
.sk-gallery .wp-block-gallery figure{border-radius:28px!important}
.sk-gallery .wp-block-gallery figure:nth-child(odd){transform:rotate(-1.5deg)}
.sk-gallery .wp-block-gallery figure:nth-child(even){transform:rotate(1.5deg)}
.sk-services,.sk-testimonials{background-image:radial-gradient(color-mix(in srgb,var(--sk-primary) 22%,transparent) 1.6px,transparent 1.8px);background-size:22px 22px}
.sk-facts h3{font-family:"SK Platypi",sans-serif}
.sk-banner::after{border-radius:42% 58% 63% 37% / 41% 44% 56% 59%;background:color-mix(in srgb,var(--sk-primary) 20%,transparent);animation:sk-blob 12s ease-in-out infinite alternate}
@keyframes sk-blob{to{border-radius:58% 42% 37% 63% / 59% 56% 44% 41%;transform:rotate(25deg)}}
.sk-footer::before{height:8px;border-radius:0 0 8px 8px;background:repeating-linear-gradient(90deg,var(--sk-primary) 0 40px,color-mix(in srgb,var(--sk-primary) 45%,#fff) 40px 80px)}
.wp-block-navigation__responsive-container-open{border-radius:18px;rotate:-4deg}
.is-menu-open .wp-block-navigation-item__content{font-family:"SK Platypi",sans-serif!important}
.is-menu-open .wp-block-navigation-item:nth-child(odd){rotate:-2deg}
.sk-jump a{border-radius:16px;border-width:2px}
.sk-jump a:nth-child(odd){rotate:-2deg}.sk-jump a:nth-child(even){rotate:2deg}
.sk-qcard{border:0;border-radius:28px;box-shadow:0 12px 0 -4px color-mix(in srgb,var(--sk-primary) 30%,transparent)}
.sk-qcard:nth-child(odd){rotate:-1.5deg}.sk-qcard:nth-child(even){rotate:1.5deg}
.sk-qcard__icon{border-radius:16px}
.sk-card-num{font-family:"SK Platypi",sans-serif}
.sk-service-row::before{font-family:"SK Platypi",sans-serif;rotate:-6deg}
@media (prefers-reduced-motion:reduce){.sk-banner::after{animation:none}.sk-hero h1,.sk-hero .sk-eyebrow{transform:none}.sk-shape{display:none}}
`,

  // Editorial: light large type, black-and-white photos, hairlines, no shadows.
  minimal: `
${face('SK Ysabeau', 'ysabeau-office/YsabeauOffice-VariableFont_wght.woff2', '100 900')}
${H}{font-family:"SK Ysabeau",var(--wp--preset--font-family--manrope),sans-serif;font-weight:300;letter-spacing:-.025em}
h3.wp-block-heading{font-weight:500}
.sk-hero h1{font-weight:300!important;font-size:clamp(3rem,7.6vw,6.2rem)!important;letter-spacing:-.05em}
.sk-hero::after{background:linear-gradient(90deg,rgba(0,0,0,.6),rgba(0,0,0,.05) 75%)}
.sk-hero .wp-block-cover__image-background{filter:grayscale(1) contrast(1.05)}
.sk-hero-glow{display:none}
.sk-hero-collage>figure{border-radius:0!important;border:1px solid rgba(255,255,255,.6);box-shadow:none!important}
.sk-hero-collage>figure:nth-of-type(1){rotate:0deg}.sk-hero-collage>figure:nth-of-type(2){rotate:0deg}
.sk-hero-badge{border-radius:0;background:rgba(10,10,10,.62);box-shadow:inset 0 0 0 1px rgba(255,255,255,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.sk-hero-badge strong{font-weight:300}
.sk-hero h1 .sk-word-last{--sk-ul:2px;--sk-ul-color:#fff}
.sk-hero .sk-eyebrow{background:none;box-shadow:none;-webkit-backdrop-filter:none;backdrop-filter:none;padding:0}
.sk-eyebrow{font-weight:500;letter-spacing:.22em}
.sk-eyebrow::before{width:3em;height:1px}
.wp-element-button{border-radius:0!important;box-shadow:none!important;padding:.85em 1.4em!important}
.wp-block-button.is-style-outline .wp-element-button{border-width:1px!important}
.sk-card{border:0;border-top:1px solid rgba(0,0,0,.85);border-radius:0!important;box-shadow:none!important;background:transparent!important;padding-inline:0!important}
.sk-card:hover{transform:none!important}
.sk-card::before{inset:-1px 0 auto;height:2px}
.wp-block-post-content .wp-block-image,.sk-map{border-radius:0!important;box-shadow:none!important}
.wp-block-post-content .wp-block-image img,.sk-gallery .wp-block-gallery img{filter:grayscale(1);transition:filter .8s ease,transform 1.2s var(--sk-ease)!important}
.wp-block-post-content .wp-block-image:hover img,.sk-gallery .wp-block-gallery figure:hover img{filter:none}
.sk-gallery .wp-block-gallery figure{border-radius:0!important}
.sk-facts{border-block:1px solid rgba(0,0,0,.12)}
.sk-facts h3{font-family:"SK Ysabeau",sans-serif;font-weight:300;color:inherit}
.sk-banner::after,.sk-cta::before,.sk-footer::before{display:none}
.sk-banner h1,.sk-cta h2{font-weight:300!important}
.sk-section h2.wp-block-heading{font-size:clamp(2.4rem,4.6vw,3.7rem)!important}
header.wp-block-template-part{box-shadow:0 1px 0 rgba(0,0,0,.08);background:rgba(255,255,255,.92)}
.sk-nav .wp-block-navigation-item__content{font-weight:400!important;border-radius:0}
.sk-nav .wp-block-navigation-item__content:hover{background:none}
.wp-block-navigation__responsive-container-open{border-radius:0;background:transparent;color:inherit;box-shadow:inset 0 0 0 1px currentColor}
.is-menu-open .wp-block-navigation-item__content{font-family:"SK Ysabeau",sans-serif!important;font-weight:300!important}
.sk-topbar{background:#fff;color:rgba(0,0,0,.6);border-bottom:1px solid rgba(0,0,0,.08)}
.sk-topbar a:hover{color:#000}
.sk-jump a{border-radius:0;border-width:1px;border-color:rgba(0,0,0,.25)}
.sk-qcard{border-radius:0;border:0;border-top:1px solid rgba(0,0,0,.85);background:transparent;box-shadow:none;padding-inline:0}
.sk-qcard:hover{transform:none;box-shadow:none}
.sk-qcard__icon{border-radius:0;background:transparent;box-shadow:inset 0 0 0 1px currentColor;color:inherit}
.sk-card-num{font-family:"SK Ysabeau",sans-serif;font-weight:300}
.sk-service-row::before{font-family:"SK Ysabeau",sans-serif;font-weight:200;-webkit-text-stroke:1px rgba(0,0,0,.14)}
`,

  // Dark and gold: hotels, jewellers, fine dining. Gold is mixed from the brand colour.
  luxe: `
${face('SK Literata', 'literata/Literata72pt-Light.woff2', '300')}
${face('SK Literata', 'literata/Literata72pt-LightItalic.woff2', '300', 'italic')}
${face('SK Literata', 'literata/Literata72pt-Regular.woff2', '400')}
:root{--wp--preset--color--base:#0e0d0b;--wp--preset--color--contrast:#e9e2d2;--sk-gold:color-mix(in srgb,var(--sk-primary) 45%,#d4b06a)}
body,.wp-site-blocks{background:#0e0d0b!important;color:#e9e2d2}
::selection{background:color-mix(in srgb,var(--sk-gold) 40%,transparent)}
${H}{font-family:"SK Literata",Georgia,serif;font-weight:300;letter-spacing:-.01em;color:#f3ecdc}
.sk-hero h1,.sk-banner h1{font-style:italic;font-weight:300!important}
.sk-hero .sk-eyebrow,.sk-hero .sk-eyebrow::before{background:none;box-shadow:none;padding:0}
.sk-eyebrow{color:var(--sk-gold)!important;letter-spacing:.32em;opacity:1}
.sk-eyebrow::before{width:2.4em;height:1px}
a{color:var(--sk-gold)}
header.wp-block-template-part{background:rgba(14,13,11,.86)!important;box-shadow:0 1px 0 rgba(212,176,106,.18)!important}
header.wp-block-template-part,.sk-nav .wp-block-navigation-item__content,.sk-header .wp-block-site-title a{color:#efe8d8!important}
.sk-nav .wp-block-navigation-item__content{text-transform:uppercase;letter-spacing:.18em;font-size:max(12px,.76rem)}
.sk-nav .wp-block-navigation-item__content:hover{background:rgba(212,176,106,.1)}
.sk-topbar{background:#000;color:rgba(239,232,216,.7)}
/* Logos are usually dark on transparent: give them a cream backing so they stay readable. */
.sk-brand .wp-block-site-logo{background:#f3ecdc;padding:6px 12px;border-radius:2px}
.wp-element-button{border-radius:0!important;background:var(--sk-gold)!important;color:#0e0d0b!important;text-transform:uppercase;letter-spacing:.2em;font-size:.76rem!important;padding:1.15em 2em!important;box-shadow:none!important}
.wp-block-button.is-style-outline .wp-element-button{background:transparent!important;color:#f3ecdc!important;box-shadow:inset 0 0 0 1px rgba(243,236,220,.55)!important}
.sk-section.has-background,.sk-banner:not(.sk-pagehero),.sk-card,.sk-qcard,.sk-jump-wrap{background-color:#16140f!important;color:#e9e2d2!important}
.sk-card,.sk-qcard{border:1px solid rgba(212,176,106,.22)!important;border-radius:2px!important;box-shadow:none!important}
.sk-card::before{background:var(--sk-gold);height:2px}
.sk-card:hover{box-shadow:0 30px 60px -30px rgba(0,0,0,.9)!important}
.sk-card h3,.sk-qcard strong{color:#f3ecdc}
.sk-facts h3,.sk-card-num,.sk-hero-badge strong{color:var(--sk-gold)!important;font-family:"SK Literata",Georgia,serif;font-weight:300}
.sk-facts{border-block:1px solid rgba(212,176,106,.18)}
.wp-block-post-content .wp-block-image,.sk-map{border-radius:0!important;box-shadow:0 0 0 1px rgba(212,176,106,.35),0 40px 70px -40px rgba(0,0,0,.9)!important}
.sk-hero-collage>figure{border-radius:0!important;border:1px solid rgba(212,176,106,.6)}
.sk-hero-badge{border-radius:0;background:rgba(14,13,11,.75);box-shadow:inset 0 0 0 1px rgba(212,176,106,.5)}
.sk-hero-glow{background:radial-gradient(closest-side,color-mix(in srgb,var(--sk-gold) 50%,transparent),transparent);opacity:.35}
.sk-jump a{border-radius:0;border-color:rgba(212,176,106,.4);color:#efe8d8}
.sk-service-row::before{font-family:"SK Literata",Georgia,serif;font-style:italic;font-weight:300;-webkit-text-stroke:1px rgba(212,176,106,.25)}
.sk-qcard__icon{border-radius:0;background:transparent;box-shadow:inset 0 0 0 1px var(--sk-gold);color:var(--sk-gold)}
.wp-block-post-content form input:not([type=hidden]):not([type=checkbox]),.wp-block-post-content form textarea{background:#0e0d0b;border-color:rgba(212,176,106,.3);color:#efe8d8}
.sk-footer{background:#080706!important}
.sk-footer::before{height:1px;background:var(--sk-gold)}
.sk-cta{background-color:#16140f!important;color:#efe8d8!important;border-block:1px solid rgba(212,176,106,.2)}
.sk-cta::before{background:radial-gradient(50% 120% at 50% 0%,color-mix(in srgb,var(--sk-gold) 22%,transparent),transparent 70%)}
`,

  // Earthy and soft: cafés, yoga, tea, farms. Paper texture, rounded panels, leaf shapes.
  organic: `
${face('SK Literata', 'literata/Literata72pt-Regular.woff2', '400')}
${face('SK Literata', 'literata/Literata72pt-Medium.woff2', '500')}
${face('SK Literata', 'literata/Literata72pt-RegularItalic.woff2', '400', 'italic')}
:root{--wp--preset--color--base:#f5efe4}
body,.wp-site-blocks{background-color:#f5efe4!important}
.wp-site-blocks{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.07'/%3E%3C/svg%3E")}
${H}{font-family:"SK Literata",Georgia,serif;font-weight:500;letter-spacing:-.015em}
.sk-hero h1{font-weight:500!important;letter-spacing:-.03em}
header.wp-block-template-part{background:color-mix(in srgb,#f5efe4 88%,transparent)!important}
.sk-section.has-background:not(.sk-cta):not(.sk-facts){border-radius:44px;margin-inline:clamp(8px,2.2vw,28px)!important}
.sk-cta{border-radius:44px 44px 0 0;margin-inline:clamp(8px,2.2vw,28px)!important}
.sk-card{border:0;border-radius:36px 36px 36px 10px!important;background:#fffaf1!important;box-shadow:0 22px 44px -30px rgba(70,50,20,.45)}
.sk-card::before{display:none}
.sk-card:hover{transform:translateY(-6px) rotate(-.6deg)}
.sk-eyebrow::before{width:.85em;height:.85em;border-radius:0 100% 0 100%;margin-right:.55em}
.wp-element-button{border-radius:999px!important;box-shadow:none!important}
.wp-block-post-content .wp-block-image{border-radius:120px 120px 24px 120px!important}
.sk-gallery .wp-block-gallery figure{border-radius:48px 48px 48px 12px!important}
.sk-hero-collage>figure{border-radius:140px 140px 24px 140px!important;border-color:#fffaf1}
.sk-hero-collage>figure:nth-of-type(2){border-radius:24px 140px 140px 140px!important}
.sk-hero-badge{border-radius:28px 28px 28px 6px;background:color-mix(in srgb,var(--sk-primary) 85%,#3b2a14)}
.sk-facts h3,.sk-card-num{font-family:"SK Literata",Georgia,serif;font-weight:500}
.sk-qcard{border:0;border-radius:32px 32px 32px 8px;background:#fffaf1;box-shadow:0 22px 44px -30px rgba(70,50,20,.45)}
.sk-qcard__icon{border-radius:50% 50% 50% 8px}
.sk-jump a{border-radius:999px;background:#fffaf1}
.sk-service-row::before{font-family:"SK Literata",Georgia,serif;font-style:italic}
.sk-footer{border-radius:44px 44px 0 0}
.sk-footer::before{display:none}
`,

  // Structured and trustworthy: colleges, hospitals, law firms, companies.
  corporate: `
${face('SK FiraC', 'fira-sans/FiraSans-Regular.woff2', '400')}
${face('SK FiraC', 'fira-sans/FiraSans-SemiBold.woff2', '600')}
${face('SK FiraC', 'fira-sans/FiraSans-Bold.woff2', '700')}
${H}{font-family:"SK FiraC",var(--wp--preset--font-family--manrope),sans-serif;font-weight:600;letter-spacing:-.015em}
.sk-hero h1,.sk-banner h1{font-weight:700!important;letter-spacing:-.025em}
header.wp-block-template-part{background:#fff!important;box-shadow:0 1px 0 #e3e7ee!important}
.sk-nav .wp-block-navigation-item__content{border-radius:6px}
.sk-eyebrow{letter-spacing:.1em;font-weight:600}
.sk-eyebrow::before{width:.5em;height:.5em;border-radius:1px;background:var(--sk-primary)}
.sk-hero .sk-eyebrow{border-radius:6px}
.wp-element-button{border-radius:6px!important;font-weight:600!important}
.sk-hero .wp-block-button:first-child .wp-element-button::after,.sk-cta .wp-block-button:first-child .wp-element-button::after{content:"→"}
.sk-card{border:1px solid #e3e7ee;border-radius:10px!important;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.sk-card::before{transform:none;height:3px}
.sk-card:hover{transform:translateY(-3px);box-shadow:0 18px 36px -20px rgba(16,24,40,.3)}
.wp-block-post-content .wp-block-image,.sk-map{border-radius:10px!important;box-shadow:0 18px 40px -24px rgba(16,24,40,.35)!important}
.sk-gallery .wp-block-gallery figure{border-radius:8px!important}
.sk-hero-collage>figure{border-radius:10px!important;border:0;box-shadow:0 30px 60px -30px rgba(0,0,0,.6)!important}
.sk-hero-collage>figure:nth-of-type(1){rotate:0deg;width:64%}
.sk-hero-collage>figure:nth-of-type(2){rotate:0deg;width:46%}
.sk-hero-badge{border-radius:10px;background:#fff;color:#101828;box-shadow:0 20px 40px -20px rgba(0,0,0,.5);-webkit-backdrop-filter:none;backdrop-filter:none}
.sk-hero-badge strong{color:var(--sk-primary)}
.sk-hero-badge span{opacity:.7}
.sk-facts .wp-block-column+.wp-block-column{border-left:1px solid #e3e7ee}
.sk-facts h3,.sk-card-num{font-family:"SK FiraC",sans-serif;font-weight:700}
.sk-jump a,.sk-qcard,.sk-qcard__icon{border-radius:8px!important}
.sk-qcard{box-shadow:0 1px 2px rgba(16,24,40,.05)}
.sk-service-row::before{font-family:"SK FiraC",sans-serif;font-weight:700}
@media (max-width:781px){.sk-facts .wp-block-column+.wp-block-column{border-left:0;border-top:1px solid #e3e7ee;padding-top:20px}}
`,
};

module.exports = { header, footer, customCss, isWordmark, DESIGN_STYLES: Object.keys(STYLES) };
