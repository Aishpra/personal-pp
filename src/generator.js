// Builds draft page content from a project's intake, following the wireframes in the
// planning PDF (homepage blocks 1-8, About / Services / Contact inner pages).
//
// Copy comes from the AI draft (src/copywriter.js) when one exists. Without it, anything
// in [square brackets] is a placeholder you must rewrite before the client sees it. The point is to get a correct, good-looking
// structure with the client's real name, logo, photos, services and contact details on
// staging fast.
//
// Class names starting with "sk-" are styled by the CSS in src/theme.js (animations,
// card hover, eyebrow labels). The pages still look right without that CSS.
const b = require('./blocks');
const icons = require('./icons');
const { readableOn, isDark } = require('./colour');

const RADIUS = 16;

// Internal links are built from the site's address, because on the multisite each client
// lives under /<slug>/ and a root link like "/contact/" would leave their site. Set for the
// duration of generateSite (which is synchronous).
let siteBase = '';
const pageUrl = (slug) => `${siteBase}/${slug}/`;
const CARD_BG = '#ffffff';
const CARD_TEXT = '#111111';

function telHref(phone) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

function waHref(number) {
  return `https://wa.me/${number.replace(/[^\d]/g, '')}`;
}

// assets: { logo: {id?, url, alt}, media: [{id?, url, alt}, ...] }
function pickImages(assets) {
  const media = assets.media || [];
  return {
    hero: media[0] || null,
    about: media[1] || media[0] || null,
    services: media.slice(2).length ? media.slice(2) : media,
    gallery: media.slice(0, 6),
  };
}

// Colours derived from the client's palette, with readable text for each background.
function palette(intake) {
  const { primary, secondary, accent } = intake.colours;
  return {
    primary,
    onPrimary: readableOn(primary),
    // The hero overlay must be dark enough for white text over any photo.
    overlay: isDark(secondary) ? secondary : '#111111',
    accent,
    onAccent: readableOn(accent),
  };
}

const eyebrow = (text, opts = {}) => b.paragraph(text, { className: 'sk-eyebrow', ...opts });

// onBrand: buttons sit on a brand-coloured background, where a filled brand-coloured
// button would be invisible, so both are drawn as outlines.
// Where the main button goes: the Contact page if the site has one; otherwise (a
// one-page site) straight to the phone, WhatsApp or email, so it never hits a missing page.
function ctaHref(intake, base = siteBase) {
  if (intake.pages.includes('contact')) return `${String(base).replace(/\/+$/, '')}/contact/`;
  if (intake.phone) return telHref(intake.phone);
  if (intake.whatsapp) return waHref(intake.whatsapp);
  return `mailto:${intake.email}`;
}

function contactButtons(intake, { onBrand = false, justify } = {}) {
  const primary = ctaHref(intake);
  const items = [b.button(intake.ctaLabel || 'Get a quote', primary, onBrand)];
  // A second button for the other quick way to reach them, unless the first one already is it.
  if (intake.phone && primary !== telHref(intake.phone)) items.push(b.button('Call us', telHref(intake.phone), true));
  else if (intake.whatsapp && primary !== waHref(intake.whatsapp)) items.push(b.button('WhatsApp us', waHref(intake.whatsapp), true));
  return b.buttons(items, { justify });
}

// Top of each inner page ("Page title banner" in the PDF). With a photo it is a smaller
// version of the homepage hero (photo, overlay, glow, breadcrumbs); without one, a band in
// the brand's light colour.
function pageBanner(intake, title, subtitle, photo = null, crumb = title) {
  const c = palette(intake);
  const crumbs = b.paragraphHtml(
    `<a href="${b.esc(`${siteBase}/`)}">Home</a><span class="sk-breadcrumb__sep" aria-hidden="true">/</span><span aria-current="page">${b.esc(crumb)}</span>`,
    { className: 'sk-breadcrumb' }
  );
  const text = [crumbs, b.heading(title, 1, { fontSize: 'xx-large' }), subtitle ? b.paragraph(subtitle, { fontSize: 'large' }) : ''];
  if (!photo) {
    return b.group(text, { align: 'full', className: 'sk-banner', background: c.accent, text: c.onAccent, padding: [70, 50] });
  }
  return b.cover(
    [
      b.html('<div class="sk-hero-decor" aria-hidden="true"><span class="sk-hero-glow"></span><span class="sk-shape sk-shape-1"></span><span class="sk-shape sk-shape-2"></span></div>'),
      b.group(text, { layout: 'flow', className: 'sk-pagehero-text' }),
    ],
    { img: photo, overlay: c.overlay, dim: 75, minHeight: 460, className: 'sk-banner sk-pagehero' }
  );
}

