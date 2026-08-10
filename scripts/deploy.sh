#!/bin/bash -p
# Terminal-safe deployment CLI. Execute this file; never source it.
set +x
unset BASH_ENV ENV
set -uo pipefail

# Capture once without exporting it, then blank the inherited environment
# before any child process can run.
unset RUNTIME_HERMES_API_KEY
RUNTIME_HERMES_API_KEY="${HERMES_API_KEY:-}"
readonly RUNTIME_HERMES_API_KEY
export HERMES_API_KEY=
unset COMPOSE_FILE COMPOSE_PROJECT_NAME COMPOSE_PATH_SEPARATOR COMPOSE_ENV_FILES \
  COMPOSE_PROFILES COMPOSE_CONVERT_WINDOWS_PATHS

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)" || exit 1
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd -P)" || exit 1
COMPOSE_FILE="$REPO_ROOT/compose.yaml"
PROJECT_NAME="spock-workspace-dashboard"
RELEASES_DIR="$REPO_ROOT/releases"
TEMP_FILES=()
WORKSPACE_IDENTITY=""
STAGED_CONTAINER=0

log() { printf 'deploy: %s\n' "$*"; }
die() { printf 'deploy: %s\n' "$*" >&2; exit 1; }
cleanup() {
  local file
  if [ "$STAGED_CONTAINER" -eq 1 ]; then
    HERMES_API_KEY= docker compose --project-directory "$REPO_ROOT" --file "$COMPOSE_FILE" \
      --project-name "$PROJECT_NAME" rm -sf dashboard >/dev/null 2>&1 || true
  fi
  for file in "${TEMP_FILES[@]}"; do rm -f -- "$file"; done
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

validate_root() {
  local actual
  actual="$(git -C "$REPO_ROOT" rev-parse --show-toplevel 2>/dev/null)" || die "repository root could not be validated"
  [ "$actual" = "$REPO_ROOT" ] || die "script is outside the validated repository root"
  [ -f "$COMPOSE_FILE" ] || die "missing fixed Compose file"
}

validate_workspace() {
  [ -n "${DASHBOARD_WORKSPACE_PATH:-}" ] || die "set DASHBOARD_WORKSPACE_PATH to an absolute existing workspace directory"
  case "$DASHBOARD_WORKSPACE_PATH" in /*) ;; *) die "DASHBOARD_WORKSPACE_PATH must be absolute" ;; esac
  [ -d "$DASHBOARD_WORKSPACE_PATH" ] || die "DASHBOARD_WORKSPACE_PATH is not a directory"
  DASHBOARD_WORKSPACE_PATH="$(CDPATH= cd -- "$DASHBOARD_WORKSPACE_PATH" && pwd -P)" || die "workspace path could not be resolved"
  [ ! -L "$DASHBOARD_WORKSPACE_PATH" ] || die "resolved workspace must not be a symlink"
  WORKSPACE_IDENTITY="$(stat -Lc '%d:%i' -- "$DASHBOARD_WORKSPACE_PATH" 2>/dev/null)" || die "workspace identity could not be read"
  DASHBOARD_WORKSPACE_IDENTITY="$WORKSPACE_IDENTITY"
  export DASHBOARD_WORKSPACE_PATH DASHBOARD_WORKSPACE_IDENTITY
}

revalidate_workspace() {
  local current
  [ -n "$WORKSPACE_IDENTITY" ] || die "workspace identity was not established"
  [ -d "$DASHBOARD_WORKSPACE_PATH" ] && [ ! -L "$DASHBOARD_WORKSPACE_PATH" ] || \
    die "workspace path replaced or symlinked after validation"
  current="$(stat -Lc '%d:%i' -- "$DASHBOARD_WORKSPACE_PATH" 2>/dev/null)" || \
    die "workspace identity could not be re-read"
  [ "$current" = "$WORKSPACE_IDENTITY" ] || die "workspace identity changed after validation"
}

validate_version() {
  [[ "$1" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] || die "version must be stable numeric SemVer MAJOR.MINOR.PATCH without leading zeroes"
}

validate_manifest() {
  local version="$1" file="$RELEASES_DIR/$1.env" line key value mode path_fingerprint open_fingerprint final_fingerprint manifest_fd
  local release="" tag="" sha="" built="" image=""
  validate_version "$version"
  [ -f "$file" ] && [ ! -L "$file" ] || die "release manifest must be a regular non-symlink file: releases/$version.env"
  mode="$(stat -Lc '%a' -- "$file" 2>/dev/null)" || die "release manifest metadata could not be read"
  [[ "$mode" =~ ^[0-7]{3,4}$ ]] || die "release manifest permissions are invalid"
  (( (8#$mode & 8#022) == 0 )) || die "release manifest must not be group/world writable"
  path_fingerprint="$(stat -Lc '%d:%i:%s:%y:%z' -- "$file")" || die "release manifest identity could not be read"
  exec {manifest_fd}<"$file" || die "release manifest could not be opened"
  open_fingerprint="$(stat -Lc '%d:%i:%s:%y:%z' -- "/proc/self/fd/$manifest_fd")" || die "opened manifest identity could not be read"
  [ "$path_fingerprint" = "$open_fingerprint" ] || die "release manifest changed while opening"
  declare -A seen=()
  while IFS= read -r line || [ -n "$line" ]; do
    [ -z "$line" ] && continue
    [[ "$line" != \#* ]] || continue
    [[ "$line" == *=* ]] || die "invalid manifest line"
    key="${line%%=*}"; value="${line#*=}"
    [[ "$key" =~ ^[A-Z_]+$ ]] || die "invalid manifest key"
    [ -z "${seen[$key]:-}" ] || die "duplicate manifest key: $key"
    seen[$key]=1
    case "$key" in
      RELEASE) release="$value" ;;
      GIT_TAG) tag="$value" ;;
      GIT_SHA) sha="$value" ;;
      BUILT_AT) built="$value" ;;
      DASHBOARD_IMAGE) image="$value" ;;
      *) die "unknown manifest key: $key" ;;
    esac
  done <&"$manifest_fd"
  final_fingerprint="$(stat -Lc '%d:%i:%s:%y:%z' -- "/proc/self/fd/$manifest_fd" 2>/dev/null)" || die "opened manifest metadata could not be re-read"
  [ "$final_fingerprint" = "$open_fingerprint" ] || die "release manifest changed while reading"
  [ "$(stat -Lc '%d:%i:%s:%y:%z' -- "$file" 2>/dev/null)" = "$open_fingerprint" ] || die "release manifest path changed while reading"
  exec {manifest_fd}<&-
  [ "${#seen[@]}" -eq 5 ] || die "manifest must contain exactly five fields"
  [ "$release" = "$version" ] || die "manifest RELEASE does not match version"
  [ "$tag" = "v$version" ] || die "manifest GIT_TAG does not match version"
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || die "manifest GIT_SHA must be a full lowercase commit SHA"
  [[ "$built" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]] || die "manifest BUILT_AT must be UTC ISO-8601"
  [[ "$image" =~ ^ghcr\.io/jeffersonarpasserini/spock-workspace-dashboard:${version}@sha256:[0-9a-f]{64}$ ]] || die "DASHBOARD_IMAGE must be the exact jeffersonarpasserini GHCR version pinned by sha256 digest"
  RELEASE_IMAGE="$image"
  RELEASE_TAG="$tag"
  RELEASE_SHA="$sha"
}

verify_provenance() {
  local installed remote_sha attestation_help required_flag
  command -v gh >/dev/null 2>&1 || die "GitHub CLI gh >= 2.68.0 is required for OCI attestation verification"
  read -r _ _ installed _ < <(HERMES_API_KEY= gh version 2>/dev/null) || \
    die "gh >= 2.68.0 with attestation support is required; upgrade GitHub CLI"
  [[ "$installed" =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]] || die "could not determine a supported gh version"
  [ "$(printf '%s\n' 2.68.0 "$installed" | sort -V | head -n 1)" = 2.68.0 ] || \
    die "gh >= 2.68.0 is required for OCI attestation verification; upgrade GitHub CLI"
  attestation_help="$(HERMES_API_KEY= gh attestation verify --help 2>/dev/null)" || \
    die "gh attestation verify help is unavailable; required OCI capabilities cannot be proven"
  for required_flag in --source-ref --source-digest --bundle-from-oci; do
    grep -Eq "(^|[[:space:]])${required_flag}([=[:space:]]|$)" <<<"$attestation_help" || \
      die "gh attestation verify lacks required ${required_flag} capability; upgrade GitHub CLI"
  done
  remote_sha="$(HERMES_API_KEY= gh api "repos/jeffersonarpasserini/SpockWorkspaceDashboard/commits/$RELEASE_TAG" --jq .sha 2>/dev/null)" || \
    die "authoritative GitHub tag lookup failed; refusing to pull"
  [ "$remote_sha" = "$RELEASE_SHA" ] || die "authoritative GitHub tag does not match manifest GIT_SHA"
  HERMES_API_KEY= gh attestation verify "oci://$RELEASE_IMAGE" \
    --repo jeffersonarpasserini/SpockWorkspaceDashboard \
    --source-ref "refs/tags/$RELEASE_TAG" \
    --source-digest "$RELEASE_SHA" \
    --bundle-from-oci >/dev/null || die "OCI image provenance verification failed; refusing to pull"
}

compose() {
  revalidate_workspace
  docker compose --project-directory "$REPO_ROOT" --file "$COMPOSE_FILE" \
    --project-name "$PROJECT_NAME" "$@"
}
compose_no_secret() { HERMES_API_KEY= compose "$@"; }

compose_existing_no_secret() {
  HERMES_API_KEY= docker compose --project-directory "$REPO_ROOT" --file "$COMPOSE_FILE" \
    --project-name "$PROJECT_NAME" "$@"
}

# Revalidation runs under the globally blank key. The saved key is scoped only
# to this exact Compose up process, with no intervening child process.
compose_up_no_start() {
  revalidate_workspace
  HERMES_API_KEY="$RUNTIME_HERMES_API_KEY" docker compose \
    --project-directory "$REPO_ROOT" --file "$COMPOSE_FILE" \
    --project-name "$PROJECT_NAME" up --no-start "$@"
}

new_temp() {
  local template="${TMPDIR:-/tmp}/spock-deploy.$1.XXXXXX" file
  file="$(mktemp "$template")" || die "could not create temporary file"
  TEMP_FILES+=("$file")
  LAST_TEMP="$file"
}

verify_declared() {
  local json
  new_temp compose.json
  json="$LAST_TEMP"
  compose_no_secret config --format json > "$json" || die "Compose config failed"
  python3 "$SCRIPT_DIR/verify-compose-config.py" "$json" "$DASHBOARD_WORKSPACE_PATH" \
    "${DASHBOARD_PORT:-3011}" "${DASHBOARD_MEMORY_LIMIT:-512m}" "${DASHBOARD_CPUS:-1.0}" \
    "${DASHBOARD_PIDS_LIMIT:-128}" "${DASHBOARD_LOG_MAX_SIZE:-10m}" "${DASHBOARD_LOG_MAX_FILE:-3}" \
    "$WORKSPACE_IDENTITY" || die "declared Compose verification failed"
}

container_id() {
  local cid
  cid="$(compose_no_secret ps -q dashboard 2>/dev/null)" || die "could not query dashboard container"
  [ -n "$cid" ] || die "dashboard container is not running"
  printf '%s\n' "$cid"
}

staged_container_id() {
  local cid
  cid="$(compose_existing_no_secret ps -aq dashboard 2>/dev/null)" || die "could not query staged dashboard container"
  [ -n "$cid" ] || die "dashboard container was not created"
  printf '%s\n' "$cid"
}

wait_healthy() {
  local cid="$1" timeout="${DEPLOY_HEALTH_TIMEOUT:-120}" interval="${DEPLOY_HEALTH_INTERVAL:-2}"
  local start now state
  [[ "$timeout" =~ ^[1-9][0-9]*$ ]] || die "health timeout must be a positive integer"
  [[ "$interval" =~ ^[1-9][0-9]*$ ]] || die "health interval must be a positive integer"
  start="$(date +%s)"
  while :; do
    state="$(HERMES_API_KEY= docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$cid" 2>/dev/null)" || die "Docker health inspection failed"
    case "$state" in
      healthy) return 0 ;;
      unhealthy) die "Docker health is unhealthy" ;;
      starting) ;;
      *) die "Docker healthcheck is missing or invalid" ;;
    esac
    now="$(date +%s)"
    [ $((now - start)) -lt "$timeout" ] || die "timeout waiting for Docker health"
    sleep "$interval"
  done
}

verify_effective() {
  local cid="$1" json
  new_temp effective.json
  json="$LAST_TEMP"
  HERMES_API_KEY= docker inspect --format '{"Entrypoint":{{json .Config.Entrypoint}},"Cmd":{{json .Config.Cmd}},"Privileged":{{json .HostConfig.Privileged}},"Devices":{{json .HostConfig.Devices}},"DeviceRequests":{{json .HostConfig.DeviceRequests}},"DeviceCgroupRules":{{json .HostConfig.DeviceCgroupRules}},"PidMode":{{json .HostConfig.PidMode}},"IpcMode":{{json .HostConfig.IpcMode}},"AppArmorProfile":{{json .AppArmorProfile}},"SecurityOpt":{{json .HostConfig.SecurityOpt}},"CapAdd":{{json .HostConfig.CapAdd}},"CapDrop":{{json .HostConfig.CapDrop}},"PortBindings":{{json .HostConfig.PortBindings}},"Mounts":{{json .Mounts}},"Tmpfs":{{json .HostConfig.Tmpfs}},"Memory":{{json .HostConfig.Memory}},"NanoCpus":{{json .HostConfig.NanoCpus}},"PidsLimit":{{json .HostConfig.PidsLimit}},"LogConfig":{{json .HostConfig.LogConfig}}}' "$cid" > "$json" || die "effective inspection failed"
  HERMES_API_KEY= python3 "$SCRIPT_DIR/verify-container-inspect.py" "$json" "$DASHBOARD_WORKSPACE_PATH" \
    "${DASHBOARD_PORT:-3011}" "${DASHBOARD_MEMORY_LIMIT:-512m}" "${DASHBOARD_CPUS:-1.0}" \
    "${DASHBOARD_PIDS_LIMIT:-128}" "${DASHBOARD_LOG_MAX_SIZE:-10m}" "${DASHBOARD_LOG_MAX_FILE:-3}" \
    || die "effective container verification failed"
}

verify_liveness() {
  local body
  body="$(HERMES_API_KEY= curl --fail --silent --show-error --max-time 10 "http://127.0.0.1:${DASHBOARD_PORT:-3011}/api/health")" || die "HTTP liveness failed"
  HERMES_API_KEY= python3 -c 'import json,sys; raise SystemExit(0 if json.loads(sys.argv[1]) == {"status":"ok"} else 1)' "$body" \
    || die "HTTP liveness payload is invalid"
}

run_verify() {
  local cid
  verify_declared
  cid="$(container_id)"
  wait_healthy "$cid"
  verify_effective "$cid"
  verify_liveness
  log "verification passed"
}

stage_and_start() {
  local cid
  # Arm cleanup before creation so a signal or partial Compose failure cannot
  # leave a staged container behind.
  STAGED_CONTAINER=1
  compose_up_no_start "$@" || die "staged startup creation failed"
  cid="$(staged_container_id)"
  # The daemon-created container is inspected while no application process can
  # serve. Its entrypoint then verifies the mounted inode before execing Node.
  verify_effective "$cid"
  compose_existing_no_secret start dashboard || die "staged startup failed"
  wait_healthy "$cid"
  verify_liveness
  STAGED_CONTAINER=0
}

state_directory() {
  local directory="${DEPLOY_STATE_DIR:-${XDG_STATE_HOME:-${HOME:-/tmp}/.local/state}/spock-workspace-dashboard}"
  case "$directory" in /*) ;; *) die "deployment state directory must be absolute" ;; esac
  printf '%s\n' "$directory"
}

record_release_state() {
  local directory file temporary
  directory="$(state_directory)"
  umask 077
  mkdir -p -- "$directory" || die "could not create deployment state directory"
  chmod 700 -- "$directory" || die "could not secure deployment state directory"
  file="$directory/deployed-release.env"
  temporary="$(mktemp "$directory/.deployed-release.XXXXXX")" || die "could not create deployment state"
  TEMP_FILES+=("$temporary")
  printf 'RELEASE=%s\nDASHBOARD_IMAGE=%s\n' "$1" "$RELEASE_IMAGE" >"$temporary" || die "could not write deployment state"
  chmod 600 -- "$temporary" || die "could not secure deployment state"
  mv -f -- "$temporary" "$file" || die "could not publish deployment state"
}

show_release_state() {
  local file release=""
  file="$(state_directory)/deployed-release.env"
  if [ -f "$file" ] && [ ! -L "$file" ]; then
    while IFS='=' read -r key value; do [ "$key" = RELEASE ] && release="$value"; done <"$file"
    if [[ "$release" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
      log "deployed immutable release $release"
    fi
  fi
}

main() {
  local command="${1:-}"
  validate_root
  case "$command" in
    validate)
      validate_workspace
      if [ -n "${2:-}" ]; then validate_manifest "$2"; DASHBOARD_IMAGE="$RELEASE_IMAGE"; export DASHBOARD_IMAGE; fi
      verify_declared
      log "validation passed"
      ;;
    local|build)
      validate_workspace
      DASHBOARD_IMAGE="spock-workspace-dashboard:local"; export DASHBOARD_IMAGE
      verify_declared
      compose_no_secret build || die "local build failed"
      if [ "$command" = local ]; then stage_and_start; fi
      ;;
    status)
      validate_workspace
      compose_no_secret ps || die "status failed"
      show_release_state
      ;;
    verify)
      validate_workspace
      run_verify
      ;;
    down)
      validate_workspace
      compose_no_secret down || die "down failed"
      rm -f -- "$(state_directory)/deployed-release.env"
      ;;
    "") die "usage: scripts/deploy.sh validate [version] | local | build | <version> | status | verify | down" ;;
    *)
      validate_workspace
      validate_manifest "$command"
      DASHBOARD_IMAGE="$RELEASE_IMAGE"; export DASHBOARD_IMAGE
      verify_declared
      verify_provenance
      compose_no_secret pull || die "release pull failed"
      stage_and_start --no-build
      record_release_state "$command"
      log "release $command deployed by digest"
      ;;
  esac
}

main "$@"
