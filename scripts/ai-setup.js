#!/usr/bin/env node
// Gets the local AI model ready: uses Ollama if it's already running on this computer,
// otherwise starts it in Docker, then downloads the model (once; several GB).
const { spawnSync } = require('child_process');
const path = require('path');
const config = require('../src/config');

const ROOT = path.join(__dirname, '..');

async function up() {
  try {
    const res = await fetch(`${config.ai.url}/api/version`, { signal: AbortSignal.timeout(2000) });
    return res.ok ? (await res.json()).version : null;
  } catch {
    return null;
  }
}

async function main() {
  let version = await up();
  if (version) {
    console.log(`Ollama ${version} is already running at ${config.ai.url}.`);
  } else {
    console.log('Ollama is not running. Starting it in Docker...');
    const res = spawnSync('docker', ['compose', '--profile', 'ai', 'up', '-d', 'ollama'], { cwd: ROOT, stdio: 'inherit' });
    if (res.error || res.status !== 0) {
      console.error('\nCould not start Ollama in Docker. Either start Docker Desktop, or install Ollama from https://ollama.com and run this again.');
      process.exit(1);
    }
    for (let i = 0; i < 30 && !version; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      version = await up();
    }
    if (!version) {
      console.error('Ollama did not start. Check: docker compose logs ollama');
      process.exit(1);
    }
  }

  console.log(`Downloading model ${config.ai.model} (skipped if already downloaded; the first time can take several minutes)...`);
  const res = await fetch(`${config.ai.url}/api/pull`, {
    method: 'POST',
    body: JSON.stringify({ model: config.ai.model, stream: true }),
  });
  if (!res.ok) {
    console.error(`Download failed: HTTP ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  // Stream progress lines: {"status":"pulling ...","completed":n,"total":m}
  const decoder = new TextDecoder();
  let buffer = '';
  let last = '';
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      if (msg.error) {
        console.error(`\nDownload failed: ${msg.error}`);
        process.exit(1);
      }
      const pct = msg.total ? ` ${Math.floor((msg.completed / msg.total) * 100)}%` : '';
      const text = `${msg.status}${pct}`;
      if (text !== last) {
        process.stdout.write(`\r${text.padEnd(60)}`);
        last = text;
      }
    }
  }
  console.log(`\n\nReady. SiteKit will write copy with ${config.ai.model}, offline.`);
  console.log('Restart SiteKit (npm start) if it is already running.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
