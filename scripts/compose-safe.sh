#!/usr/bin/env bash
# Compatibility library only. Prefer executing scripts/deploy.sh as a child process.
# This file intentionally does not mutate shell options when loaded by legacy callers.
# Its own location, not the caller's cwd or inherited Compose environment, selects the stack.

case "${BASH_SOURCE[0]}" in */*) _COMPOSE_SAFE_DIR="${BASH_SOURCE[0]%/*}" ;; *) _COMPOSE_SAFE_DIR=. ;; esac
SCRIPT_DIR="$(CDPATH= cd -- "$_COMPOSE_SAFE_DIR" && pwd -P)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd -P)"
EXPECTED_ROOT="$(HERMES_API_KEY= git -C "$REPO_ROOT" rev-parse --show-toplevel)"
unset _COMPOSE_SAFE_DIR
[ "$EXPECTED_ROOT" = "$REPO_ROOT" ] || {
  echo "compose-safe: script is not inside the validated repository root" >&2
  return 1 2>/dev/null || exit 1
}
[ -f "$REPO_ROOT/compose.yaml" ] || {
  echo "compose-safe: missing $REPO_ROOT/compose.yaml" >&2
  return 1 2>/dev/null || exit 1
}
readonly REPO_ROOT

_compose_safe() {
  env \
    -u COMPOSE_FILE \
    -u COMPOSE_PROJECT_NAME \
    -u COMPOSE_PATH_SEPARATOR \
    -u COMPOSE_ENV_FILES \
    -u COMPOSE_PROFILES \
    -u COMPOSE_CONVERT_WINDOWS_PATHS \
    docker compose \
      --project-directory "$REPO_ROOT" \
      --file "$REPO_ROOT/compose.yaml" \
      --project-name spock-workspace-dashboard \
      "$@"
}

# Legacy helper operations never carry a runtime key. Deployment with a key is
# available only through the dedicated executable deploy.sh path.
compose_safe() {
  HERMES_API_KEY= _compose_safe "$@"
}

# Config rendering and builds do not need a runtime key and must not receive one.
compose_safe_no_secret() {
  HERMES_API_KEY= _compose_safe "$@"
}
