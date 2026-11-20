// CSS for the newer section types (testimonial slider, team, opening hours, FAQ,
// before/after), the hero layouts and dark mode. Added after the design style's CSS by
// theme.customCss(), so hero layouts win over a style's default hero.

const SECTIONS = `
/* ---- Testimonial slider ---- */
.sk-tslider{max-width:1140px;margin-inline:auto;position:relative}
.sk-tslider__track{position:relative;display:grid;grid-auto-flow:column;grid-auto-columns:min(100%,520px);gap:24px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;padding:8px 4px 24px;overscroll-behavior-x:contain}
.sk-tslider__track::-webkit-scrollbar{display:none}
.sk-tslider__track:focus-visible{outline:2px solid var(--sk-primary);outline-offset:4px;border-radius:12px}
.sk-tslider.is-single .sk-tslider__track{grid-auto-columns:min(100%,700px);justify-content:center}
.sk-tslide{scroll-snap-align:start;margin:0;background:#fff;color:#141414;border-radius:24px;padding:34px 32px 28px;display:flex;flex-direction:column;gap:18px;box-shadow:0 24px 48px -32px rgba(0,0,0,.4);border:1px solid rgba(0,0,0,.05)}
.sk-tslide blockquote{margin:0;padding:0;border:0;font-size:clamp(1.08rem,1.5vw,1.25rem)!important;line-height:1.6;font-style:normal}
.sk-tslide figcaption strong{font-size:1rem!important}
.sk-tslide__mark{display:block;height:.42em;font:700 4.6rem/1 Georgia,serif;color:var(--sk-primary)}
.sk-tslide figcaption{display:flex;align-items:center;gap:12px;margin-top:auto;font-size:.98rem}
.sk-avatar{flex:none;display:inline-grid;place-items:center;width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,var(--sk-primary),color-mix(in srgb,var(--sk-primary) 55%,#000));color:#fff;font-weight:700;font-size:.95rem;letter-spacing:.02em}
.sk-avatar--lg{width:104px;height:104px;font-size:2rem;box-shadow:0 0 0 6px color-mix(in srgb,var(--sk-primary) 16%,transparent)}
.sk-tslider__nav{display:flex;justify-content:center;align-items:center;gap:12px;margin-top:4px}
.sk-tslider__nav>button{width:48px;height:48px;border-radius:50%;border:1px solid color-mix(in srgb,currentColor 35%,transparent);background:transparent;color:inherit;cursor:pointer;display:grid;place-items:center;font-size:1.15rem;transition:background .2s,color .2s,border-color .2s}
.sk-tslider__nav>button:hover{background:var(--sk-primary);border-color:var(--sk-primary);color:#fff}
.sk-tslider__dots{display:flex}
.sk-tslider__dots button{width:24px;height:24px;padding:0;border:0;background:none;cursor:pointer;display:grid;place-items:center;color:inherit}
.sk-tslider__dots button::before{content:"";width:8px;height:8px;border-radius:99px;background:currentColor;opacity:.3;transition:width .3s,opacity .3s}
.sk-tslider__dots button[aria-current=true]::before{width:22px;opacity:1;background:var(--sk-primary)}

/* ---- Team ---- */
.sk-team{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:24px;max-width:1140px;margin-inline:auto}
.sk-member{text-align:center;padding:36px 20px 30px;border-radius:24px;background:color-mix(in srgb,var(--sk-primary) 7%,transparent);border:1px solid color-mix(in srgb,var(--sk-primary) 12%,transparent);transition:translate .35s var(--sk-ease),box-shadow .35s}
.sk-member:hover{translate:0 -6px;box-shadow:0 24px 40px -28px rgba(0,0,0,.4)}
.sk-member h3{margin:18px 0 4px;font-size:1.3rem!important;font-weight:700!important;line-height:1.25}
.sk-member p{margin:0;opacity:.72}

/* ---- Opening hours + Visit us ---- */
.sk-hours{background:#fff;color:#141414;border-radius:24px;padding:28px 26px 18px;box-shadow:0 24px 48px -32px rgba(0,0,0,.4);border:1px solid rgba(0,0,0,.06)}
.sk-hours h3{margin:0 0 10px 12px;font-size:1.35rem!important;font-weight:700!important;line-height:1.25}
.sk-hours li{font-size:1.02rem}
.sk-hours ul{list-style:none;margin:0;padding:0}
.sk-hours li{display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px 16px;padding:11px 12px;border-radius:12px;border-bottom:1px dashed rgba(0,0,0,.12)}
.sk-hours li:last-child{border-bottom:0}
.sk-hours li span:last-child{font-variant-numeric:tabular-nums}
.sk-hours li.is-today{background:color-mix(in srgb,var(--sk-primary) 12%,#fff);font-weight:700;border-bottom-color:transparent}
.sk-hours li.is-today span:first-child::after{content:"Today";margin-left:8px;padding:2px 8px;border-radius:99px;background:var(--sk-primary);color:#fff;font-size:max(11px,.68rem);letter-spacing:.1em;text-transform:uppercase;vertical-align:2px}
.sk-visit{display:grid;grid-template-columns:1.1fr 1fr;gap:clamp(28px,5vw,80px);align-items:center;max-width:1140px;margin-inline:auto}
.sk-visit h2{font-size:clamp(1.9rem,3.6vw,3rem);line-height:1.08;letter-spacing:-.02em;margin:.25em 0 .45em}
.sk-visit p{margin:.3em 0}
@media (max-width:781px){.sk-visit{grid-template-columns:1fr}}

/* ---- FAQ ---- */
.sk-faq{max-width:840px;margin-inline:auto;display:grid;gap:12px}
.sk-faq details{border-radius:18px;background:color-mix(in srgb,var(--sk-primary) 6%,transparent);border:1px solid color-mix(in srgb,var(--sk-primary) 15%,transparent);transition:background .3s}
.sk-faq details[open]{background:color-mix(in srgb,var(--sk-primary) 10%,transparent)}
.sk-faq summary{cursor:pointer;list-style:none;position:relative;padding:20px 64px 20px 24px;font-weight:650!important;font-size:1.1rem!important;line-height:1.4}
.sk-faq summary::-webkit-details-marker{display:none}
.sk-faq summary::after{content:"+";position:absolute;right:20px;top:50%;translate:0 -50%;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:var(--sk-primary);color:#fff;font-size:1.3rem;font-weight:400;transition:rotate .3s var(--sk-ease)}
.sk-faq details[open] summary::after{rotate:45deg}
.sk-faq summary:focus-visible{outline:2px solid var(--sk-primary);outline-offset:2px;border-radius:18px}
.sk-faq__a{padding:0 24px 20px}
.sk-faq__a p{margin:0;opacity:.85;line-height:1.65;font-size:1.02rem}
@supports (interpolate-size:allow-keywords){:root{interpolate-size:allow-keywords}.sk-faq details::details-content{block-size:0;overflow:hidden;transition:block-size .35s var(--sk-ease),content-visibility .35s allow-discrete}.sk-faq details[open]::details-content{block-size:auto}}

/* ---- Before / after ---- */
.sk-ba{display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:1040px;margin-inline:auto}
.sk-ba figure{margin:0;position:relative;border-radius:22px;overflow:hidden}
.sk-ba img{display:block;width:100%;height:100%;aspect-ratio:3/2;object-fit:cover}
.sk-ba figcaption{position:absolute;top:14px;left:14px;padding:5px 11px;border-radius:99px;background:rgba(0,0,0,.66);color:#fff;font-size:max(12px,.74rem);font-weight:700;letter-spacing:.12em;text-transform:uppercase}
.sk-ba.is-live{display:block;position:relative;aspect-ratio:3/2;border-radius:22px;overflow:hidden;--pos:50%;user-select:none;box-shadow:0 40px 70px -40px rgba(0,0,0,.55)}
.sk-ba.is-live figure{position:absolute;inset:0;border-radius:0}
.sk-ba.is-live .sk-ba__after{clip-path:inset(0 0 0 var(--pos))}
.sk-ba.is-live .sk-ba__after figcaption{left:auto;right:14px}
.sk-ba__handle{position:absolute;top:0;bottom:0;left:var(--pos);z-index:3;width:3px;translate:-50% 0;background:#fff;pointer-events:none;box-shadow:0 0 12px rgba(0,0,0,.35)}
.sk-ba__handle::after{content:"⟷";position:absolute;top:50%;left:50%;translate:-50% -50%;width:50px;height:50px;border-radius:50%;display:grid;place-items:center;background:#fff;color:#111;font-size:1.25rem;box-shadow:0 8px 24px rgba(0,0,0,.35)}
.sk-ba__range{position:absolute;inset:0;z-index:4;width:100%;height:100%;margin:0;opacity:0;cursor:ew-resize}
.sk-ba__range:focus-visible+.sk-ba__handle::after{outline:3px solid var(--sk-primary);outline-offset:3px}
@media (max-width:600px){.sk-ba:not(.is-live){grid-template-columns:1fr}}
`;

