// Loads settings from .env (if present) without extra dependencies.
const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', '.env');

function loadEnv() {
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    const value = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

loadEnv();

module.exports = {
  envFile,
  port: Number(process.env.PORT) || 3000,
  // Local AI model for copywriting (Ollama). See README, "AI copy".
  ai: {
    url: (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/+$/, ''),
    model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
  },
  wp: {
    url: (process.env.WP_URL || 'http://localhost:8080').replace(/\/+$/, ''),
    user: process.env.WP_USER || 'admin',
    appPassword: process.env.WP_APP_PASSWORD || '',
  },
};
