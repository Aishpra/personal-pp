// Homepage thumbnails for the dashboard: a headless Chromium screenshot of the staging
// site after each build (640x400, the top of the page at desktop width). Optional: if no
// Chromium is installed, the dashboard shows the logo instead.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const DIR = path.join(__dirname, '..', 'data', 'thumbs');
const CANDIDATES = [process.env.CHROME_BIN, 'chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'].filter(Boolean);

let browser; // resolved binary, or null when none is installed
function findBrowser() {
  if (browser !== undefined) return browser;
  const dirs = (process.env.PATH || '').split(path.delimiter);
  browser = null;
  for (const name of CANDIDATES) {
    const hit = path.isAbsolute(name) ? (fs.existsSync(name) ? name : null) : dirs.map((d) => path.join(d, name)).find((p) => fs.existsSync(p));
    if (hit) {
      browser = hit;
      break;
    }
  }
  return browser;
}

const fileFor = (id) => path.join(DIR, `${id.replace(/[^a-z0-9-]/gi, '')}.png`);
const exists = (id) => fs.existsSync(fileFor(id));

// One capture at a time: each one starts a browser.
let chain = Promise.resolve();
function capture(project) {
  const url = project.wordpress?.siteUrl;
  const bin = findBrowser();
  if (!url || !bin) return Promise.resolve(false);
  chain = chain.then(
    () =>
      new Promise((resolve) => {
        fs.mkdirSync(DIR, { recursive: true });
        const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sitekit-thumb-'));
        const out = fileFor(project.id);
        const args = [
          '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-prefers-reduced-motion',
          `--user-data-dir=${profile}`, '--window-size=1280,800', '--force-device-scale-factor=0.5', '--virtual-time-budget=6000',
          `--screenshot=${out}.tmp.png`, `${url}/`,
        ];
        execFile(bin, args, { timeout: 45000 }, (err) => {
          fs.rmSync(profile, { recursive: true, force: true });
          if (!err && fs.existsSync(`${out}.tmp.png`)) {
            fs.renameSync(`${out}.tmp.png`, out);
            return resolve(true);
          }
          fs.rmSync(`${out}.tmp.png`, { force: true });
          resolve(false);
        });
      })
  );
  return chain;
}

function remove(id) {
  fs.rmSync(fileFor(id), { force: true });
}

module.exports = { capture, exists, fileFor, remove, findBrowser, DIR };
