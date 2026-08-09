#!/usr/bin/env bash
# Source this file from any directory, then call compose_safe or compose_safe_no_secret.
# The script location, not the caller's cwd or inherited Compose environment,
# selects the only repository and Compose stack this helper can operate on.
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd -P)"
EXPECTED_ROOT="$(git -C "$REPO_ROOT" rev-parse --show-toplevel)"
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

# Lifecycle/runtime operations preserve a caller-provided HERMES_API_KEY.
compose_safe() {
  _compose_safe "$@"
}

# Config rendering and builds do not need a runtime key and must not receive one.
compose_safe_no_secret() {
  HERMES_API_KEY= _compose_safe "$@"
}
