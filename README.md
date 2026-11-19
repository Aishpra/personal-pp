# SiteKit

An internal tool for running a done-for-you WordPress website service, built from the
"WordPress Site Creation Service" plan (intake → strategy → copy → build → SEO → review → launch).

It is **not** an AI website builder. What it does:

1. **Intake form**: collects everything the plan needs from a client (business, services,
   contact/location, logo, photos, brand colours, pages, domain/hosting). It rejects files
   WordPress can't use (SVG/AI logos) and **flags gaps** that will cause rework later
   (short description, no services, no address, low-resolution logo, no testimonials).
2. **Project tracker**: the 7 phases from the plan as a checklist, showing whether the
   project is waiting on you or on the client.
3. **Push draft to staging**: one click turns the intake into a WordPress site that follows
   the PDF wireframes. It uploads the logo and photos, creates Home / About / Services / Contact
   (and Blog) pages from real Gutenberg blocks, and sets the site title, logo, favicon,
   front page and brand colours.
4. **Client review**: tracks feedback deadlines and revision rounds, and flags billable rounds after 2.
5. **LocalBusiness schema**: JSON-LD you can paste into your SEO plugin.

## Requirements

- [Node.js](https://nodejs.org) 18 or newer
- [Docker Desktop](https://docs.docker.com/get-docker/), for the local staging WordPress

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

Open http://localhost:3000, click **New project**, fill in the intake, then click
**Push draft to staging** on the project page.

Other commands:

| Command | What it does |
| --- | --- |
| `npm run dev` | Start SiteKit and restart it when files change |
| `npm run wp:down` | Stop WordPress (keeps its data) |
| `npm run wp:reset` | Delete the WordPress database and start fresh |
| `npm test` | Unit tests for intake parsing and page generation |

### Using a WordPress that isn't the Docker one

Set `WP_URL`, `WP_USER` and `WP_APP_PASSWORD` in `.env` (copy `.env.example`). Create the
password in wp-admin under **Users → Profile → Application Passwords**. The user must be an
administrator. Use a block theme (e.g. Twenty Twenty-Five) for brand colours to apply.

## Where things are stored

- `data/<project>.json`: one file per project
- `uploads/<project>/`: the client's logo and photos

Both folders are git-ignored on purpose, because they hold client data. Back them up yourself.

## Known limitations (be honest with clients about these)

- **Copy is templated, not written.** Anything in `[square brackets]` on a generated page is a
  placeholder. The project page counts how many are left on each page.
- **One staging WordPress for all projects.** Pushing a project replaces the site title, logo
  and pages on the staging site. Work on one client at a time, or point `WP_URL` at a
  different WordPress per client.
- **Pushing again overwrites** any edits you made to those pages in WordPress.
- **No contact form.** Core WordPress doesn't have one. Install a form plugin and replace the
  placeholder on the Contact page.
- **The theme footer** still has Twenty Twenty-Five's demo links. Edit it once in
  Appearance → Editor → Patterns → Footer.
- **Runs locally only.** Clients can't open the intake form until it's deployed somewhere
  with a login. Until then, fill it in yourself from what they send you.
- No authentication: the server listens on `127.0.0.1` only. Don't expose it as-is.

## Checking block markup

The page generator (`src/blocks.js`) writes Gutenberg block markup by hand. If it doesn't
exactly match what the editor saves, WordPress shows "This block contains unexpected or
invalid content". After changing `src/blocks.js` or `src/generator.js`, push a project and
open each page in the WordPress editor to check. The current output was checked that way
(0 invalid blocks out of 111 across the four pages).

## Project layout

```
server.js            Express routes
src/intake.js        Intake parsing, validation, gap warnings
src/phases.js        The 7-phase workflow checklist
src/generator.js     Intake → page content (follows the PDF wireframes)
src/blocks.js        Gutenberg block markup helpers
src/wordpress.js     REST API client: media, pages, settings, Global Styles
src/views.js         Server-rendered HTML
scripts/wp-setup.js  Starts and configures the Docker WordPress
```

## Next steps worth considering

- AI-drafted copy from the intake to replace the `[Draft]` placeholders (the biggest time saver,
  but it needs an API key and review of every line before it reaches the client)
- Deploy with a login so clients can fill in the intake and leave review comments themselves
- One staging site per client (WordPress Multisite, or one Docker stack per project)