// Facts strip (homepage and About): only facts the client actually gave us.
function factsStrip(intake) {
  const facts = [];
  if (intake.yearsInBusiness) facts.push([`${intake.yearsInBusiness}+`, 'years in business']);
  if (intake.services.length) facts.push([String(intake.services.length), intake.services.length === 1 ? 'core service' : 'core services']);
  if (intake.serviceArea) facts.push([intake.serviceArea, 'service area']);
  else if (intake.location) facts.push([intake.location, 'based in']);
  if (facts.length < 2) return '';
  return section(
    b.columns(facts.map(([big, small]) => b.column([b.heading(big, 3, { textAlign: 'center', fontSize: 'x-large' }), b.paragraph(small, { textAlign: 'center', className: 'sk-eyebrow' })])), { align: 'wide' }),
    { className: 'sk-facts', padding: [50, 50] }
  );
}

// Testimonials: only real ones from the intake, never invented. Two or more become a
// slider (scroll-snap, so it works without JavaScript; motion.js adds arrows and dots).
const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
function testimonialsSection(intake) {
  if (!intake.testimonials.length) return '';
  const c = palette(intake);
  const slides = intake.testimonials
    .map(
      (t) => `<figure class="sk-tslide"><span class="sk-tslide__mark" aria-hidden="true">“</span><blockquote>${b.esc(t.quote)}</blockquote>${
        t.author ? `<figcaption><span class="sk-avatar" aria-hidden="true">${b.esc(initials(t.author))}</span><strong>${b.esc(t.author)}</strong></figcaption>` : ''
      }</figure>`
    )
    .join('');
  return section(
    [
      eyebrow('Testimonials', { textAlign: 'center' }),
      b.heading('What customers say', 2, { textAlign: 'center' }),
      b.spacer(24),
      b.html(`<div class="sk-tslider${intake.testimonials.length > 1 ? '' : ' is-single'}" data-sk-slider><div class="sk-tslider__track" tabindex="0" aria-label="Customer testimonials">${slides}</div></div>`),
    ],
    { className: 'sk-testimonials', background: c.accent, text: c.onAccent }
  );
}

// Team grid (About page): names and roles the client gave, with initials as avatars.
function teamSection(intake) {
  if (!intake.team?.length) return '';
  return section(
    [
      eyebrow('The people', { textAlign: 'center' }),
      b.heading(`Meet the team`, 2, { textAlign: 'center' }),
      b.spacer(24),
      b.html(`<div class="sk-team">${intake.team.map((m) => `<article class="sk-member"><span class="sk-avatar sk-avatar--lg" aria-hidden="true">${b.esc(initials(m.name))}</span><h3>${b.esc(m.name)}</h3>${m.role ? `<p>${b.esc(m.role)}</p>` : ''}</article>`).join('')}</div>`),
    ],
    { className: 'sk-team-wrap' }
  );
}

// Opening hours card; motion.js highlights today's line.
function hoursCard(intake, title = 'Opening hours') {
  if (!intake.hours?.length) return '';
  return `<div class="sk-hours"><h3>${b.esc(title)}</h3><ul>${intake.hours.map((h) => `<li data-days="${b.esc(h.days)}"><span>${b.esc(h.days)}</span><span>${b.esc(h.time)}</span></li>`).join('')}</ul></div>`;
}

// Homepage "Visit us" band: opening hours beside the address and the main button.
function visitSection(intake) {
  if (!intake.hours?.length) return '';
  const where = intake.address || intake.location;
  return section(
    b.html(`<div class="sk-visit"><div class="sk-visit__text"><p class="sk-eyebrow">Visit us</p><h2>Come and see us${intake.location ? ` in ${b.esc(intake.location)}` : ''}</h2>${where ? `<p>${b.esc(where)}</p>` : ''}${
      intake.phone ? `<p><a href="${b.esc(telHref(intake.phone))}">${b.esc(intake.phone)}</a></p>` : ''
    }</div>${hoursCard(intake)}</div>`),
    { className: 'sk-visit-wrap' }
  );
}

