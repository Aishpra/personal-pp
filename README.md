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
5. **Client review**: tracks feedback deadlines and revision rounds, and flags billable rounds after 2.
6. **LocalBusiness schema**: JSON-LD you can paste into your SEO plugin.

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

This starts WordPress at http://localhost:8080 in Docker, installs it, switches to the
Twenty Twenty-Five theme, and writes the login and an Application Password into `.env`.
It's safe to re-run.

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
| `npm run wp:reset` | Delete the WordPress database and start fresh |
| `npm test` | Unit tests for intake parsing and page generation |
| `npm run check:blocks` | Opens every generated page in the real WordPress editor and reports invalid blocks (needs Playwright, see below) |

### Using a WordPress that isn't the Docker one

Set `WP_URL`, `WP_USER` and `WP_APP_PASSWORD` in `.env` (copy `.env.example`). Create the
password in wp-admin under **Users → Profile → Application Passwords**. The user must be an
administrator. Use a block theme (e.g. Twenty Twenty-Five) for brand colours to apply.

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
- **One staging WordPress for all projects.** Pushing a project replaces the site title, logo
  and pages on the staging site. Work on one client at a time, or point `WP_URL` at a
  different WordPress per client.
- **Pushing again overwrites** any edits you made to those pages in WordPress.
- **No contact form.** Core WordPress doesn't have one. Install a form plugin and replace the
  placeholder on the Contact page.
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

The current output passes: 187 blocks across Home, About, Services, Contact, header and footer, none invalid.

## Project layout

```
server.js            Express routes
src/intake.js        Intake parsing, validation, gap warnings
src/phases.js        The 7-phase workflow checklist
src/generator.js     Intake → page content (follows the PDF wireframes)
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
```

## Next steps worth considering

- Deploy with a login so clients can fill in the intake and leave review comments themselves
- One staging site per client (WordPress Multisite, or one Docker stack per project)
