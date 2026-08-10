import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const deploy = resolve(root, "scripts/deploy.sh");
const digest = `sha256:${"a".repeat(64)}`;
const harnessDirectories: string[] = [];

afterEach(() => {
  for (const directory of harnessDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
  rmSync(resolve(root, "releases/1.2.3.env"), { force: true });
});

function manifest(version = "1.2.3", image = `ghcr.io/jeffersonarpasserini/spock-workspace-dashboard:${version}@${digest}`) {
  return [
    `RELEASE=${version}`,
    `GIT_TAG=v${version}`,
    `GIT_SHA=${"b".repeat(40)}`,
    "BUILT_AT=2026-08-09T12:00:00Z",
    `DASHBOARD_IMAGE=${image}`,
    "",
  ].join("\n");
}

function run(args: string[], env: Record<string, string | undefined> = {}) {
  return spawnSync(deploy, args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...env } as NodeJS.ProcessEnv,
  });
}

function fixtureHarness(health = "healthy") {
  const dir = mkdtempSync(join(root, ".spock-deploy-test-"));
  harnessDirectories.push(dir);
  const bin = join(dir, "bin");
  const workspace = join(dir, "workspace");
  const log = join(dir, "calls.log");
  mkdirSync(bin);
  mkdirSync(workspace);
  const workspaceStat = statSync(workspace);
  const workspaceIdentity = `${workspaceStat.dev}:${workspaceStat.ino}`;
  const declared = JSON.stringify({ services: { dashboard: {
    environment: { HERMES_API_KEY: "", WORKSPACE_IDENTITY: workspaceIdentity }, read_only: true, privileged: false,
    mem_limit: "512m", cpus: 1, pids_limit: 128,
    logging: { driver: "local", options: { "max-size": "10m", "max-file": "3" } },
    cap_drop: ["ALL"], security_opt: ["no-new-privileges:true"],
    ports: [{ host_ip: "127.0.0.1", published: "3011", target: 3000, protocol: "tcp" }],
    volumes: [{ type: "bind", source: workspace, target: "/workspace", read_only: true }],
    tmpfs: ["/tmp:size=64m,mode=1777"],
  } } });
  const effective = JSON.stringify({
    Entrypoint: ["/usr/local/bin/workspace-startup-gate"], Cmd: ["node", "server.js"],
    User: "node", ReadonlyRootfs: true,
    Privileged: false, Devices: [], DeviceRequests: [], DeviceCgroupRules: [],
    PidMode: "", IpcMode: "private", AppArmorProfile: "docker-default",
    SecurityOpt: ["no-new-privileges:true"], Memory: 512 * 1024 * 1024,
    NanoCpus: 1_000_000_000, PidsLimit: 128,
    LogConfig: { Type: "local", Config: { "max-size": "10m", "max-file": "3" } },
    CapAdd: null, CapDrop: ["ALL"],
    PortBindings: { "3000/tcp": [{ HostIp: "127.0.0.1", HostPort: "3011" }] },
    Mounts: [{ Type: "bind", Source: workspace, Destination: "/workspace", RW: false }],
    Tmpfs: { "/tmp": "size=64m,mode=1777" },
  });
  const docker = `#!/usr/bin/env bash\nstate=EMPTY; [ -z "\${HERMES_API_KEY:-}" ] || state=SET\nalias_state=EMPTY; [ -z "\${RUNTIME_HERMES_API_KEY:-}" ] || alias_state=SET\nprintf 'env=%s docker %s alias=%s\\n' "$state" "$*" "$alias_state" >>"$MOCK_LOG"\nif [[ "$1" == "exec" ]]; then [ "\${RUNTIME_VERIFY_HANG:-}" != 1 ] || /usr/bin/sleep 30; exit "\${RUNTIME_VERIFY_RC:-0}"; fi\nif [[ "$*" == *"config --format json"* ]]; then printf '%s\\n' "$DECLARED"; if [[ "\${MUTATE_WORKSPACE_AFTER_CONFIG:-}" == 1 ]]; then replacement="$(mktemp -d "$MOCK_LOG.replacement.XXXXXX")"; rm -rf -- "$DASHBOARD_WORKSPACE_PATH"; mv -- "$replacement" "$DASHBOARD_WORKSPACE_PATH"; fi; exit 0; fi\nif [[ "$*" == *" up --no-start"* ]]; then if [[ "\${MUTATE_WORKSPACE_DURING_UP:-}" == 1 ]]; then replacement="$(mktemp -d "$MOCK_LOG.replacement.XXXXXX")"; rm -rf -- "$DASHBOARD_WORKSPACE_PATH"; mv -- "$replacement" "$DASHBOARD_WORKSPACE_PATH"; fi; /usr/bin/stat -Lc '%d:%i' -- "$DASHBOARD_WORKSPACE_PATH" >"$MOCK_LOG.mount-identity"; exit 0; fi\nif [[ "$*" == *"ps -q dashboard"* || "$*" == *"ps -aq dashboard"* ]]; then echo cid123; exit 0; fi\nif [[ "$*" == "inspect --format {{if .State.Health}}"* ]]; then mounted="$(/usr/bin/cat "$MOCK_LOG.mount-identity" 2>/dev/null || true)"; if [[ -n "$mounted" && "$mounted" != "$DASHBOARD_WORKSPACE_IDENTITY" ]]; then echo unhealthy; else echo "$HEALTH"; fi; exit 0; fi\nif [[ "$*" == "inspect --format {"* ]]; then printf '%s\\n' "$EFFECTIVE"; exit 0; fi\nexit 0\n`;
  writeFileSync(join(bin, "docker"), docker);
  writeFileSync(join(bin, "curl"), `#!/usr/bin/env bash\nstate=EMPTY; [ -z "\${HERMES_API_KEY:-}" ] || state=SET\nalias_state=EMPTY; [ -z "\${RUNTIME_HERMES_API_KEY:-}" ] || alias_state=SET\nprintf 'env=%s curl %s alias=%s\\n' "$state" "$*" "$alias_state" >>"$MOCK_LOG"\nprintf '{"status":"ok"}\\n'\n`);
  writeFileSync(join(bin, "gh"), `#!/usr/bin/env bash\nstate=EMPTY; [ -z "\${HERMES_API_KEY:-}" ] || state=SET\nalias_state=EMPTY; [ -z "\${RUNTIME_HERMES_API_KEY:-}" ] || alias_state=SET\nprintf 'env=%s gh %s alias=%s\\n' "$state" "$*" "$alias_state" >>"$MOCK_LOG"\nif [[ "$1" == version && "$#" -eq 1 ]]; then printf 'gh version %s (2026-01-01)\\nhttps://github.com/cli/cli/releases/tag/v%s\\n' "\${GH_VERSION:-2.68.0}" "\${GH_VERSION:-2.68.0}"; exit 0; fi\nif [[ "$*" == "attestation verify --help" ]]; then printf '%s\\n' '      --source-ref string' '      --source-digest string' "\${GH_HELP_BUNDLE_FLAG:---bundle-from-oci}"; exit 0; fi\nif [[ "$*" == "api repos/jeffersonarpasserini/SpockWorkspaceDashboard/commits/v1.2.3 --jq .sha" ]]; then printf '%s\\n' "${"b".repeat(40)}"; exit 0; fi\nif [[ "$1" == attestation && "$2" == verify ]]; then exit "\${GH_ATTEST_RC:-0}"; fi\nexit 1\n`);
  for (const [name, target] of Object.entries({
    git: "/usr/bin/git", stat: "/usr/bin/stat", mktemp: "/usr/bin/mktemp",
    mkdir: "/usr/bin/mkdir", chmod: "/usr/bin/chmod", mv: "/usr/bin/mv",
    rm: "/usr/bin/rm", python3: "/usr/local/bin/python3", timeout: "/usr/bin/timeout",
  })) {
    writeFileSync(join(bin, name), `#!/usr/bin/env bash\nstate=EMPTY; [ -z "\${HERMES_API_KEY:-}" ] || state=SET\nalias_state=EMPTY; [ -z "\${RUNTIME_HERMES_API_KEY:-}" ] || alias_state=SET\nprintf 'env=%s ${name} %s alias=%s\\n' "$state" "$*" "$alias_state" >>"$MOCK_LOG"\nexec ${target} "$@"\n`);
    chmodSync(join(bin, name), 0o755);
  }
  chmodSync(join(bin, "docker"), 0o755);
  chmodSync(join(bin, "curl"), 0o755);
  chmodSync(join(bin, "gh"), 0o755);
  return { dir, workspace, log, env: {
    PATH: `${bin}:${process.env.PATH}`, MOCK_LOG: log, DECLARED: declared,
    EFFECTIVE: effective, HEALTH: health, DASHBOARD_WORKSPACE_PATH: workspace,
    DEPLOY_HEALTH_TIMEOUT: "1", DEPLOY_HEALTH_INTERVAL: "1", DEPLOY_STATE_DIR: join(dir, "state"),
  } };
}

