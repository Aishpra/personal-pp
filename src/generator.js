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
function contactButtons(intake, { onBrand = false, justify } = {}) {
  const items = [b.button('Get a quote', pageUrl('contact'), onBrand)];
  if (intake.phone) items.push(b.button('Call us', telHref(intake.phone), true));
  else if (intake.whatsapp) items.push(b.button('WhatsApp us', waHref(intake.whatsapp), true));
  return b.buttons(items, { justify });
}

// Full-width coloured band used at the top of inner pages ("Page title banner" in the PDF).
function pageBanner(intake, title, subtitle) {
  const c = palette(intake);
  return b.group(
    [eyebrow(intake.businessName), b.heading(title, 1, { fontSize: 'xx-large' }), subtitle ? b.paragraph(subtitle, { fontSize: 'large' }) : ''],
    { align: 'full', className: 'sk-banner', background: c.accent, text: c.onAccent, padding: [70, 50] }
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

  // 2. Hero: full-width photo with the brand's dark colour as overlay.
  out.push(
    b.cover(
      [
        intake.location ? eyebrow(intake.location) : '',
        b.heading(name, 1, { fontSize: 'xx-large' }),
        intake.tagline ? b.paragraph(intake.tagline, { fontSize: 'x-large' }) : '',
        b.paragraph(copy?.home.heroLead || intake.description || `[Draft: value proposition. What ${name} does, for whom, and why choose it.]`),
        contactButtons(intake),
      ],
      { img: img.hero, overlay: c.overlay, dim: img.hero ? 70 : 100, minHeight: 620, className: 'sk-hero' }
    )
  );

  // Quick facts strip: only facts the client actually gave us.
  const facts = [];
  if (intake.yearsInBusiness) facts.push([`${intake.yearsInBusiness}+`, 'years in business']);
  if (intake.services.length) facts.push([String(intake.services.length), intake.services.length === 1 ? 'core service' : 'core services']);
  if (intake.serviceArea) facts.push([intake.serviceArea, 'service area']);
  else if (intake.location) facts.push([intake.location, 'based in']);
  if (facts.length >= 2) {
    out.push(
      section(
        b.columns(facts.map(([big, small]) => b.column([b.heading(big, 3, { textAlign: 'center', fontSize: 'x-large' }), b.paragraph(small, { textAlign: 'center', className: 'sk-eyebrow' })])), { align: 'wide' }),
        { className: 'sk-facts', padding: [50, 50] }
      )
    );
  }

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
                    b.paragraphHtml(`<a href="${b.esc(pageUrl('services'))}">Learn more →</a>`),
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
    const aboutText = copy?.home.aboutTeaser || (intake.yearsInBusiness
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

  // 6. Social proof: only real testimonials, never invented ones.
  if (intake.testimonials.length) {
    out.push(
      section(
        [
          eyebrow('Testimonials', { textAlign: 'center' }),
          b.heading('What customers say', 2, { textAlign: 'center' }),
          b.spacer(24),
          b.columns(intake.testimonials.slice(0, 3).map((t) => b.column(card([b.paragraph(`“${t.quote}”`, { fontSize: 'large' }), t.author ? b.paragraph(`— ${t.author}`, { className: 'sk-eyebrow' }) : '']))), { align: intake.testimonials.length > 1 ? 'wide' : null }),
        ],
        { className: 'sk-testimonials', background: c.accent, text: c.onAccent }
      )
    );
  }

  // 7. CTA band
  out.push(ctaBand(intake, `Ready to work with ${name}?`, copy?.home.ctaLine || (intake.serviceArea ? `Serving ${intake.serviceArea}.` : 'Get in touch today.')));

  // 8. Footer: written into the theme's footer template part (see theme.js).
  return out.join('\n\n');
}

function about(intake, assets, copy) {
  const img = pickImages(assets);
  const name = intake.businessName;
  const values = [
    ['Mission', copy?.about.mission || '[Draft: one sentence on what the business exists to do.]'],
    ['Values', copy?.about.values || '[Draft: two or three values, with a short line each.]'],
    [
      intake.yearsInBusiness ? `${intake.yearsInBusiness}+ years` : 'Experience',
      copy?.about.experience ||
        (intake.yearsInBusiness ? `[Draft: what ${intake.yearsInBusiness} years of experience means for customers.]` : '[Draft: experience, certifications, numbers.]'),
    ],
  ];
  return [
    pageBanner(intake, `About ${name}`, intake.tagline),
    section(
      b.columns(
        [
          img.about ? b.column(b.image(img.about, { radius: RADIUS }), { valign: 'center' }) : '',
          b.column(
            [
              eyebrow('Our story'),
              b.heading(copy?.about.headline || 'How it started'),
              ...(copy?.about.story?.length
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
    section(b.columns(values.map(([h, p]) => b.column(card([b.heading(h, 3), b.paragraph(p)]))), { align: 'wide' }), {
      background: palette(intake).accent,
      text: palette(intake).onAccent,
    }),
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
    return section(b.columns(cols, { valign: 'center', align: 'wide' }), { padding: [60, 50] });
  });
  return [
    pageBanner(
      intake,
      'Services',
      copy?.services.intro ||
        (intake.targetCustomer ? `[Draft: intro to services for ${intake.targetCustomer}.]` : '[Draft: one-paragraph overview of what we offer.]')
    ),
    ...rows,
    ctaBand(intake, 'Not sure which service you need?', 'Tell us what you are looking for and we will point you in the right direction.'),
  ].join('\n\n');
}

function contact(intake, copy, { contactForm = false } = {}) {
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
  const right = contactForm ? [detailsCard, b.spacer(24), map] : [map];

  return [
    pageBanner(intake, 'Contact us', copy?.contact.intro || `[Draft: one line inviting people to get in touch with ${intake.businessName}.]`),
    section(b.columns([b.column(left), b.column(right, { valign: contactForm ? null : 'center' })], { align: 'wide' })),
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
  const pages = [{ slug: 'home', title: 'Home', content: home(intake, assets, copy), isFront: true }];
  if (intake.pages.includes('about')) pages.push({ slug: 'about', title: 'About', content: about(intake, assets, copy) });
  if (intake.pages.includes('services')) pages.push({ slug: 'services', title: 'Services', content: services(intake, assets, copy) });
  if (intake.pages.includes('contact')) pages.push({ slug: 'contact', title: 'Contact', content: contact(intake, copy, options) });
  if (intake.pages.includes('blog')) pages.push({ slug: 'blog', title: 'Blog', content: '', isPosts: true });
  pages.forEach((p, i) => (p.menuOrder = i));
  return pages;
}

// LocalBusiness JSON-LD for an SEO plugin (Rank Math / Yoast) or a header snippet.
function localBusinessSchema(intake, siteUrl, logoUrl) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: intake.businessName,
    description: intake.description || undefined,
    url: siteUrl || undefined,
    logo: logoUrl || undefined,
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

module.exports = { generateSite, localBusinessSchema, countPlaceholders, telHref, waHref, palette };
