// Builds draft page content from a project's intake, following the wireframes in the
// planning PDF (homepage blocks 1-8, About / Services / Contact inner pages).
//
// Copy is TEMPLATED, not written: anything in [square brackets] is a placeholder you
// must rewrite before the client sees it. The point is to get a correct structure with
// the client's real name, logo, photos, services and contact details on staging fast.
const b = require('./blocks');

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
    gallery: media.slice(0, 5),
  };
}

// onBrand: buttons sit on a brand-coloured background, where a filled brand-coloured
// button would be invisible, so both are drawn as outlines.
function contactButtons(intake, { onBrand = false } = {}) {
  const items = [b.button('Get a quote', '/contact/', onBrand)];
  if (intake.phone) items.push(b.button('Call us', telHref(intake.phone), true));
  else if (intake.whatsapp) items.push(b.button('WhatsApp us', waHref(intake.whatsapp), true));
  return b.buttons(...items);
}

function serviceCards(intake) {
  const services = intake.services.length
    ? intake.services.slice(0, 3)
    : [1, 2, 3].map((n) => ({ name: `[Service ${n}]`, description: '' }));
  return b.columns(
    ...services.map((s) =>
      b.column(
        b.heading(s.name, 3),
        b.paragraph(s.description || `[Draft: one or two sentences on ${s.name} and who it is for.]`),
        b.paragraphHtml(`<a href="/services/">Learn more</a>`)
      )
    )
  );
}

function home(intake, assets) {
  const img = pickImages(assets);
  const name = intake.businessName;
  const sections = [];

  // 2. Hero
  sections.push(
    b.columns(
      b.column(
        b.heading(name, 1),
        intake.tagline ? b.paragraphHtml(`<strong>${b.esc(intake.tagline)}</strong>`) : '',
        b.paragraph(intake.description || `[Draft: value proposition. What ${name} does, for whom, and why choose it.]`),
        contactButtons(intake)
      ),
      b.column(b.image(img.hero))
    )
  );

  // 3. Services
  if (intake.pages.includes('services') || intake.services.length) {
    sections.push(b.spacer(), b.heading('Services'), serviceCards(intake));
  }

  // 4. About
  if (intake.pages.includes('about')) {
    const aboutText = intake.yearsInBusiness
      ? `[Draft: short story of ${name}. ${intake.yearsInBusiness} years in business${intake.location ? ` in ${intake.location}` : ''}. Who runs it and why customers trust it.]`
      : `[Draft: short story of ${name}. Who runs it and why customers trust it.]`;
    sections.push(
      b.spacer(),
      b.columns(
        b.column(b.image(img.about)),
        b.column(b.heading('About us'), b.paragraph(aboutText), b.buttons(b.button('Learn more', '/about/', true)))
      )
    );
  }

  // 5. Media strip
  if (img.gallery.length >= 2) sections.push(b.spacer(), b.gallery(img.gallery));

  // 6. Social proof (only when there is real proof; no fake testimonials)
  if (intake.testimonials.length) {
    sections.push(b.spacer(), ...intake.testimonials.slice(0, 2).map((t) => b.quote(t.quote, t.author)));
  }

  // 7. CTA band
  sections.push(
    b.spacer(),
    b.group(
      [
        b.heading(`Ready to work with ${name}?`),
        b.paragraph(intake.serviceArea ? `Serving ${intake.serviceArea}.` : 'Get in touch today.'),
        contactButtons(intake, { onBrand: true }),
      ],
      { background: intake.colours.primary, text: '#ffffff' }
    )
  );

  // 8. Footer NAP: the theme footer is shared across pages, so contact details go
  // here as a block and on the Contact page. Edit the theme footer in the Site Editor.
  return sections.join('\n\n');
}

