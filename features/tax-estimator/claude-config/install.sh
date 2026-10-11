#!/usr/bin/env bash
# Copyright 2026 Kisaes LLC
# Licensed under the PolyForm Small Business License 1.0.0.
# Free for small businesses; see LICENSE for terms.
#
# Installs the Tax Estimator subagents into the repo's git-ignored .claude/
# directory. Run from the repo root:  bash features/tax-estimator/claude-config/install.sh
# The committed copies under features/tax-estimator/claude-config/ are the
# source of truth; re-run after editing them.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SRC="$ROOT/features/tax-estimator/claude-config"
mkdir -p "$ROOT/.claude/agents"
n=0
for f in "$SRC"/agents/*.md; do cp "$f" "$ROOT/.claude/agents/"; n=$((n+1)); done
echo "installed $n agent definitions into .claude/agents/"
if [ -f "$ROOT/.claude/settings.json" ]; then
  echo "NOTE: .claude/settings.json already exists — merge these keys by hand:"
  cat "$SRC/settings.tax-estimator.json"
else
  cp "$SRC/settings.tax-estimator.json" "$ROOT/.claude/settings.json"
  echo "wrote .claude/settings.json (opusplan main model, sonnet default subagent, 4 concurrent)"
fi
echo "Now run /agents inside Claude Code and confirm 12 agents."
