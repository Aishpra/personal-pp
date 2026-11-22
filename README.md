# SiteKit

An internal tool for running a done-for-you WordPress website service, built from the
"WordPress Site Creation Service" plan (intake → strategy → copy → build → SEO → review → launch).

It is **not** a one-click AI website builder: you stay in control of every page. What it does:

1. **Intake form**: collects everything the plan needs from a client (business, services,
   contact/location, logo, photos, brand colours, pages, domain/hosting). It rejects files
   WordPress can't use (SVG/AI logos) and **flags gaps** that will cause rework later
   (short description, no services, no address, low-resolution logo, no testimonials).
2. **Project tracker**: the 7 phases from the plan as a checklist, showing whether the
   project is waiting on you or on the client.
3. **AI copy, offline**: a local model (via [Ollama](https://ollama.com)) writes the page copy
   from the intake: hero, about story, mission and values, service descriptions, contact line,
   and SEO titles and descriptions. No API key, no internet, no per-site cost. You review and
   edit everything in SiteKit before it goes on the site. Claims the client never made are
   flagged for checking (see "AI copy" below).
4. **Push draft to staging**: one click turns the intake into a finished-looking WordPress site
   that follows the PDF wireframes:
   - full-width photo hero, quick-facts strip, service cards, about, gallery, testimonials
     (only real ones) and a call-to-action band
   - inner pages with a title banner; Services alternates image left/right
   - a sticky header (logo, menu, "Get a quote") and a footer with name, address and phone for local SEO
   - the client's brand colours, with text colour picked automatically so it stays readable
   - subtle motion: hero fade-in, scroll reveals, card and button hover. It's CSS only, no
     plugin, and switched off for visitors who set "reduce motion"
   It uses real Gutenberg blocks, so everything stays editable in WordPress.
   **Each client gets their own staging site** (`localhost:8080/<client>/`), so pushing one
   client never touches another.
5. **Contact form included**: SiteKit's own small WordPress plugin. It emails each message to
   the business and keeps a copy under **Messages** in wp-admin, with built-in spam protection.
6. **Client review**: tracks feedback deadlines and revision rounds, and flags billable rounds after 2.
7. **LocalBusiness schema**: JSON-LD you can paste into your SEO plugin.

## Requirements

- [Node.js](https://nodejs.org) 18 or newer
- [Docker Desktop](https://docs.docker.com/get-docker/), for the local staging WordPress
- For AI copy: about 8 GB of free RAM and 5 GB of disk for the default model (about 8 GB if
  `npm run ai:up` also has to download the Ollama Docker image, about 3.3 GB). Either install
  [Ollama](https://ollama.com) yourself, or let `npm run ai:up` run it in Docker.

## Run it locally

```bash
npm install
```

```bash
npm run wp:up
```

This starts WordPress at http://localhost:8080 in Docker and sets it up as a Multisite network,
so each client gets their own site at `http://localhost:8080/<project-id>/`, created on their
first push. It also turns on the contact form plugin and writes the login into `.env`.
It's safe to re-run, and running it on an older SiteKit install converts it.

```bash
npm start
```

For AI copy, download the local model once (about 4.7 GB, plus about 3.3 GB for the Ollama
Docker image if Ollama isn't installed on the computer):

```bash
npm run ai:up
```

Open http://localhost:3000, click **New project** and fill in the intake. On the project page,
click **Write copy with AI**, review it, then **Push draft to staging**.

Other commands:

| Command | What it does |
| --- | --- |
| `npm run dev` | Start SiteKit and restart it when files change |
| `npm run samples -- --push` | Load and push the 35 sample sites (add `--only=thakali-hearth,code-sherpa` for just those) |
| `npm run agency -- --push` | Build your own agency site in WordPress from `agency/agency.json` |
| `npm run agency:build` | Build the hand-made agency website (`agency/site/`) into `dist/agency/` for static hosting |
| `npm run export -- <project-id>` | Export a pushed site to plain static files in `dist/<project-id>/` |
| `npm run plugins:zip` | Package the three SiteKit WordPress plugins as zips for a live site, in `dist/plugins/` |
| `npm run ai:up` | Start Ollama (or use yours) and download the copywriting model |
| `npm run wp:down` | Stop WordPress (keeps its data) |
| `npm run wp:reset` | Delete all staging sites and start fresh (keeps the AI model) |
| `npm test` | Unit tests for intake parsing and page generation |
| `npm run check:blocks` | Opens every generated page in the real WordPress editor and reports invalid blocks (needs Playwright, see below) |

### Using a WordPress that isn't the Docker one

Set `WP_URL`, `WP_USER` and `WP_APP_PASSWORD` in `.env` (copy `.env.example`), and remove
`WP_MULTISITE`. Create the password in wp-admin under **Users → Profile → Application
Passwords**. The user must be an administrator. Use a block theme (e.g. Twenty Twenty-Five) for
brand colours to apply. In this mode every project pushes to that one site.

## Design styles and motion

Each project has a **Design style** (on the intake form), applied to the whole site on push and
always in the client's brand colours:

| Style | Look |
| --- | --- |
| Classic | Clean and modern; suits anyone |
| Bold | Huge uppercase type, square shapes, hard offset shadows |
| Elegant | Serif headings with italics, centred hero, arch-shaped photos |
| Playful | Quirky headings, tilted cards, blob-shaped photos, bouncy buttons |
| Minimal | Light editorial type, black-and-white photos, hairlines, no shadows |

The styles are CSS in `src/theme.js`, stored in each site's Global Styles, using fonts that ship
with Twenty Twenty-Five (nothing loaded from outside).

**Every site gets** a top bar with location, phone, email and WhatsApp (it scrolls away while
the main bar stays pinned), a full-screen mobile menu in the brand's dark colour, and inner pages
with photo banners and breadcrumbs. The About page has the story, a facts strip, numbered values
and a photo mosaic. Services has jump links and numbered rows. Contact has one-tap call, WhatsApp,
email and directions cards. The homepage hero has a split layout with a floating photo collage,
and each design style styles it differently.

`wordpress/sitekit-motion/` is a second plugin, active on every staging site. It bundles
**GSAP 3.15.1** with ScrollTrigger and SplitText (free "Standard" licence, see
`wordpress/sitekit-motion/vendor/README.md`), about 48 KB compressed, so nothing loads from
outside. It adds:

- a hero intro where the headline letters rise and the photos swing in
- headings, cards and photos that reveal as you scroll
- numbers that count up and buttons that lean toward the pointer
- a curtain transition between pages and a back-to-top button with a progress ring

If GSAP fails to load, lighter CSS animations take over. Visitors who prefer reduced motion get a
still page. **On a live site**, install it like the contact form below. Without it, sites look
the same and keep simpler CSS-only animations.

## Contact form

`wordpress/sitekit-contact-form/` is a small WordPress plugin, active on every Docker staging
site. When it's active, SiteKit puts the form on the Contact page. When it isn't, the page keeps
a placeholder and the push log says so.

- Each message is **emailed to the address from the intake** and **saved in wp-admin under
  Messages**, with a column showing whether the email went out. Local staging can't send email,
  so it always shows "No" there; read messages in wp-admin instead.
- Spam protection: a hidden trap field, a minimum time to fill in the form, a signed form (so
  the recipient can't be changed), and at most 5 messages per hour per visitor. Bots are shown
  a fake success and nothing is saved. There's no CAPTCHA, so heavy spam may still need one.
- **On the live site**, install the plugin: zip the `sitekit-contact-form` folder, upload it
  in wp-admin under Plugins → Add New → Upload, and activate it. Many hosts can't send email
  from PHP reliably, so also install an SMTP plugin (e.g. WP Mail SMTP) and send a test message
  before handover.

## Selling: sample sites, pricing and a one-pager

**Sample sites.** 35 demo sites for fictional Nepali businesses across all five design styles
(cafés, a hospital, a college, shops, a law firm, a software company and more) to show prospects:

```bash
npm run samples -- --push
```

They appear on the dashboard tagged "Sample", each on its own staging site. Their photos are
CC0 (free to use, credits in `samples/CREDITS.md`); the names, logos and copy are made up. Phone
numbers use the 555-01xx range reserved for fiction. Don't present them as real clients.

**Pricing** (`/pricing` in SiteKit). Enter your hourly rate and currency, and SiteKit turns
estimated hours per phase into package prices, plus a buffer for overruns. The hours are
starting guesses: after each real project, replace them with how long it actually took. That's
the only way to know whether a package makes money.

**One-pager** (`/one-pager`). A printable A4 sales sheet built from your pricing, the sample
screenshots and the process from the planning PDF. Fill in your studio details on the Pricing
page, open the one-pager, and use Print → Save as PDF.

## AI copy

SiteKit sends the intake to a model running on your computer through Ollama
(`http://localhost:11434`). Nothing leaves your machine.

**Choosing a model.** Set `OLLAMA_MODEL` in `.env`, then run `npm run ai:up` again:

| Model | Download | Writing | Speed (measured, 4-core CPU, no GPU) |
| --- | --- | --- | --- |
| `qwen2.5:7b` (default) | 4.7 GB | Follows the rules a bit better and flags more of its own claims | about 3 minutes |
| `qwen2.5:3b` | 1.9 GB | Similar quality in testing, flags less | about 1.5 minutes |
| `qwen2.5:14b` | 9 GB | Untested here; worth trying with 16 GB+ RAM or a GPU | slower |

In testing on the same intake, **both drafts needed editing**: generic values ("Quality,
Tradition, Community"), short SEO descriptions, and the occasional invented detail. Don't
expect copy you can publish without reading it.

A Mac with Apple Silicon or a PC with a recent graphics card is many times faster than the
CPU-only numbers above.

**How invented claims are caught.** Local models sometimes write things the client never said
("loyal customer base", "eco-friendly"). SiteKit makes three checks and lists the results under
**Check before the client sees it**:

1. The model is told to use only intake facts and list anything it isn't sure of.
2. A second, separate pass asks the model to fact-check each sentence against the intake. This
   catches more, but it is noisy: expect some false alarms and some misses.
3. Code flags every number in the copy (years, counts, prices) that doesn't appear in the intake.

None of this replaces reading the copy. Treat it as a first draft.

**Saved edits are kept** until you click Regenerate. If you change the intake after the copy
was written, SiteKit warns you that the copy may be out of date.

## Where things are stored

- `data/<project>.json`: one file per project, including its copy
- `uploads/<project>/`: the client's logo and photos

Both folders are git-ignored on purpose, because they hold client data. Back them up yourself.

## Your agency website

`agency/site/` is your own marketing site. **It runs as a local demo:** start SiteKit
(`npm start`) and open **http://localhost:3000/agency/**, or use "Our site" in SiteKit's header.
SiteKit rebuilds it when it starts and every time you save the Pricing page, so it always shows
your current name, contact details and prices. It includes:

- **"Same business, five looks":** one sample shown in every design style. Regenerate the
  pictures after design changes with `node scripts/style-demos.js push`, screenshot
  `localhost:8080/styledemo-<style>/` into `agency/site/assets/styles/<style>.webp`, then run
  `node scripts/style-demos.js clean`.
- **Featured reel and portfolio:** all sample sites, filterable by business and style.
- **A landing page per kind of business:** `/websites-for/<niche>/`, for searches like
  "website design for restaurants in Nepal". Edit the words in `agency/niches.json`.
- **SEO:**
  - titles, descriptions and canonical URLs on every page
  - Open Graph and Twitter cards
  - structured data: the business with its price list, the website, FAQs, and breadcrumbs on
    landing pages
  - a sitemap, `robots.txt`, a web manifest, icons and a 404 page

**Publishing it later (optional).** Build with your public address and upload `dist/agency/`
to any static host, e.g. `SITE_URL=https://aishpra.github.io/ npm run agency:build` for GitHub
Pages.

## Going live: launch checklist

Staging runs on your computer. To put a client's site online:

1. **Domain and hosting.** The client buys the domain in their own name (a `.com.np` is free
   for registered Nepali businesses; `.com` is about NPR 1,500 a year). Use WordPress hosting
   with free SSL (https) and daily backups.
2. **WordPress.** Install WordPress and the **Twenty Twenty-Five** theme, then point SiteKit at
   it: set `WP_URL`, `WP_USER` and `WP_APP_PASSWORD` in `.env` (see "Using a WordPress that
   isn't the Docker one" above).
3. **SiteKit plugins.** Run `npm run plugins:zip`, then in wp-admin go to **Plugins → Add New
   → Upload Plugin** and upload and activate all three from `dist/plugins/`: the contact form,
   SiteKit Motion and SiteKit SEO.
4. **Push** the project from SiteKit. Check every page on a phone, a tablet and a laptop.
5. **Email.** Install an SMTP plugin (e.g. WP Mail SMTP) and send a test message through the
   contact form.
6. **Let search engines in.** In **Settings → Reading**, untick "Discourage search engines".
   WordPress then serves `robots.txt` and a sitemap at `/wp-sitemap.xml`.
7. **Google.** Add the site to Google Search Console and submit the sitemap. Create or claim
   the Google Business Profile with the same name, address and phone as the site footer.
8. **Hand over.** Record the training video and share the logins. Agree the care plan.

What SiteKit sets up for search on every site (with SiteKit SEO active): a written title
and description for every page, Open Graph and Twitter sharing tags with an image, and
LocalBusiness structured data on the homepage.

## Known limitations (be honest with clients about these)

- **AI copy is a draft.** Read all of it before the client does. Without AI copy, anything in
  `[square brackets]` on a generated page is a placeholder; the project page counts them.
- **SEO titles and descriptions are not pushed.** WordPress has no field for them without a
  plugin. Copy them from SiteKit into Yoast or Rank Math.
- **Links use the staging address.** Internal links are written as
  `http://localhost:8080/<client>/contact/`. When you move a site to the client's domain, run a
  search-replace for the old address (most migration plugins do this for you).
- **Staging is local.** Clients can't see `localhost`; show them on your screen, or send
  screenshots, until you deploy somewhere public.
- **Pushing again overwrites** any edits you made to those pages in WordPress.
- **Header and footer are replaced** on every push. Edits you make to them in the Site
  Editor are overwritten by the next push.
- **Built for Twenty Twenty-Five.** Other block themes mostly work; classic themes get the
  pages but not the header, footer, colours or animations.
- **Runs locally only.** Clients can't open the intake form until it's deployed somewhere
  with a login. Until then, fill it in yourself from what they send you.
- No authentication: the server listens on `127.0.0.1` only. Don't expose it as-is.

## Checking block markup

The page generator (`src/blocks.js`) writes Gutenberg block markup by hand. If it doesn't
exactly match what the editor saves, WordPress shows "This block contains unexpected or
invalid content". After changing `src/blocks.js`, `src/generator.js` or `src/theme.js`,
push a project and run:

```bash
npm i -D playwright && npx playwright install chromium
```

```bash
npm run check:blocks
```

It checks the most recently pushed project; add a project id to check another
(`npm run check:blocks -- <project-id>`). The current output passes on both test clients,
none invalid.

## Project layout

```
server.js            Express routes
src/intake.js        Intake parsing, validation, gap warnings
src/phases.js        The 7-phase workflow checklist
src/generator.js     Intake → page content (follows the PDF wireframes)
src/pricing.js       Pricing settings and calculator (data/pricing.json)
src/sales-views.js   Pricing page and the printable one-pager
src/staging.js       One staging site per client on the Docker multisite (WP-CLI)
src/copywriter.js    AI copy via the local model: prompt, schema, fact-check, edits
src/theme.js         Header, footer and custom CSS/animations pushed to the theme
src/colour.js        Readable-text-on-brand-colour helpers
src/blocks.js        Gutenberg block markup helpers
public/app.js        UI enhancements: auto-saving checklist, upload previews, toasts
src/wordpress.js     REST API client: media, pages, settings, Global Styles
src/views.js         Server-rendered HTML
scripts/wp-setup.js  Starts and configures the Docker WordPress
scripts/ai-setup.js  Starts Ollama if needed and downloads the model
scripts/seed-samples.js  Loads the sample sites
samples/             Sample businesses: content, logos, CC0 photos, screenshots
scripts/check-blocks.js  Validates generated blocks in the real editor
wordpress/sitekit-contact-form/  The contact form plugin (PHP)
wordpress/htaccess-multisite     Apache rules the multisite needs
```

## Next steps worth considering

- Deploy with a login so clients can fill in the intake and leave review comments themselves
- Export a client's site and move it to their hosting in one step (today: a migration plugin)
