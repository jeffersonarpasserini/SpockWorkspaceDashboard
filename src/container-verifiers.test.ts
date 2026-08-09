import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const workspace = resolve(process.cwd());
const verifierArgs = [workspace, "3011", "512m", "1.0", "128", "10m", "3"];

function verify(
  script: string,
  fixture: unknown,
  options: { optimizeEnv?: string; optimizedFlag?: boolean } = {},
) {
  const directory = mkdtempSync(join(tmpdir(), "spock-verifier-"));
  const fixturePath = join(directory, "fixture.json");
  writeFileSync(fixturePath, JSON.stringify(fixture));
  return spawnSync("python3", [
    ...(options.optimizedFlag ? ["-O"] : []),
    resolve(script),
    fixturePath,
    ...verifierArgs,
  ], {
    cwd: workspace,
    encoding: "utf8",
    env: {
      ...process.env,
      ...(options.optimizeEnv === undefined
        ? {}
        : { PYTHONOPTIMIZE: options.optimizeEnv }),
    },
  });
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

const safeDeclared = {
  services: {
    dashboard: {
      environment: { HERMES_API_KEY: "" },
      read_only: true,
      privileged: false,
      mem_limit: "512m",
      cpus: 1,
      pids_limit: 128,
      logging: {
        driver: "local",
        options: { "max-size": "10m", "max-file": "3" },
      },
      cap_drop: ["ALL"],
      security_opt: ["no-new-privileges:true"],
      ports: [
        { host_ip: "127.0.0.1", published: "3011", target: 3000, protocol: "tcp" },
      ],
      volumes: [
        { type: "bind", source: workspace, target: "/workspace", read_only: true },
      ],
      tmpfs: ["/tmp:size=64m,mode=1777"],
    },
  },
};

const safeEffective = {
  Privileged: false,
  Devices: [],
  DeviceRequests: [],
  DeviceCgroupRules: [],
  PidMode: "",
  IpcMode: "private",
  AppArmorProfile: "docker-default",
  SecurityOpt: ["no-new-privileges:true"],
  Memory: 512 * 1024 * 1024,
  NanoCpus: 1_000_000_000,
  PidsLimit: 128,
  LogConfig: { Type: "local", Config: { "max-size": "10m", "max-file": "3" } },
  CapAdd: null,
  CapDrop: ["ALL"],
  PortBindings: { "3000/tcp": [{ HostIp: "127.0.0.1", HostPort: "3011" }] },
  Mounts: [{ Type: "bind", Source: workspace, Destination: "/workspace", RW: false }],
  Tmpfs: { "/tmp": "size=64m,mode=1777" },
};

describe("container hardening verifier fixtures", () => {
  const pythonModes = [
    { label: "normal Python", options: {} },
    { label: "PYTHONOPTIMIZE=1", options: { optimizeEnv: "1" } },
    { label: "python3 -O", options: { optimizedFlag: true } },
  ] as const;

  it("accepts the declared safe fixture and rejects every hostile sandbox mutation", () => {
    const mutations: Array<(fixture: typeof safeDeclared) => void> = [
      (fixture) => { fixture.services.dashboard.privileged = true; },
      (fixture) => { Object.assign(fixture.services.dashboard, { devices: ["/dev/kvm"] }); },
      (fixture) => { Object.assign(fixture.services.dashboard, { device_cgroup_rules: ["c 1:3 rwm"] }); },
      (fixture) => { Object.assign(fixture.services.dashboard, { device_requests: [{ capabilities: [["gpu"]]}] }); },
      (fixture) => { Object.assign(fixture.services.dashboard, { pid: "host" }); },
      (fixture) => { Object.assign(fixture.services.dashboard, { ipc: "host" }); },
      (fixture) => { fixture.services.dashboard.security_opt.push("seccomp=unconfined"); },
      (fixture) => { fixture.services.dashboard.security_opt.push("apparmor=unconfined"); },
      (fixture) => { fixture.services.dashboard.ports.push({ host_ip: "0.0.0.0", published: "3012", target: 3000, protocol: "tcp" }); },
      (fixture) => { fixture.services.dashboard.volumes.push({ type: "bind", source: "/var/run/docker.sock", target: "/var/run/docker.sock", read_only: false }); },
    ];
    for (const mode of pythonModes) {
      expect(verify("scripts/verify-compose-config.py", safeDeclared, mode.options).status, mode.label).toBe(0);
      for (const mutate of mutations) {
        const fixture = clone(safeDeclared);
        mutate(fixture);
        const result = verify("scripts/verify-compose-config.py", fixture, mode.options);
        expect(result.status, mode.label).not.toBe(0);
        expect(result.stderr, mode.label).toMatch(/^verify-compose-config: /);
      }
    }
  });

  it("accepts a Docker-shaped safe fixture and rejects effective privilege escapes", () => {
    const mutations: Array<(fixture: typeof safeEffective) => void> = [
      (fixture) => { fixture.Privileged = true; },
      (fixture) => { fixture.Devices.push({ PathOnHost: "/dev/kvm" } as never); },
      (fixture) => { fixture.DeviceRequests.push({ Driver: "nvidia" } as never); },
      (fixture) => { fixture.DeviceCgroupRules.push("c 1:3 rwm" as never); },
      (fixture) => { fixture.PidMode = "host"; },
      (fixture) => { fixture.IpcMode = "host"; },
      (fixture) => { fixture.AppArmorProfile = "unconfined"; },
      (fixture) => { fixture.SecurityOpt.push("seccomp=unconfined"); },
      (fixture) => { fixture.SecurityOpt.push("apparmor=unconfined"); },
      (fixture) => { fixture.Mounts.push({ Type: "bind", Source: "/var/run/docker.sock", Destination: "/var/run/docker.sock", RW: true }); },
      (fixture) => { (fixture.Tmpfs as Record<string, string>)["/run"] = "size=1m,mode=1777"; },
    ];
    for (const mode of pythonModes) {
      expect(verify("scripts/verify-container-inspect.py", safeEffective, mode.options).status, mode.label).toBe(0);
      const safeWithoutAppArmor = clone(safeEffective);
      safeWithoutAppArmor.AppArmorProfile = "";
      expect(verify("scripts/verify-container-inspect.py", safeWithoutAppArmor, mode.options).status, mode.label).toBe(0);
      for (const mutate of mutations) {
        const fixture = clone(safeEffective);
        mutate(fixture);
        const result = verify("scripts/verify-container-inspect.py", fixture, mode.options);
        expect(result.status, mode.label).not.toBe(0);
        expect(result.stderr, mode.label).toMatch(/^verify-container-inspect: /);
      }
    }
  }, 20_000);

  it("does not use optimization-removable assertions in either verifier", () => {
    for (const script of [
      "scripts/verify-compose-config.py",
      "scripts/verify-container-inspect.py",
    ]) {
      expect(readFileSync(resolve(script), "utf8")).not.toMatch(/^\s*assert\b/m);
    }
  });
});
