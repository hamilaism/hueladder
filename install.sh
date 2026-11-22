#!/usr/bin/env bash
# Installs this repository as a Claude Code skill.
#
# The repository IS the skill, so it is linked rather than copied: a `git pull` is all it
# takes to update.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS="${CLAUDE_CONFIG_DIR:-${HOME}/.claude}/skills"
DEST="${SKILLS}/hueladder"

if [ ! -f "${REPO}/SKILL.md" ]; then
  echo "✗ SKILL.md not found: run this script from the repository." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node.js is not installed. It is the only dependency, but it is required." >&2
  exit 1
fi

mkdir -p "${SKILLS}"

if [ -L "${DEST}" ]; then
  current="$(readlink "${DEST}")"
  if [ "${current}" = "${REPO}" ]; then
    echo "✓ Already installed, pointing to this repository."
    exit 0
  fi
  echo "• A link already exists and points elsewhere:"
  echo "    ${current}"
  read -r -p "  Replace it? [y/N] " a
  [[ "${a}" =~ ^[yY]$ ]] || { echo "  Aborted."; exit 0; }
  rm "${DEST}"
elif [ -e "${DEST}" ]; then
  # a real folder: nothing gets destroyed without saying so
  backup="${DEST}.backup-$(date +%Y%m%d-%H%M%S)"
  echo "• A folder ${DEST} already exists (manual install?)."
  echo "  It will be moved to ${backup}"
  read -r -p "  Continue? [y/N] " a
  [[ "${a}" =~ ^[yY]$ ]] || { echo "  Aborted."; exit 0; }
  mv "${DEST}" "${backup}"
fi

ln -s "${REPO}" "${DEST}"
echo "✓ Skill installed: ${DEST} → ${REPO}"
echo
echo "  Check the engine:   node engine/check.mjs"
echo "  Then, in any project, ask Claude Code for work on color scales:"
echo "  the skill triggers on its own."
