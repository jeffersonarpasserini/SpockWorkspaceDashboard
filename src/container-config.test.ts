import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(path: string): string {
  try {
    return readFileSync(resolve(process.cwd(), path), "utf8");
  } catch {
    return "";
  }
}

describe("container deployment configuration", () => {
  it("uses a standalone non-root runtime with Git and an HTTP healthcheck", () => {
    const dockerfile = readProjectFile("Dockerfile");
    const nextConfig = readProjectFile("next.config.ts");

    expect(nextConfig).toContain('output: "standalone"');
    expect(dockerfile).toContain("git");
    expect(dockerfile).toMatch(/USER node/);
    expect(dockerfile).toContain("/api/health");
    expect(dockerfile).toMatch(/\bPORT=3000\b/);
    expect(dockerfile).toMatch(/\bEXPOSE 3000\b/);
    expect(dockerfile).toContain("http://127.0.0.1:3000/api/health");
    expect(dockerfile).not.toContain("/app/.next/standalone ./");
    expect(dockerfile).toContain("/app/.next/standalone/server.js ./server.js");
    expect(dockerfile).toContain("/app/.next/standalone/.next ./.next");
    expect(dockerfile).not.toMatch(/HERMES_API_KEY\s*=/);
  });

  it("publishes only to loopback and grants no sensitive host mounts", () => {
    const compose = readProjectFile("compose.yaml");

    expect(compose).toContain('127.0.0.1:${DASHBOARD_PORT:-3011}:3000');
    expect(compose).toMatch(/\/workspace:ro/);
    expect(compose).toContain("read_only: true");
    expect(compose).toContain("no-new-privileges:true");
    expect(compose).toMatch(/cap_drop:\s*\n\s*- ALL/);
    expect(compose).not.toContain("/var/run/docker.sock");
    expect(compose).not.toMatch(/\.hermes(?:\/|\b)/);
  });

  it("starts the standalone server on loopback while preserving caller overrides", () => {
    const packageJson = JSON.parse(readProjectFile("package.json")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.dev).toBe(
      "PORT=${PORT:-3011} next dev --hostname 127.0.0.1",
    );
    expect(packageJson.scripts?.start).toBe("npm run start:standalone");
    expect(packageJson.scripts?.["start:standalone"]).toBe(
      "npm run prepare:standalone && HOSTNAME=${DASHBOARD_HOSTNAME:-127.0.0.1} PORT=${PORT:-3011} node .next/standalone/server.js",
    );
    expect(packageJson.scripts?.["start:standalone"]).not.toContain("next start");
    expect(packageJson.scripts?.["start:standalone"]).not.toContain("npm run build");
  });

  it("bounds Compose resources and rotates logs without deploy-only limits", () => {
    const compose = readProjectFile("compose.yaml");

    expect(compose).toContain('mem_limit: "${DASHBOARD_MEMORY_LIMIT:-512m}"');
    expect(compose).toContain("cpus: ${DASHBOARD_CPUS:-1.0}");
    expect(compose).toContain("pids_limit: ${DASHBOARD_PIDS_LIMIT:-128}");
    expect(compose).toMatch(/logging:\s*\n\s*driver: local/);
    expect(compose).toContain('max-size: "${DASHBOARD_LOG_MAX_SIZE:-10m}"');
    expect(compose).toContain('max-file: "${DASHBOARD_LOG_MAX_FILE:-3}"');
    expect(compose).not.toMatch(/^\s+deploy:/m);
  });

  it("prepares standalone assets on every local start without building", () => {
    const packageJson = JSON.parse(readProjectFile("package.json")) as {
      scripts?: Record<string, string>;
    };
    const playwrightConfig = readProjectFile("playwright.config.ts");

    expect(packageJson.scripts?.["prepare:standalone"]).toContain(
      ".next/standalone/.next/static",
    );
    expect(packageJson.scripts?.["prepare:standalone"]).toContain("public");
    expect(packageJson.scripts?.["prepare:standalone"]).not.toContain("npm run build");
    expect(packageJson.scripts?.["start:standalone"]).toMatch(
      /^npm run prepare:standalone && /,
    );
    expect(packageJson.scripts?.["start:standalone"]).not.toContain("npm run build");
    expect(playwrightConfig).not.toContain("cp -R");
    expect(playwrightConfig).toContain("reuseExistingServer: false");
    expect(playwrightConfig).toContain(
      "DASHBOARD_HOSTNAME=127.0.0.1 PORT=3101 npm start",
    );
  });

  it("pins every Compose operation and rollback to the validated repository stack", () => {
    const runbook = readProjectFile("docs/docker-local.md");
    const helper = readProjectFile("scripts/compose-safe.sh");

    expect(helper).toContain('REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd -P)"');
    expect(helper).toContain('--project-directory "$REPO_ROOT"');
    expect(helper).toContain('--file "$REPO_ROOT/compose.yaml"');
    expect(helper).toContain('--project-name spock-workspace-dashboard');
    for (const variable of [
      "COMPOSE_FILE",
      "COMPOSE_PROJECT_NAME",
      "COMPOSE_PATH_SEPARATOR",
      "COMPOSE_ENV_FILES",
      "COMPOSE_PROFILES",
    ]) {
      expect(helper).toContain(`-u ${variable}`);
    }
    expect(runbook).not.toMatch(/\bdocker compose (?:config|build|up|ps|exec|down)\b/);
    for (const operation of ["up", "ps", "exec", "down"]) {
      expect(runbook).toMatch(new RegExp(`\\bcompose_safe ${operation}\\b`));
    }
    for (const operation of ["config", "build"]) {
      expect(runbook).toMatch(new RegExp(`\\bcompose_safe_no_secret ${operation}\\b`));
    }
    expect(runbook).toContain('CID="$(compose_safe ps -q dashboard)"');
    expect(helper).toContain("compose_safe_no_secret()");
    expect(helper).toMatch(/compose_safe_no_secret\(\) \{\s*HERMES_API_KEY= _compose_safe/);
    expect(helper).toMatch(/compose_safe\(\) \{\s*_compose_safe/);

    const probe = spawnSync("bash", ["-c", [
      ". scripts/compose-safe.sh",
      "_compose_safe() { printf '<%s>\\n' \"${HERMES_API_KEY-unset}\"; }",
      "HERMES_API_KEY=runtime-secret compose_safe up",
      "HERMES_API_KEY=runtime-secret compose_safe_no_secret build",
    ].join("; ")], { cwd: process.cwd(), encoding: "utf8" });
    expect(probe.status).toBe(0);
    expect(probe.stdout).toBe("<runtime-secret>\n<>\n");
  });

  it("declares and verifies a fail-closed container sandbox", () => {
    const compose = readProjectFile("compose.yaml");
    const declaredVerifier = readProjectFile("scripts/verify-compose-config.py");
    const effectiveVerifier = readProjectFile("scripts/verify-container-inspect.py");

    expect(compose).toMatch(/privileged:\s*false/);
    expect(declaredVerifier).toContain('svc.get("privileged") is False');
    expect(declaredVerifier).toContain('set(security_opt) == {"no-new-privileges:true"}');
    for (const field of ["devices", "device_cgroup_rules", "device_requests"]) {
      expect(declaredVerifier).toContain(`"${field}"`);
    }
    for (const field of [
      "Privileged",
      "Devices",
      "DeviceRequests",
      "DeviceCgroupRules",
      "AppArmorProfile",
    ]) {
      expect(effectiveVerifier).toContain(`"${field}"`);
    }
    expect(effectiveVerifier).toContain("seccomp=unconfined");
    expect(effectiveVerifier).toContain("apparmor=unconfined");
  });

  it("documents fail-closed declared and effective resource and log checks", () => {
    const runbook = readProjectFile("docs/docker-local.md");
    const declaredVerifier = readProjectFile("scripts/verify-compose-config.py");
    const effectiveVerifier = readProjectFile("scripts/verify-container-inspect.py");

    expect(runbook).toContain("verify-compose-config.py");
    expect(runbook).toContain("verify-container-inspect.py");
    expect(declaredVerifier).toContain('svc.get("deploy") is None');
    expect(declaredVerifier).toContain('set(logging) == {"driver", "options"}');
    expect(effectiveVerifier).toContain('state.get("Memory")');
    expect(effectiveVerifier).toContain('state.get("NanoCpus")');
    expect(effectiveVerifier).toContain('state.get("PidsLimit")');
    expect(effectiveVerifier).toContain('state.get("LogConfig")');
    expect(effectiveVerifier).toContain('set(log_config) == {"Type", "Config"}');
  });
});
