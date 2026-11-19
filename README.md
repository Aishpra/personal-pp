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
- For AI copy: about 8 GB of free RAM and 5 GB of disk for the default model. Either install
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

For AI copy, download the local model once (about 4.7 GB):

```bash
npm run ai:up
```

Open http://localhost:3000, click **New project** and fill in the intake. On the project page,
click **Write copy with AI**, review it, then **Push draft to staging**.

Other commands:

| Command | What it does |
| --- | --- |
| `npm run dev` | Start SiteKit and restart it when files change |
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
scripts/check-blocks.js  Validates generated blocks in the real editor
wordpress/sitekit-contact-form/  The contact form plugin (PHP)
wordpress/htaccess-multisite     Apache rules the multisite needs
```

## Next steps worth considering

- Deploy with a login so clients can fill in the intake and leave review comments themselves
- Export a client's site and move it to their hosting in one step (today: a migration plugin)
