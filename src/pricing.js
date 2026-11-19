// Pricing settings and calculator. Prices are worked out from hours per phase × your
// hourly rate + a buffer, so you can see what each package really pays you.
// Stored in data/pricing.json (git-ignored, like all business data).
const fs = require('fs');
const path = require('path');
const { PHASES } = require('./phases');

const FILE = path.join(__dirname, '..', 'data', 'pricing.json');

// Starting estimates only: replace them with your own times after the first few sites.
// "standard" is the 5-page package from the planning PDF.
const DEFAULTS = {
  studio: { name: '', email: '', phone: '', website: '' },
  currency: '',
  hourlyRate: 0,
  bufferPercent: 20,
  packages: [
    {
      id: 'starter',
      name: 'Starter',
      summary: 'A one-page website: everything a small business needs on a single scrolling page.',
      pages: 1,
      revisionRounds: 1,
      hours: { intake: 1, strategy: 0.5, copy: 1, build: 2, seo: 1, review: 1, launch: 1.5 },
    },
    {
      id: 'standard',
      name: 'Standard',
      summary: 'Five pages: Home, About, Services, Contact and an optional Blog.',
      pages: 5,
      revisionRounds: 2,
      hours: { intake: 2, strategy: 2, copy: 3, build: 5, seo: 2, review: 3, launch: 3 },
    },
    {
      id: 'plus',
      name: 'Plus',
      // Pages beyond SiteKit's five are built by hand in WordPress; the extra hours cover that.
      summary: 'Up to eight pages for businesses with more to show, and an extra revision round.',
      pages: 8,
      revisionRounds: 3,
      hours: { intake: 2, strategy: 3, copy: 5, build: 8, seo: 3, review: 4, launch: 3 },
    },
  ],
  care: {
    name: 'Care plan',
    summary: 'Updates, backups, security checks and small text changes every month.',
    hoursPerMonth: 2,
  },
};

function load() {
  try {
    const saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return { ...DEFAULTS, ...saved, studio: { ...DEFAULTS.studio, ...saved.studio }, care: { ...DEFAULTS.care, ...saved.care } };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
}

function save(settings) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(settings, null, 2));
}

const num = (v, max = 1e9) => {
  const n = Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0;
};
const str = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function fromForm(body) {
  const current = load();
  return {
    studio: { name: str(body.studioName, 80), email: str(body.studioEmail, 120), phone: str(body.studioPhone, 40), website: str(body.studioWebsite, 120) },
    currency: str(body.currency, 8),
    hourlyRate: num(body.hourlyRate),
    bufferPercent: num(body.bufferPercent, 200),
    packages: current.packages.map((pkg) => ({
      ...pkg,
      name: str(body[`name_${pkg.id}`], 40) || pkg.name,
      summary: str(body[`summary_${pkg.id}`], 200) || pkg.summary,
      pages: num(body[`pages_${pkg.id}`], 100),
      revisionRounds: num(body[`rounds_${pkg.id}`], 10),
      hours: Object.fromEntries(PHASES.map((ph) => [ph.id, num(body[`h_${pkg.id}_${ph.id}`], 500)])),
    })),
    care: { ...current.care, hoursPerMonth: num(body.careHours, 100) },
  };
}

// Rounds a price to a tidy figure: two significant digits, e.g. 23,480 -> 24,000.
function tidy(n) {
  if (n <= 0) return 0;
  const step = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1);
  return Math.ceil(n / step) * step;
}

function quote(settings, pkg) {
  const hours = Object.values(pkg.hours).reduce((a, b) => a + b, 0);
  const cost = hours * settings.hourlyRate;
  const price = tidy(cost * (1 + settings.bufferPercent / 100));
  return { hours, cost, price, effectiveRate: hours ? price / hours : 0 };
}

function careQuote(settings) {
  return { price: tidy(settings.care.hoursPerMonth * settings.hourlyRate * (1 + settings.bufferPercent / 100)) };
}

function money(settings, n) {
  const formatted = Math.round(n).toLocaleString('en-US');
  return settings.currency ? `${settings.currency} ${formatted}` : formatted;
}

module.exports = { load, save, fromForm, quote, careQuote, money, tidy, DEFAULTS };