// FAQ accordion: the client's own questions and answers (native <details>, no script needed).
function faqSection(intake) {
  if (!intake.faq?.length) return '';
  return section(
    [
      eyebrow('Questions', { textAlign: 'center' }),
      b.heading('Frequently asked questions', 2, { textAlign: 'center' }),
      b.spacer(16),
      b.html(`<div class="sk-faq">${intake.faq.map((f, i) => `<details${i === 0 ? ' open' : ''}><summary>${b.esc(f.q)}</summary><div class="sk-faq__a"><p>${b.esc(f.a)}</p></div></details>`).join('')}</div>`),
    ],
    { className: 'sk-faq-wrap' }
  );
}

// Before / after: two photos on top of each other with a drag handle (added by motion.js;
// without it the two photos simply sit side by side).
function beforeAfterSection(assets) {
  const [before, after] = assets.pair || [];
  if (!before || !after) return '';
  const fig = (img, label, cls) => `<figure class="sk-ba__${cls}"><img src="${b.esc(img.url)}" alt="${b.esc(img.alt || label)}" loading="lazy"><figcaption>${label}</figcaption></figure>`;
  return section(
    [
      eyebrow('Before & after', { textAlign: 'center' }),
      b.heading('See the difference', 2, { textAlign: 'center' }),
      b.spacer(16),
      b.html(`<div class="sk-ba" data-sk-ba>${fig(before, 'Before', 'before')}${fig(after, 'After', 'after')}</div>`),
    ],
    { className: 'sk-ba-wrap' }
  );
}

function section(inner, opts = {}) {
  return b.group(inner, { align: 'full', padding: [70, 50], ...opts, className: ['sk-section', 'sk-reveal', opts.className].filter(Boolean).join(' ') });
}

function card(inner) {
  return b.group(inner, { layout: 'flow', className: 'sk-card', background: CARD_BG, text: CARD_TEXT, radius: RADIUS, padding: [50, 40] });
}

function ctaBand(intake, heading, sub) {
  const c = palette(intake);
  return section(
    [b.heading(heading, 2, { textAlign: 'center' }), sub ? b.paragraph(sub, { textAlign: 'center', fontSize: 'large' }) : '', contactButtons(intake, { onBrand: true, justify: 'center' })],
    { className: 'sk-cta', background: c.primary, text: c.onPrimary }
  );
}

// AI copy for the service at index i, if any.
function serviceCopy(copy, i) {
  return copy?.services?.items?.[i] || null;
}

function serviceList(intake) {
  return intake.services.length ? intake.services : [1, 2, 3].map((n) => ({ name: `[Service ${n}]`, description: '' }));
}