function about(intake, assets) {
  const img = pickImages(assets);
  const name = intake.businessName;
  return [
    b.heading(`About ${name}`, 1),
    b.columns(
      b.column(b.image(img.about)),
      b.column(
        b.paragraph(intake.description || `[Draft: the story of ${name}.]`),
        b.paragraph('[Draft: who is behind the business, how it started, what makes it different.]')
      )
    ),
    b.spacer(),
    b.columns(
      b.column(b.heading('Mission', 3), b.paragraph('[Draft: one sentence on what the business exists to do.]')),
      b.column(b.heading('Values', 3), b.paragraph('[Draft: two or three values, with a short line each.]')),
      b.column(
        b.heading(intake.yearsInBusiness ? `${intake.yearsInBusiness}+ years` : 'Experience', 3),
        b.paragraph(intake.yearsInBusiness ? `[Draft: what ${intake.yearsInBusiness} years of experience means for customers.]` : '[Draft: experience, certifications, numbers.]')
      )
    ),
  ].join('\n\n');
}

function services(intake, assets) {
  const img = pickImages(assets);
  const list = intake.services.length ? intake.services : [{ name: '[Service 1]', description: '' }];
  const rows = list.map((s, i) => {
    const pic = img.services.length ? img.services[i % img.services.length] : null;
    const text = [
      b.heading(s.name),
      b.paragraph(s.description || `[Draft: describe ${s.name}.]`),
      b.paragraph(`[Draft: who ${s.name} is for, what is included, typical price or timeline.]`),
    ];
    return pic ? b.columns(b.column(b.image(pic)), b.column(...text)) : text.join('\n\n');
  });
  return [
    b.heading('Services', 1),
    b.paragraph(intake.targetCustomer ? `[Draft: intro to services for ${intake.targetCustomer}.]` : '[Draft: one-paragraph overview of what we offer.]'),
    ...rows.flatMap((r) => [b.spacer(32), r]),
    b.spacer(),
    b.buttons(b.button('Request a quote', '/contact/')),
  ].join('\n\n');
}

function contact(intake) {
  const lines = [];
  if (intake.email) lines.push(b.paragraphHtml(`<strong>Email:</strong> <a href="mailto:${b.esc(intake.email)}">${b.esc(intake.email)}</a>`));
  if (intake.phone) lines.push(b.paragraphHtml(`<strong>Phone:</strong> <a href="${b.esc(telHref(intake.phone))}">${b.esc(intake.phone)}</a>`));
  if (intake.whatsapp) lines.push(b.paragraphHtml(`<strong>WhatsApp:</strong> <a href="${b.esc(waHref(intake.whatsapp))}">${b.esc(intake.whatsapp)}</a>`));
  if (intake.address) lines.push(b.paragraphHtml(`<strong>Address:</strong> ${b.esc(intake.address)}`));
  if (intake.serviceArea) lines.push(b.paragraphHtml(`<strong>Service area:</strong> ${b.esc(intake.serviceArea)}`));

  const mapQuery = intake.address || intake.location;
  const map = mapQuery
    ? b.html(
        `<iframe title="Map" src="https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&amp;output=embed" width="100%" height="360" style="border:0" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`
      )
    : b.paragraph('[Add a map once the client confirms the address.]');

  return [
    b.heading('Contact us', 1),
    b.paragraph(`[Draft: one line inviting people to get in touch with ${intake.businessName}.]`),
    b.columns(
      b.column(
        ...lines,
        b.paragraph('[Replace with a contact form: install a form plugin (e.g. WPForms Lite or Contact Form 7) and insert its block here.]'),
        b.buttons(b.button('Email us', `mailto:${intake.email}`))
      ),
      b.column(map)
    ),
  ].join('\n\n');
}

// Returns the pages to create, in menu order.
function generateSite(intake, assets) {
  const pages = [{ slug: 'home', title: 'Home', content: home(intake, assets), isFront: true }];
  if (intake.pages.includes('about')) pages.push({ slug: 'about', title: 'About', content: about(intake, assets) });
  if (intake.pages.includes('services')) pages.push({ slug: 'services', title: 'Services', content: services(intake, assets) });
  if (intake.pages.includes('contact')) pages.push({ slug: 'contact', title: 'Contact', content: contact(intake) });
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

module.exports = { generateSite, localBusinessSchema, countPlaceholders };
