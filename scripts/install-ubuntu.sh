#!/usr/bin/env bash
# One-shot SiteKit setup for Ubuntu / Debian laptops.
# Installs git, Node.js 22 and Docker (only if missing), downloads SiteKit into ~/personal-pp,
# sets up the local WordPress and loads the sample sites. Safe to run again.
set -euo pipefail

REPO="https://github.com/Aishpra/personal-pp.git"
BRANCH="claude/busy-cori-umslq1"
DIR="$HOME/personal-pp"

say() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

if ! command -v apt-get >/dev/null; then
  echo "This script is for Ubuntu/Debian (apt). On Mac or Windows, follow the README instead."
  exit 1
fi

say "Installing git and curl (asks for your password)"
sudo apt-get update -y
sudo apt-get install -y git curl ca-certificates

node_major=$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || echo 0)
if [ "${node_major:-0}" -lt 18 ]; then
  say "Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  say "Node.js $(node -v) already installed"
fi

if ! command -v docker >/dev/null; then
  say "Installing Docker (official install script)"
  curl -fsSL https://get.docker.com | sudo sh
else
  say "Docker already installed"
fi
sudo systemctl enable --now docker >/dev/null 2>&1 || true
if ! id -nG "$USER" | grep -qw docker; then
  sudo usermod -aG docker "$USER"
  echo "Added you to the docker group (takes full effect after you log out and back in)."
fi

if [ -d "$DIR/.git" ]; then
  say "Updating SiteKit in $DIR"
  git -C "$DIR" fetch origin "$BRANCH"
  git -C "$DIR" checkout "$BRANCH"
  git -C "$DIR" pull --ff-only origin "$BRANCH"
else
  say "Downloading SiteKit into $DIR"
  echo "If GitHub asks for a password, use a personal access token: https://github.com/settings/tokens"
  git clone -b "$BRANCH" "$REPO" "$DIR"
fi

cd "$DIR"
say "Installing SiteKit's packages"
npm install --no-audit --no-fund

# The new docker group isn't active in this shell yet; `sg` runs the Docker steps with it.
say "Setting up the local WordPress (first time: about 5 minutes)"
sg docker -c "npm run wp:up"

say "Loading the three sample sites"
sg docker -c "npm run samples -- --push"

say "Done!"
cat <<EOF

Start SiteKit:
  cd ~/personal-pp && npm start
Then open http://localhost:3000

Optional, for "Write copy with AI" (about a 5 GB download):
  cd ~/personal-pp && npm run ai:up

Log out and back in once, so Docker works in every new terminal.
EOF