function home(intake, assets, copy) {
  const img = pickImages(assets);
  const c = palette(intake);
  const name = intake.businessName;
  const out = [];

  // 2. Hero: full-width photo with the brand's dark colour as overlay. Text on the left and,
  // when there are enough photos, a floating collage with a badge on the right. Decorative
  // layers (glow, shapes, the name in giant outline letters) sit behind; each design style
  // in theme.js decides which of them to show.
  const heroText = [
    intake.location ? eyebrow(intake.location) : '',
    b.heading(name, 1, { fontSize: 'xx-large' }),
    intake.tagline ? b.paragraph(intake.tagline, { fontSize: 'x-large' }) : '',
    b.paragraph(copy?.home?.heroLead || intake.description || `[Draft: value proposition. What ${name} does, for whom, and why choose it.]`),
    contactButtons(intake),
  ];
  // Layout: the client's choice, or "auto" (the design style decides; see theme.js).
  const layout = intake.heroLayout && intake.heroLayout !== 'auto' ? intake.heroLayout : 'auto';
  const collagePhotos = ['auto', 'collage'].includes(layout) ? (assets.media || []).slice(1, 3) : [];
  const badge = intake.yearsInBusiness
    ? [`${intake.yearsInBusiness}+`, 'years in business']
    : intake.services.length
      ? [String(intake.services.length), intake.services.length === 1 ? 'core service' : 'core services']
      : null;
  const collage =
    collagePhotos.length === 2
      ? b.group(
          [
            ...collagePhotos.map((p) => b.image(p)),
            badge ? b.html(`<div class="sk-hero-badge"><strong>${b.esc(badge[0])}</strong><span>${b.esc(badge[1])}</span></div>`) : '',
          ],
          { layout: 'flow', className: 'sk-hero-collage' }
        )
      : '';
  const marquee = Array(6).fill(b.esc(name)).join(' <i>✦</i> ');
  out.push(
    b.cover(
      [
        b.html(
          `<div class="sk-hero-decor" aria-hidden="true"><span class="sk-hero-glow"></span><span class="sk-hero-ring"></span><span class="sk-shape sk-shape-1"></span><span class="sk-shape sk-shape-2"></span><span class="sk-shape sk-shape-3"></span><div class="sk-hero-marquee"><span>${marquee} <i>✦</i> </span><span>${marquee} <i>✦</i> </span></div></div>`
        ),
        layout === 'split' && img.hero
          ? b.columns([b.column(heroText, { className: 'sk-hero-text' }), b.column([b.image(img.hero), badge ? b.html(`<div class="sk-hero-badge"><strong>${b.esc(badge[0])}</strong><span>${b.esc(badge[1])}</span></div>`) : ''], { className: 'sk-hero-visual sk-hero-photo' })], { align: 'wide', valign: 'center', className: 'sk-hero-grid' })
          : collage
            ? b.columns([b.column(heroText, { className: 'sk-hero-text' }), b.column([collage], { className: 'sk-hero-visual' })], { align: 'wide', valign: 'center', className: 'sk-hero-grid' })
            : b.group(heroText, { layout: 'flow', className: 'sk-hero-text' }),
        b.html('<a class="sk-scroll-cue" href="#" aria-label="Scroll down"><span></span></a>'),
      ],
      // Split: solid brand panel with the photo framed beside the text.
      layout === 'split'
        ? { img: null, overlay: c.overlay, dim: 100, minHeight: 720, className: 'sk-hero sk-hero--split' }
        : { img: img.hero, overlay: c.overlay, dim: img.hero ? 70 : 100, minHeight: 720, className: `sk-hero${layout === 'auto' ? '' : ` sk-hero--${layout}`}` }
    )
  );

  // Quick facts strip: only facts the client actually gave us.
  out.push(factsStrip(intake));

  // 3. Services as cards on the light brand colour.
  if (intake.pages.includes('services') || intake.services.length) {
    out.push(
      section(
        [
          eyebrow('What we do', { textAlign: 'center' }),
          b.heading('Services', 2, { textAlign: 'center' }),
          intake.targetCustomer ? b.paragraph(`For ${intake.targetCustomer}.`, { textAlign: 'center' }) : '',
          b.spacer(24),
          b.columns(
            serviceList(intake)
              .slice(0, 3)
              .map((s, i) =>
                b.column(
                  card([
                    b.heading(s.name, 3),
                    b.paragraph(serviceCopy(copy, i)?.summary || s.description || `[Draft: one or two sentences on ${s.name} and who it is for.]`),
                    intake.pages.includes('services') ? b.paragraphHtml(`<a href="${b.esc(pageUrl('services'))}">Learn more →</a>`) : '',
                  ])
                )
              ),
            { align: 'wide' }
          ),
        ],
        { className: 'sk-services', background: c.accent, text: c.onAccent }
      )
    );
  }

  // 4. About
  if (intake.pages.includes('about')) {
    const aboutText = copy?.home?.aboutTeaser || (intake.yearsInBusiness
      ? `[Draft: short story of ${name}. ${intake.yearsInBusiness} years in business${intake.location ? ` in ${intake.location}` : ''}. Who runs it and why customers trust it.]`
      : `[Draft: short story of ${name}. Who runs it and why customers trust it.]`);
    out.push(
      section(
        b.columns(
          [
            img.about ? b.column(b.image(img.about, { radius: RADIUS }), { valign: 'center' }) : '',
            b.column([eyebrow('About us'), b.heading(`Meet ${name}`), b.paragraph(aboutText), b.buttons(b.button('Our story', pageUrl('about'), true))], { valign: 'center' }),
          ],
          { valign: 'center', align: 'wide' }
        )
      )
    );
  }

  // 5. Media strip
  if (img.gallery.length >= 2) {
    out.push(section([eyebrow('Gallery', { textAlign: 'center' }), b.gallery(img.gallery, { columns: Math.min(3, img.gallery.length), align: 'wide' })], { className: 'sk-gallery', padding: [50, 50] }));
  }

  out.push(beforeAfterSection(assets));

  // 6. Social proof: only real testimonials, never invented ones.
  out.push(testimonialsSection(intake));

  // Opening hours, and FAQ when there is no Contact page to hold it.
  out.push(visitSection(intake));
  if (!intake.pages.includes('contact')) out.push(faqSection(intake));

  // 7. CTA band
  out.push(ctaBand(intake, `Ready to work with ${name}?`, copy?.home?.ctaLine || (intake.serviceArea ? `Serving ${intake.serviceArea}.` : 'Get in touch today.')));

  // 8. Footer: written into the theme's footer template part (see theme.js).
  return out.join('\n\n');
}