const HERO_LAYOUTS = `
/* ---- Hero layouts (chosen per client; "auto" leaves the style's own hero) ---- */
.sk-hero--centered .sk-hero-text{max-width:920px;margin-inline:auto!important;text-align:center}
.sk-hero--centered .sk-hero-text>p{margin-inline:auto;max-width:44em}
.sk-hero--centered .wp-block-buttons{justify-content:center}
.sk-hero--centered .sk-shape-3{display:none}
.sk-hero--centered h1{font-size:clamp(2.8rem,7.2vw,5.8rem)!important}
.sk-hero--centered::after{background:radial-gradient(90% 75% at 50% 50%,rgba(0,0,0,.4),rgba(0,0,0,.66))!important}
.sk-hero--editorial{align-items:flex-end!important;padding-bottom:clamp(56px,9vh,110px)!important}
.sk-hero--editorial .sk-hero-text{max-width:1180px}
.sk-hero--editorial h1{font-size:clamp(3.2rem,10.5vw,9rem)!important;line-height:.9!important;letter-spacing:-.05em}
.sk-hero--editorial .sk-hero-text>p:not(.sk-eyebrow){max-width:40em}
.sk-hero--editorial::after{background:linear-gradient(0deg,rgba(0,0,0,.82),rgba(0,0,0,.25) 55%,rgba(0,0,0,.05))!important}
.sk-hero--editorial .sk-scroll-cue,.sk-hero--editorial .sk-hero-marquee{display:none!important}
.sk-hero--split .sk-hero-visual{display:block!important}
.sk-hero--split .sk-hero-grid>.sk-hero-text{flex-basis:0!important;flex-grow:1!important;text-align:left;margin:0!important}
.sk-hero--split .sk-hero-text>p{margin-inline:0}
.sk-hero--split .wp-block-buttons{justify-content:flex-start}
.sk-hero--split::after{background:radial-gradient(70% 90% at 0% 0%,color-mix(in srgb,var(--sk-primary) 38%,transparent),transparent 70%)!important}
.sk-hero-photo{position:relative}
.sk-hero-photo>figure{margin:0!important;border-radius:30px;overflow:hidden;aspect-ratio:4/5;max-height:640px;margin-inline:auto 0!important;box-shadow:0 50px 90px -40px rgba(0,0,0,.85),inset 0 0 0 1px rgba(255,255,255,.2)}
.sk-hero-photo>figure img{width:100%;height:100%!important;object-fit:cover;border-radius:0!important}
.sk-hero-photo .sk-hero-badge{left:-22px;top:auto;bottom:36px}
@media (max-width:781px){.sk-hero-photo>figure{aspect-ratio:4/3}.sk-hero-photo .sk-hero-badge{left:12px;bottom:12px}}
`;

