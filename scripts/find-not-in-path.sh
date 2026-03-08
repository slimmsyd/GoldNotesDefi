#!/usr/bin/env bash
# Find executables in common install locations that are NOT in current PATH.
# Usage: ./scripts/find-not-in-path.sh   or   bash scripts/find-not-in-path.sh

set -e
PATH_COLON=":${PATH}:"

check_dir() {
  local dir="$1"
  local label="${2:-$dir}"
  if [[ ! -d "$dir" ]]; then return; fi
  local count=0
  local first=""
  while IFS= read -r -d '' f; do
    ((count++)) || true
    if [[ -z "$first" ]]; then first="$f"; fi
  done < <(find "$dir" -maxdepth 1 -type f -perm +111 -print0 2>/dev/null)
  # also count symlinks to executables
  while IFS= read -r -d '' f; do
    ((count++)) || true
    if [[ -z "$first" ]]; then first="$f"; fi
  done < <(find "$dir" -maxdepth 1 -type l -print0 2>/dev/null)
  if [[ "$count" -eq 0 ]]; then return; fi
  if [[ "$PATH_COLON" == *":${dir}:"* ]]; then
    echo "[IN PATH]  $label ($count executables)"
  else
    echo "[NOT IN PATH]  $label ($count executables)"
    # show first few entries
    ls -1 "$dir" 2>/dev/null | head -8 | sed 's/^/    /'
    if [[ $(ls -1 "$dir" 2>/dev/null | wc -l) -gt 8 ]]; then echo "    ..."; fi
  fi
}

echo "Common install locations vs current PATH:"
echo ""

check_dir "$HOME/.cargo/bin" "~/.cargo/bin (Rust, Solana, Anchor, etc.)"
check_dir "$HOME/.nvm/versions/node/current/bin" "~/.nvm node current"
check_dir "$HOME/.local/bin" "~/.local/bin"
check_dir "$HOME/go/bin" "~/go/bin (Go)"
check_dir "/opt/homebrew/bin" "/opt/homebrew/bin"
check_dir "/opt/homebrew/sbin" "/opt/homebrew/sbin"
check_dir "/usr/local/bin" "/usr/local/bin"
check_dir "$HOME/.yarn/bin" "~/.yarn/bin"
check_dir "$HOME/.volta/bin" "~/.volta/bin"
check_dir "$HOME/.rbenv/shims" "~/.rbenv/shims"
check_dir "$HOME/.pyenv/shims" "~/.pyenv/shims"
check_dir "$HOME/.jenv/bin" "~/.jenv/bin"
check_dir "$HOME/bin" "~/bin"
check_dir "$HOME/.npm-global/bin" "~/.npm-global/bin"
check_dir "$HOME/Library/Android/sdk/platform-tools" "Android SDK platform-tools"
check_dir "$HOME/Library/Android/sdk/cmdline-tools/latest/bin" "Android cmdline-tools"
check_dir "$HOME/flutter/bin" "Flutter SDK"
check_dir "$HOME/.bun/bin" "~/.bun/bin"

echo ""
echo "Homebrew opt bins (versioned tools; only in PATH if linked):"
for opt in /opt/homebrew/opt/node/bin /opt/homebrew/opt/postgresql@16/bin /opt/homebrew/opt/openjdk@17/bin; do
  if [[ -d "$opt" ]]; then
    if [[ "$PATH_COLON" == *":${opt}:"* ]]; then
      echo "[IN PATH]  $opt"
    else
      echo "[NOT IN PATH]  $opt"
    fi
  fi
done