function about(intake, assets, copy) {
  const img = pickImages(assets);
  const media = assets.media || [];
  const name = intake.businessName;
  const values = [
    ['Mission', copy?.about?.mission || '[Draft: one sentence on what the business exists to do.]'],
    ['Values', copy?.about?.values || '[Draft: two or three values, with a short line each.]'],
    [
      intake.yearsInBusiness ? `${intake.yearsInBusiness}+ years` : 'Experience',
      copy?.about?.experience ||
        (intake.yearsInBusiness ? `[Draft: what ${intake.yearsInBusiness} years of experience means for customers.]` : '[Draft: experience, certifications, numbers.]'),
    ],
  ];
  // "Inside the business": up to four more photos, if the client sent enough.
  const mosaic = media.length >= 4 ? media.slice(2, 6) : [];
  return [
    pageBanner(intake, `About ${name}`, intake.tagline, media[3] || media[0] || null, 'About'),
    section(
      b.columns(
        [
          img.about ? b.column(b.image(img.about, { radius: RADIUS }), { valign: 'center' }) : '',
          b.column(
            [
              eyebrow('Our story'),
              b.heading(copy?.about?.headline || 'How it started'),
              ...(copy?.about?.story?.length
                ? copy.about.story.map((para) => b.paragraph(para))
                : [
                    b.paragraph(intake.description || `[Draft: the story of ${name}.]`),
                    b.paragraph('[Draft: who is behind the business, how it started, what makes it different.]'),
                  ]),
            ],
            { valign: 'center' }
          ),
        ],
        { valign: 'center', align: 'wide' }
      )
    ),
    factsStrip(intake),
    section(
      [
        eyebrow('What we stand for', { textAlign: 'center' }),
        b.heading('Why people choose us', 2, { textAlign: 'center' }),
        b.spacer(24),
        b.columns(values.map(([h, p], i) => b.column(card([b.paragraph(String(i + 1).padStart(2, '0'), { className: 'sk-card-num' }), b.heading(h, 3), b.paragraph(p)]))), { align: 'wide' }),
      ],
      { className: 'sk-values', background: palette(intake).accent, text: palette(intake).onAccent }
    ),
    mosaic.length
      ? section([eyebrow(`Inside ${name}`, { textAlign: 'center' }), b.gallery(mosaic, { columns: mosaic.length, align: 'wide' })], { className: 'sk-gallery sk-mosaic', padding: [60, 50] })
      : '',
    teamSection(intake),
    testimonialsSection(intake),
    ctaBand(intake, `Work with ${name}`, null),
  ].join('\n\n');
}