// Dark mode: a moon/sun button in the header (added by the SiteKit Motion plugin), saved
// per visitor. Brand colours stay; backgrounds and text swap.
const DARK = `
/* ---- Dark mode ---- */
.sk-darktoggle{flex:none;width:42px;height:42px;padding:0;border-radius:50%;border:1px solid color-mix(in srgb,currentColor 22%,transparent);background:transparent;color:inherit;cursor:pointer;display:grid;place-items:center;transition:background .2s,rotate .5s var(--sk-ease)}
.sk-darktoggle:hover{background:color-mix(in srgb,var(--sk-primary) 14%,transparent)}
.sk-darktoggle svg{width:19px;height:19px}
.sk-darktoggle .sk-sun,html.sk-dark .sk-darktoggle .sk-moon{display:none}
html.sk-dark .sk-darktoggle .sk-sun{display:block}
html.sk-dark .sk-darktoggle{rotate:180deg}
html.sk-dark{color-scheme:dark;--wp--preset--color--base:#111215;--wp--preset--color--contrast:#e9e7e3;--sk-dark-card:#1b1d22;--sk-dark-band:color-mix(in srgb,var(--sk-primary) 9%,#15161a)}
html.sk-dark body{background:#111215;color:#e9e7e3}
html.sk-dark header.wp-block-template-part{background:rgba(17,18,21,.94);box-shadow:0 1px 0 rgba(255,255,255,.07)}
html.sk-dark .sk-header,html.sk-dark .sk-header a:not(.wp-element-button),html.sk-dark .wp-block-navigation{color:#e9e7e3!important}
html.sk-dark .wp-block-navigation__responsive-container.is-menu-open{background:#111215!important;color:#e9e7e3!important}
html.sk-dark .sk-brand .wp-block-site-logo img{background:#f4efe6;border-radius:12px;padding:4px 8px}
html.sk-dark .sk-section.has-background:not(.sk-cta),html.sk-dark .sk-banner.has-background{background-color:var(--sk-dark-band)!important;color:#e9e7e3!important}
html.sk-dark .sk-section.has-background:not(.sk-cta) :is(h1,h2,h3,h4,p){color:inherit}
html.sk-dark :is(.sk-card,.sk-tslide,.sk-hours,.sk-qcard){background:var(--sk-dark-card)!important;color:#e9e7e3!important;border-color:rgba(255,255,255,.08)!important}
html.sk-dark .sk-card :is(h2,h3,p,a){color:inherit}
html.sk-dark .sk-hours li{border-bottom-color:rgba(255,255,255,.1)}
html.sk-dark .sk-hours li.is-today{background:color-mix(in srgb,var(--sk-primary) 28%,#1b1d22)}
html.sk-dark :is(.sk-faq details,.sk-member){background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.09)}
html.sk-dark .sk-facts{background:#15161a!important;color:#e9e7e3!important}
html.sk-dark .sk-facts .wp-block-column+.wp-block-column{border-color:rgba(255,255,255,.1)!important}
html.sk-dark .sk-jump a{background:var(--sk-dark-card)!important;color:#e9e7e3!important;border-color:rgba(255,255,255,.1)!important}
html.sk-dark .sk-map{filter:invert(.9) hue-rotate(180deg) saturate(.7)}
html.sk-dark :is(input,textarea,select),html.sk-dark .sk-contact :is(input,textarea){background:#1b1d22!important;color:#e9e7e3;border-color:rgba(255,255,255,.18)}
html.sk-dark .wp-block-button.is-style-outline .wp-element-button{color:#e9e7e3}
html.sk-dark .sk-topbar{background:#0b0c0e}
`;

module.exports = { SECTIONS, HERO_LAYOUTS, DARK };
