// Turns the raw intake form submission into a clean intake object,
// and flags gaps that will cause trouble later (generic copy, missing local SEO info).

const PAGE_OPTIONS = ['about', 'services', 'contact', 'blog'];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function str(v, max = 2000) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

// "Service name: short description" per line. A line without a colon is a name only.
function parseServices(text) {
  return str(text, 5000)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((line) => {
      const idx = line.indexOf(':');
      if (idx === -1) return { name: line, description: '' };
      return { name: line.slice(0, idx).trim(), description: line.slice(idx + 1).trim() };
    })
    .filter((s) => s.name);
}

// "Quote text - Name" per line.
function parseTestimonials(text) {
  return str(text, 5000)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((line) => {
      const m = line.match(/^(.*?)\s+[-–—]\s+([^-–—]+)$/);
      return m ? { quote: m[1].replace(/^["“]|["”]$/g, ''), author: m[2].trim() } : { quote: line, author: '' };
    });
}

// Generic "left SEP right" list, one per line (opening hours, team).
function parsePairs(text, sep, max) {
  return str(text, 4000)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, max)
    .map((line) => {
      const m = line.match(sep);
      return m ? [line.slice(0, m.index).trim(), line.slice(m.index + m[0].length).trim()] : [line, ''];
    })
    .filter(([a]) => a);
}

// "Sunday - Friday: 9am - 6pm" per line.
const parseHours = (text) => parsePairs(text, /:\s+|\s+[|]\s+/, 8).map(([days, time]) => ({ days, time }));
// "Name - Role" per line.
const parseTeam = (text) => parsePairs(text, /\s+[-–—]\s+/, 8).map(([name, role]) => ({ name, role }));
// "Question? Answer" per line: the question ends at the first "?".
function parseFaq(text) {
  return str(text, 6000)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10)
    .map((line) => {
      const i = line.indexOf('?');
      return i === -1 ? null : { q: line.slice(0, i + 1).trim(), a: line.slice(i + 1).trim() };
    })
    .filter((f) => f && f.a);
}

function parseLinks(text) {
  return str(text, 3000)
    .split(/[\s,]+/)
    .filter((u) => /^https?:\/\/\S+$/i.test(u))
    .slice(0, 5);
}

// Homepage hero layouts. "auto" lets the design style decide.
const LANGUAGES = ['en', 'ne', 'both'];
const HERO_LAYOUTS = ['auto', 'collage', 'centered', 'split', 'editorial'];
const DESIGN_STYLES = ['classic', 'bold', 'elegant', 'playful', 'minimal', 'luxe', 'organic', 'corporate'];

function parseIntake(body) {
  const pages = [].concat(body.pages || []).filter((p) => PAGE_OPTIONS.includes(p));
  const colours = [body.colourPrimary, body.colourSecondary, body.colourAccent].map((c) =>
    HEX_RE.test(c || '') ? c.toLowerCase() : null
  );

  return {
    businessName: str(body.businessName, 120),
    tagline: str(body.tagline, 200),
    // Text of the main button (header, hero, call-to-action band). It links to the Contact page.
    ctaLabel: str(body.ctaLabel, 30) || 'Get a quote',
    description: str(body.description, 1500),
    services: parseServices(body.services),
    targetCustomer: str(body.targetCustomer, 500),
    location: str(body.location, 200),
    serviceArea: str(body.serviceArea, 300),
    address: str(body.address, 300),
    email: str(body.email, 200),
    phone: str(body.phone, 50),
    whatsapp: str(body.whatsapp, 50),
    yearsInBusiness: str(body.yearsInBusiness, 10),
    testimonials: parseTestimonials(body.testimonials),
    hours: parseHours(body.hours),
    team: parseTeam(body.team),
    faq: parseFaq(body.faq),
    // The last two photos are a before / after pair (shown with a drag slider).
    beforeAfter: body.beforeAfter === 'yes' || body.beforeAfter === true,
    likedSites: parseLinks(body.likedSites),
    competitors: parseLinks(body.competitors),
    colours: {
      primary: colours[0] || '#2563eb',
      secondary: colours[1] || '#1e293b',
      accent: colours[2] || '#f1f5f9',
    },
    pages: ['home', ...pages],
    // Design style for the generated site (see DESIGN_STYLES in theme.js).
    style: DESIGN_STYLES.includes(body.style) ? body.style : 'classic',
    heroLayout: HERO_LAYOUTS.includes(body.heroLayout) ? body.heroLayout : 'auto',
    // Site language: English, Nepali, or both (English at /, Nepali at /ne/).
    language: LANGUAGES.includes(body.language) ? body.language : 'en',
    // The client's own Nepali text; anything left empty falls back to the English.
    ne: {
      businessName: str(body.businessNameNe, 120),
      tagline: str(body.taglineNe, 200),
      ctaLabel: str(body.ctaLabelNe, 40),
      description: str(body.descriptionNe, 1500),
      services: parseServices(body.servicesNe),
      targetCustomer: str(body.targetCustomerNe, 500),
      location: str(body.locationNe, 200),
      serviceArea: str(body.serviceAreaNe, 300),
      hours: parseHours(body.hoursNe),
      faq: parseFaq(body.faqNe),
    },
    hosting: {
      domain: str(body.domain, 200),
      hasHosting: body.hasHosting === 'yes',
      notes: str(body.hostingNotes, 1000),
    },
    logo: null, // set by the upload handler
    media: [], // set by the upload handler
  };
}

function validateIntake(intake) {
  const errors = [];
  if (!intake.businessName) errors.push('Business name is required.');
  if (!intake.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(intake.email)) errors.push('A valid contact email is required.');
  if (!intake.logo) errors.push('A logo is required.');
  return errors;
}

// Not blockers, but each one means more manual work or weaker results later.
function intakeWarnings(intake) {
  const w = [];
  if (intake.description.length < 80) w.push('Description is very short: page copy will be generic and need heavy rewriting.');
  if (intake.services.length === 0) w.push('No services listed: the Services page and homepage cards will be placeholders.');
  if (intake.services.some((s) => !s.description)) w.push('Some services have no description.');
  if (!intake.location && !intake.address) w.push('No location or address: local SEO (Google Maps, schema) will be weak.');
  if (intake.testimonials.length === 0) w.push('No testimonials: the social proof block will be hidden.');
  if (intake.media.length < 3) w.push('Fewer than 3 photos: hero, about and gallery will reuse images or be empty.');
  if (intake.logo && intake.logo.warning) w.push(intake.logo.warning);
  if (intake.language !== 'en' && !intake.ne?.description) w.push('Nepali pages: no Nepali description given, so they borrow the English text. Ask the client for Nepali text (or translate it).');
  if (!intake.hosting.domain) w.push('No domain given: ask who owns/buys the domain before launch.');
  return w;
}

module.exports = { DESIGN_STYLES, HERO_LAYOUTS, LANGUAGES, parseHours, parseTeam, parseFaq, parseIntake, validateIntake, intakeWarnings, parseServices, parseTestimonials, PAGE_OPTIONS };
