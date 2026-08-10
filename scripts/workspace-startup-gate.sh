#!/bin/sh
set -eu

case "${WORKSPACE_IDENTITY:-}" in
  *[!0-9:]*|:*) echo "workspace-startup-gate: invalid expected workspace identity" >&2; exit 1 ;;
esac
[ -n "$WORKSPACE_IDENTITY" ] || { echo "workspace-startup-gate: missing expected workspace identity" >&2; exit 1; }
actual="$(stat -Lc '%d:%i' -- /workspace)" || {
  echo "workspace-startup-gate: workspace identity unavailable" >&2
  exit 1
}
[ "$actual" = "$WORKSPACE_IDENTITY" ] || {
  echo "workspace-startup-gate: mounted workspace identity mismatch" >&2
  exit 1
}
exec "$@"