function services(intake, assets, copy) {
  const img = pickImages(assets);
  const rows = serviceList(intake).map((s, i) => {
    const pic = img.services.length ? img.services[i % img.services.length] : null;
    const text = b.column(
      [
        eyebrow(`Service ${String(i + 1).padStart(2, '0')}`),
        b.heading(s.name),
        b.paragraph(serviceCopy(copy, i)?.summary || s.description || `[Draft: describe ${s.name}.]`),
        b.paragraph(serviceCopy(copy, i)?.details || `[Draft: who ${s.name} is for, what is included, typical price or timeline.]`),
        b.buttons(b.button('Ask about this', pageUrl('contact'), true)),
      ],
      { valign: 'center' }
    );
    const picture = pic ? b.column(b.image(pic, { radius: RADIUS }), { valign: 'center' }) : '';
    // Alternate image left / right down the page.
    const cols = i % 2 === 0 ? [picture, text] : [text, picture];
    return section([b.html(`<span class="sk-anchor" id="service-${i + 1}"></span>`), b.columns(cols, { valign: 'center', align: 'wide' })], { padding: [60, 50], className: 'sk-service-row' });
  });
  // Quick links to each service, so visitors can jump straight to the one they want.
  const jump =
    rows.length > 1
      ? section(
          b.html(`<nav class="sk-jump" aria-label="Services on this page"><span class="sk-jump__label">Jump to</span>${serviceList(intake).map((s, i) => `<a href="#service-${i + 1}">${b.esc(s.name)}</a>`).join('')}</nav>`),
          { className: 'sk-jump-wrap', padding: [30, 50] }
        )
      : '';
  const media = assets.media || [];
  return [
    pageBanner(
      intake,
      'Services',
      copy?.services?.intro ||
        (intake.targetCustomer ? `[Draft: intro to services for ${intake.targetCustomer}.]` : '[Draft: one-paragraph overview of what we offer.]'),
      media[4] || media[0] || null
    ),
    jump,
    ...rows,
    ctaBand(intake, 'Not sure which service you need?', 'Tell us what you are looking for and we will point you in the right direction.'),
  ].join('\n\n');
}

function contact(intake, copy, { contactForm = false } = {}, assets = {}) {
  const lines = [];
  if (intake.email) lines.push(b.paragraphHtml(`<strong>Email</strong><br><a href="mailto:${b.esc(intake.email)}">${b.esc(intake.email)}</a>`));
  if (intake.phone) lines.push(b.paragraphHtml(`<strong>Phone</strong><br><a href="${b.esc(telHref(intake.phone))}">${b.esc(intake.phone)}</a>`));
  if (intake.whatsapp) lines.push(b.paragraphHtml(`<strong>WhatsApp</strong><br><a href="${b.esc(waHref(intake.whatsapp))}">${b.esc(intake.whatsapp)}</a>`));
  if (intake.address) lines.push(b.paragraphHtml(`<strong>Address</strong><br>${b.esc(intake.address)}`));
  if (intake.serviceArea) lines.push(b.paragraphHtml(`<strong>Service area</strong><br>${b.esc(intake.serviceArea)}`));

  const mapQuery = intake.address || intake.location;
  const map = mapQuery
    ? b.html(
        `<iframe class="sk-map" title="Map showing ${b.esc(intake.businessName)}" src="https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&amp;output=embed" width="100%" height="420" style="border:0;border-radius:${RADIUS}px" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`
      )
    : intake.serviceArea
      ? '' // works remotely or across a wide area: no address to map
      : b.paragraph('[Add a map once the client confirms the address.]');

  // With the SiteKit Contact Form plugin: form on the left, details + map on the right.
  // Without it: details on the left with a reminder to add a form.
  const detailsCard = card([b.heading('Get in touch', 3), ...lines, b.buttons(b.button('Email us', `mailto:${intake.email}`, Boolean(contactForm)))]);
  const left = contactForm
    ? card([b.heading('Send us a message', 3), b.shortcode(`[sitekit_contact to="${String(intake.email).replace(/["\[\]]/g, '')}"]`)])
    : card([
        b.heading('Get in touch', 3),
        ...lines,
        b.paragraph('[Replace with a contact form: activate the SiteKit Contact Form plugin and push again (see README).]'),
        b.buttons(b.button('Email us', `mailto:${intake.email}`)),
      ]);
  const hours = hoursCard(intake) ? b.html(hoursCard(intake)) : '';
  const right = contactForm ? [detailsCard, hours ? b.spacer(24) : '', hours, map ? b.spacer(24) : '', map] : [hours, hours && map ? b.spacer(24) : '', map];

  // Quick actions: one tap to call, message, email or find the place.
  const quick = [];
  if (intake.phone) quick.push([telHref(intake.phone), icons.phone, 'Call us', intake.phone]);
  if (intake.whatsapp) quick.push([waHref(intake.whatsapp), icons.chat, 'WhatsApp', intake.whatsapp]);
  if (intake.email) quick.push([`mailto:${intake.email}`, icons.mail, 'Email us', intake.email]);
  if (mapQuery) quick.push([`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`, icons.pin, 'Visit us', mapQuery]);
  const quickCards = quick.length
    ? section(
        b.html(`<div class="sk-qcards">${quick.map(([href, icon, label, value]) => `<a class="sk-qcard" href="${b.esc(href)}"${href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}><span class="sk-qcard__icon">${icon}</span><strong>${b.esc(label)}</strong><span>${b.esc(value)}</span></a>`).join('')}</div>`),
        { className: 'sk-qcards-wrap', padding: [50, 50] }
      )
    : '';
  const media = assets.media || [];
  return [
    pageBanner(intake, 'Contact us', copy?.contact?.intro || `[Draft: one line inviting people to get in touch with ${intake.businessName}.]`, media[5] || media[0] || null, 'Contact'),
    quickCards,
    section(b.columns([b.column(left), b.column(right, { valign: contactForm ? null : 'center' })], { align: 'wide' })),
    faqSection(intake),
  ].join('\n\n');
}