describe("versioned deployment export", () => {
  it("accepts only stable numeric SemVer and the exact immutable publisher image", () => {
    const harness = fixtureHarness();
    mkdirSync(resolve(root, "releases"), { recursive: true });
    writeFileSync(resolve(root, "releases/1.2.3.env"), manifest());
    expect(run(["validate", "1.2.3"], harness.env).status).toBe(0);
    for (const [name, image] of [
      ["mutable", "ghcr.io/jeffersonarpasserini/spock-workspace-dashboard:1.2.3"],
      ["foreign registry", `docker.io/jeffersonarpasserini/spock-workspace-dashboard:1.2.3@${digest}`],
      ["foreign publisher", `ghcr.io/example/spock-workspace-dashboard:1.2.3@${digest}`],
      ["mismatch", `ghcr.io/jeffersonarpasserini/spock-workspace-dashboard:9.9.9@${digest}`],
    ]) {
      writeFileSync(resolve(root, "releases/1.2.3.env"), manifest("1.2.3", image));
      const result = run(["validate", "1.2.3"], harness.env);
      expect(result.status, name).not.toBe(0);
      expect(result.stderr, name).toMatch(/^deploy: /);
    }
    writeFileSync(resolve(root, "releases/1.2.3.env"), manifest());

    for (const invalid of ["1.2.3-alpha", "1.2.3+build", "01.2.3", "1.02.3", "1.2.03", "v1.2.3", "1.2", "1.2.3.4"]) {
      const result = run(["validate", invalid], harness.env);
      expect(result.status, invalid).not.toBe(0);
      expect(result.stderr, invalid).toContain("stable numeric SemVer");
    }
  });

  it("rejects manifest symlinks and group/world-writable manifest files", () => {
    const harness = fixtureHarness();
    mkdirSync(resolve(root, "releases"), { recursive: true });
    const target = join(harness.dir, "manifest.env");
    writeFileSync(target, manifest());
    symlinkSync(target, resolve(root, "releases/1.2.3.env"));
    expect(run(["validate", "1.2.3"], harness.env).stderr).toContain("regular non-symlink");
    rmSync(resolve(root, "releases/1.2.3.env"));
    writeFileSync(resolve(root, "releases/1.2.3.env"), manifest());
    chmodSync(resolve(root, "releases/1.2.3.env"), 0o666);
    expect(run(["validate", "1.2.3"], harness.env).stderr).toContain("must not be group/world writable");
    const cli = readFileSync(deploy, "utf8");
    expect(cli).toContain("%d:%i:%s:%y:%z");
    expect(cli).toContain('/proc/self/fd/$manifest_fd');
  });

  it("verifies authoritative tag/commit and OCI provenance before pulling", () => {
    const harness = fixtureHarness();
    mkdirSync(resolve(root, "releases"), { recursive: true });
    writeFileSync(resolve(root, "releases/1.2.3.env"), manifest());
    const result = run(["1.2.3"], harness.env);
    expect(result.status, result.stderr).toBe(0);
    const calls = readFileSync(harness.log, "utf8");
    expect(calls).toContain("gh version");
    expect(calls).toContain("gh api repos/jeffersonarpasserini/SpockWorkspaceDashboard/commits/v1.2.3 --jq .sha");
    expect(calls).toContain(`gh attestation verify oci://ghcr.io/jeffersonarpasserini/spock-workspace-dashboard:1.2.3@${digest} --repo jeffersonarpasserini/SpockWorkspaceDashboard --source-ref refs/tags/v1.2.3 --source-digest ${"b".repeat(40)} --bundle-from-oci`);
    expect(calls.indexOf("gh attestation verify")).toBeLessThan(calls.indexOf(" pull"));
  });

  it("requires gh 2.68 or newer and probes every required attestation capability", () => {
    const harness = fixtureHarness();
    mkdirSync(resolve(root, "releases"), { recursive: true });
    writeFileSync(resolve(root, "releases/1.2.3.env"), manifest());
    const old = run(["1.2.3"], { ...harness.env, GH_VERSION: "2.67.9" });
    expect(old.status).not.toBe(0);
    expect(old.stderr).toContain("gh >= 2.68.0");
    const missingFlag = run(["1.2.3"], { ...harness.env, GH_HELP_BUNDLE_FLAG: "--unrelated" });
    expect(missingFlag.status).not.toBe(0);
    expect(missingFlag.stderr).toContain("--bundle-from-oci");
    const supported = run(["1.2.3"], { ...harness.env, GH_VERSION: "2.68.0" });
    expect(supported.status, supported.stderr).toBe(0);
    expect(readFileSync(harness.log, "utf8")).toContain("gh attestation verify --help");
  });

  it("fails closed when attestation verification rejects the release", () => {
    const harness = fixtureHarness();
    mkdirSync(resolve(root, "releases"), { recursive: true });
    writeFileSync(resolve(root, "releases/1.2.3.env"), manifest());
    const failed = run(["1.2.3"], { ...harness.env, GH_ATTEST_RC: "1" });
    expect(failed.status).not.toBe(0);
    expect(failed.stderr).toContain("provenance verification failed");
    expect(readFileSync(harness.log, "utf8")).not.toContain(" pull");
  });

  it("cannot close or mutate the caller shell when validation fails", () => {
    const probe = spawnSync("bash", ["-c", `set +e +u; before="$-"; "${deploy}" validate 9.9.9 >/dev/null 2>&1; rc=$?; after="$-"; printf 'alive:%s:%s:%s\\n' "$rc" "$before" "$after"`], { encoding: "utf8" });
    expect(probe.status).toBe(0);
    expect(probe.stdout).toMatch(/^alive:[1-9][0-9]*:([^:]+):\1\n$/);
  });

  it("suppresses hostile Bash startup hooks and inherited tracing before reading the runtime secret", () => {
    const directory = mkdtempSync(join(root, ".spock-bash-startup-test-"));
    harnessDirectories.push(directory);
    const hook = join(directory, "bash-env.sh");
    const observed = join(directory, "observed-secret");
    const sentinel = "sentinel-runtime-key-must-not-appear";
    writeFileSync(hook, 'printf "%s" "$HERMES_API_KEY" >"$HOOK_OUTPUT"\n');
    const result = run([], {
      BASH_ENV: hook,
      ENV: hook,
      HOOK_OUTPUT: observed,
      HERMES_API_KEY: sentinel,
      PS4: `trace:${sentinel}:`,
      SHELLOPTS: "braceexpand:hashall:interactive-comments:xtrace",
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).not.toContain(sentinel);
    expect(() => readFileSync(observed, "utf8")).toThrow();
    const cli = readFileSync(deploy, "utf8");
    expect(cli.startsWith("#!/bin/bash -p\n")).toBe(true);
    expect(cli).toMatch(/^set \+x$/m);
  });

  it("keeps legacy caller shell options unchanged if the compatibility helper is sourced", () => {
    const probe = spawnSync("bash", ["-c", [
      "set +e +u",
      "before=$-",
      ". scripts/compose-safe.sh",
      "after=$-",
      "printf '%s:%s\\n' \"$before\" \"$after\"",
    ].join("; ")], { cwd: root, encoding: "utf8" });
    expect(probe.status).toBe(0);
    expect(probe.stdout).toMatch(/^([^:]+):\1\n$/);
  });

  it("pins Compose, strips inherited selectors, keeps secrets out of config and uses pull plus no-build", () => {
    const harness = fixtureHarness();
    writeFileSync(resolve(root, "releases/1.2.3.env"), manifest());
    const result = run(["1.2.3"], {
      ...harness.env, HERMES_API_KEY: "runtime-secret", RUNTIME_HERMES_API_KEY: "hostile-exported-alias", COMPOSE_FILE: "/tmp/evil.yaml",
      COMPOSE_PROJECT_NAME: "evil", COMPOSE_PROFILES: "evil",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(run(["build"], { ...harness.env, HERMES_API_KEY: "runtime-secret" }).status).toBe(0);
    expect(run(["status"], { ...harness.env, HERMES_API_KEY: "runtime-secret" }).status).toBe(0);
    expect(run(["down"], { ...harness.env, HERMES_API_KEY: "runtime-secret" }).status).toBe(0);
    const calls = readFileSync(harness.log, "utf8");
    const fixed = `--project-directory ${root} --file ${root}/compose.yaml --project-name spock-workspace-dashboard`;
    expect(calls).toContain(`env=EMPTY docker compose ${fixed} config --format json`);
    expect(calls).toContain(`env=EMPTY docker compose ${fixed} pull`);
    expect(calls).toContain(`env=SET docker compose ${fixed} up --no-start --no-build`);
    for (const line of calls.trim().split("\n")) {
      if (!line.includes(" up --no-start --no-build")) expect(line, "only staged runtime up may receive the secret").toContain("env=EMPTY");
      expect(line, "the internal runtime-key alias must never be exported").toContain("alias=EMPTY");
    }
    for (const command of ["git", "stat", "mktemp", "mkdir", "chmod", "mv", "rm", "python3", "gh", "curl"]) {
      expect(calls, `${command} must be observed under a blank key`).toContain(`env=EMPTY ${command} `);
    }
    expect(calls).toContain(`env=EMPTY python3 ${root}/scripts/verify-compose-config.py`);
    expect(calls).toContain(`env=EMPTY python3 ${root}/scripts/verify-container-inspect.py`);
    expect(calls).toContain("env=EMPTY docker inspect --format");
    for (const operation of ["config --format json", "build", "pull", "ps", "start dashboard", "down"]) {
      expect(calls, `${operation} must run under a blank key`).toContain(`env=EMPTY docker compose ${fixed} ${operation}`);
    }
    expect(calls).not.toContain("runtime-secret");
    expect(calls).not.toContain("hostile-exported-alias");
    expect(calls).not.toContain("/tmp/evil.yaml");
    expect(calls).not.toContain("--build");
  });

  it("rejects workspace replacement after declaration validation and never starts", () => {
    const harness = fixtureHarness();
    writeFileSync(resolve(root, "releases/1.2.3.env"), manifest());
    const result = run(["1.2.3"], { ...harness.env, MUTATE_WORKSPACE_AFTER_CONFIG: "1" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("workspace identity changed");
    const calls = readFileSync(harness.log, "utf8");
    expect(calls).not.toContain(" pull");
    expect(calls).not.toContain(" up -d");
  });

  it("fails closed and removes the staged container if the workspace is swapped during the final up call", () => {
    const harness = fixtureHarness();
    writeFileSync(resolve(root, "releases/1.2.3.env"), manifest());
    const result = run(["1.2.3"], { ...harness.env, MUTATE_WORKSPACE_DURING_UP: "1" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("unhealthy");
    const calls = readFileSync(harness.log, "utf8");
    expect(calls).toContain(" up --no-start --no-build");
    expect(calls).toContain(" start dashboard");
    expect(calls).toContain(" rm -sf dashboard");
    const inspectIndex = calls.indexOf('inspect --format {"Entrypoint"');
    expect(inspectIndex).toBeGreaterThanOrEqual(0);
    expect(inspectIndex).toBeLessThan(calls.indexOf(" start dashboard"));
    expect(calls).not.toContain("curl ");
    expect(result.stdout).not.toContain("deployed by digest");
  });

  it("checks the fixed running CID for non-root and non-writable root/workspace without exposing secrets", () => {
    const harness = fixtureHarness();
    const local = run(["local"], { ...harness.env, HERMES_API_KEY: "runtime-secret" });
    expect(local.status, local.stderr).toBe(0);
    const verified = run(["verify"], { ...harness.env, HERMES_API_KEY: "runtime-secret" });
    expect(verified.status, verified.stderr).toBe(0);
    const calls = readFileSync(harness.log, "utf8");
    const runtimeLines = calls.split("\n").filter((line) => line.includes("env=EMPTY docker exec cid123"));
    expect(runtimeLines).toHaveLength(2);
    for (const line of runtimeLines) {
      expect(line).toContain("env=EMPTY");
      expect(line).toContain('uid="$(id -u)"');
      expect(line).toContain('[ "$uid" -ne 0 ]');
      expect(line).toContain("[ ! -w / ]");
      expect(line).toContain("[ ! -w /workspace ]");
      expect(line).not.toContain("runtime-secret");
      expect(line).not.toContain("env | ");
      expect(line).not.toContain("touch ");
    }
    const firstInspect = calls.indexOf('inspect --format {"Entrypoint"');
    const firstStart = calls.indexOf(" start dashboard");
    const firstHealth = calls.indexOf("inspect --format {{if .State.Health}}", firstStart);
    const firstRuntime = calls.indexOf("docker exec cid123");
    expect(firstInspect).toBeLessThan(firstStart);
    expect(firstStart).toBeLessThan(firstHealth);
    expect(firstHealth).toBeLessThan(firstRuntime);
    expect(firstRuntime).toBeLessThan(calls.indexOf("curl "));
    const cli = readFileSync(deploy, "utf8");
    expect(cli).toContain('"User":{{json .Config.User}}');
    expect(cli).toContain('"ReadonlyRootfs":{{json .HostConfig.ReadonlyRootfs}}');
  });

  it("fails closed and boundedly when the runtime UID or writability probe fails", () => {
    const harness = fixtureHarness();
    const failed = run(["verify"], { ...harness.env, RUNTIME_VERIFY_RC: "1" });
    expect(failed.status).not.toBe(0);
    expect(failed.stderr).toContain("runtime isolation verification failed");
    expect(failed.stderr).not.toContain("HERMES_API_KEY");
    expect(readFileSync(harness.log, "utf8")).not.toContain("curl ");

    const invalidTimeout = run(["verify"], { ...harness.env, DEPLOY_RUNTIME_TIMEOUT: "0" });
    expect(invalidTimeout.status).not.toBe(0);
    expect(invalidTimeout.stderr).toContain("runtime verification timeout must be a positive integer");

    const startedAt = Date.now();
    const hanging = run(["verify"], {
      ...harness.env,
      DEPLOY_RUNTIME_TIMEOUT: "1",
      RUNTIME_VERIFY_HANG: "1",
    });
    const elapsedMs = Date.now() - startedAt;
    expect(hanging.status).not.toBe(0);
    expect(hanging.stderr).toContain("runtime isolation verification failed");
    expect(elapsedMs).toBeGreaterThanOrEqual(900);
    expect(elapsedMs).toBeLessThan(5_000);
  });

  it("fails boundedly on unhealthy Docker health without claiming success", () => {
    const harness = fixtureHarness("unhealthy");
    writeFileSync(resolve(root, "releases/1.2.3.env"), manifest());
    const result = run(["1.2.3"], harness.env);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("unhealthy");
    expect(result.stderr).not.toContain("HERMES_API_KEY");
  });

  it("times out boundedly while Docker health remains starting and validates health controls", () => {
    const harness = fixtureHarness("starting");
    writeFileSync(resolve(root, "releases/1.2.3.env"), manifest());
    const result = run(["1.2.3"], harness.env);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("timeout waiting for Docker health");
    for (const [key, value] of [["DEPLOY_HEALTH_TIMEOUT", "0"], ["DEPLOY_HEALTH_INTERVAL", "0"], ["DEPLOY_HEALTH_TIMEOUT", "1.5"]]) {
      const invalid = run(["verify"], { ...harness.env, HEALTH: "healthy", [key]: value });
      expect(invalid.status, `${key}=${value}`).not.toBe(0);
      expect(invalid.stderr).toContain("positive integer");
    }
  }, 15_000);

  it("records immutable deployed state only after a successful verified release", () => {
    const harness = fixtureHarness();
    writeFileSync(resolve(root, "releases/1.2.3.env"), manifest());
    expect(run(["1.2.3"], harness.env).status).toBe(0);
    const state = readFileSync(join(harness.dir, "state", "deployed-release.env"), "utf8");
    expect(state).toBe(`RELEASE=1.2.3\nDASHBOARD_IMAGE=ghcr.io/jeffersonarpasserini/spock-workspace-dashboard:1.2.3@${digest}\n`);
    const status = run(["status"], harness.env);
    expect(status.status).toBe(0);
    expect(status.stdout).toContain("deployed immutable release 1.2.3");
    expect(status.stdout).not.toContain("secret");
  });

  it("defines an approved build-once provenance release with fully pinned actions", () => {
    const workflow = readFileSync(resolve(root, ".github/workflows/release.yml"), "utf8");
    expect(workflow).toMatch(/tags:\s*\[?['"]v\*['"]?\]?/);
    for (const required of [
      "environment: release", "fetch-depth: 0", "git merge-base --is-ancestor", "origin/main",
      "cancel-in-progress: false", "release-${{ github.ref_name }}", "required_reviewers", "prevent_self_review", "gh api",
      "attestations: write", "id-token: write", "push-to-registry: true",
      "actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5",
      "docker/setup-buildx-action@8d2750c68a42422c14e847fe6c8ac0403b4cbd6f # v3",
      "docker/login-action@c94ce9fb468520275223c153574b00df6fe4bcc9 # v3",
      "docker/build-push-action@10e90e3645eae34f1e60eeb005ba3a3d33f178e8 # v6",
      "actions/attest-build-provenance@977bb373ede98d70efdf65b84cb5f73e068dcc2a # v3",
      "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4",
      "softprops/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65 # v2",
      "steps.build.outputs.digest",
      "GitHub Release already exists", "GHCR image version", "partially published versions must never be rebuilt",
      "could not prove that the GHCR version image is absent", "GITHUB_RUN_ATTEMPT", "release-manifest-${version}",
      "workflow artifact already exists",
      "/users/jeffersonarpasserini/packages?package_type=container&per_page=100",
      "/users/jeffersonarpasserini/packages/container/spock-workspace-dashboard",
      "/users/jeffersonarpasserini/packages/container/spock-workspace-dashboard/versions?per_page=100",
    ]) expect(workflow).toContain(required);
    expect(workflow).toMatch(/\.protection_rules \| any\(\.type == "required_reviewers" and \(\.prevent_self_review == true\) and \(\(\.reviewers \/\/ \[\]\) \| length > 0\)\)/);
    expect(workflow).toContain("could not establish authenticated GHCR package-list visibility");
    expect(workflow).toContain("package collection and package endpoint disagree");
    for (const key of ["RELEASE", "GIT_TAG", "GIT_SHA", "BUILT_AT", "DASHBOARD_IMAGE"]) expect(workflow).toContain(`${key}=`);
    expect(workflow).not.toMatch(/git push[\s\S]*\|\|\s*(?:echo|true)/);
    expect(workflow).not.toMatch(/spock-workspace-dashboard:latest/);
    expect(workflow).not.toMatch(/uses:\s*[^\s]+@v\d/);
    expect(workflow).toContain("tag must be an exact stable vMAJOR.MINOR.PATCH without leading zeroes");
    expect(workflow).not.toContain("[0-9A-Za-z.-]");
  });

  it("pins every Docker base stage to the deliberately approved manifest-list digest", () => {
    const dockerfile = readFileSync(resolve(root, "Dockerfile"), "utf8");
    const approved = "node:20.19.5-bookworm-slim@sha256:9e70124bd00f47dd023e349cd587132ae61892acc0e47ed641416c3e18f401c3";
    expect(dockerfile.match(/^FROM .+$/gm)).toEqual([
      `FROM ${approved} AS deps`,
      `FROM ${approved} AS builder`,
      `FROM ${approved} AS runner`,
    ]);
  });

  it("selects the image by environment with a safe local fallback while retaining local build", () => {
    const compose = readFileSync(resolve(root, "compose.yaml"), "utf8");
    expect(compose).toContain("image: ${DASHBOARD_IMAGE:-spock-workspace-dashboard:local}");
    expect(compose).toMatch(/build:\s*\n\s*context: \./);
  });
});