// Returns the pages to create, in menu order.
// copy: the AI-drafted copy (project.copy.data) or null for placeholders.
// options.contactForm: the SiteKit Contact Form plugin is active on the target site.
// options.siteUrl: the site's address, e.g. http://localhost:8080/client (no trailing slash).
function generateSite(intake, assets, copy = null, options = {}) {
  siteBase = (options.siteUrl || '').replace(/\/+$/, '');
  try {
    return buildPages(intake, assets, copy, options);
  } finally {
    siteBase = '';
  }
}

function buildPages(intake, assets, copy, options) {
  // A before / after pair (the client's last two photos) is kept out of the other sections.
  const media = assets.media || [];
  if (intake.beforeAfter && media.length >= 3) assets = { ...assets, media: media.slice(0, -2), pair: media.slice(-2) };
  const pages = [{ slug: 'home', title: 'Home', content: home(intake, assets, copy), isFront: true }];
  if (intake.pages.includes('about')) pages.push({ slug: 'about', title: 'About', content: about(intake, assets, copy) });
  if (intake.pages.includes('services')) pages.push({ slug: 'services', title: 'Services', content: services(intake, assets, copy) });
  if (intake.pages.includes('contact')) pages.push({ slug: 'contact', title: 'Contact', content: contact(intake, copy, options, assets) });
  if (intake.pages.includes('blog')) pages.push({ slug: 'blog', title: 'Blog', content: '', isPosts: true });
  pages.forEach((p, i) => {
    p.menuOrder = i;
    p.seo = pageSeo(intake, copy, p);
  });
  return pages;
}

// Search title and description for a page: the written SEO copy when there is some,
// otherwise a sensible default (titles about 60 characters, descriptions about 155).
function pageSeo(intake, copy, page) {
  const name = intake.businessName;
  const written = copy?.seo?.[page.slug] || {};
  const clip = (text, max) => {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    const cut = t.slice(0, max - 1);
    return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20))}…`;
  };
  const where = intake.location ? `, ${intake.location.split(',')[0]}` : '';
  const title = written.title || (page.isFront ? `${name}${intake.tagline ? ` | ${intake.tagline}` : where}` : `${page.title} | ${name}`);
  const description = written.description || (page.isFront ? intake.description : '');
  return { title: clip(title, 70), description: clip(description, 160) };
}

// LocalBusiness JSON-LD for an SEO plugin (Rank Math / Yoast) or a header snippet.
function localBusinessSchema(intake, siteUrl, logoUrl, imageUrl) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: intake.businessName,
    description: intake.description || undefined,
    url: siteUrl || undefined,
    logo: logoUrl || undefined,
    image: imageUrl || logoUrl || undefined,
    email: intake.email || undefined,
    telephone: intake.phone || undefined,
    address: intake.address || undefined,
    areaServed: intake.serviceArea || intake.location || undefined,
  };
  return JSON.stringify(schema, null, 2);
}

// Count of [placeholder] drafts left in a page, so you know how much rewriting remains.
function countPlaceholders(content) {
  return (content.match(/\[(Draft|Service|Add|Replace)[^\]]*\]/g) || []).length;
}

module.exports = { generateSite, localBusinessSchema, countPlaceholders, telHref, waHref, palette, ctaHref };
