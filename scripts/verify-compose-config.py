#!/usr/bin/env python3
"""Fail-closed verifier for rendered `docker compose config --format json`."""
from decimal import Decimal, InvalidOperation
import ipaddress
import json
import os
import re
import sys


class ValidationError(Exception):
    """Raised when rendered Compose configuration violates an invariant."""


def require(condition, message):
    if not condition:
        raise ValidationError(message)


def require_list(value, name):
    require(isinstance(value, list), f"{name} must be a list")
    return value


def require_int(value, name):
    require(not isinstance(value, bool), f"invalid {name}")
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError(f"invalid {name}") from exc


def require_bytes(value, name):
    if isinstance(value, int) and not isinstance(value, bool):
        require(value > 0, f"{name} must be positive")
        return value
    require(isinstance(value, str), f"invalid {name}")
    match = re.fullmatch(r"([1-9][0-9]*)([kmgt]i?b?|b)?", value.strip().lower())
    require(match is not None, f"invalid {name}")
    units = {None: 1, "b": 1, "k": 1024, "kb": 1024, "kib": 1024,
             "m": 1024**2, "mb": 1024**2, "mib": 1024**2,
             "g": 1024**3, "gb": 1024**3, "gib": 1024**3,
             "t": 1024**4, "tb": 1024**4, "tib": 1024**4}
    return int(match.group(1)) * units[match.group(2)]


def require_cpus(value, name):
    require(not isinstance(value, bool), f"invalid {name}")
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ValidationError(f"invalid {name}") from exc
    require(result.is_finite() and result > 0, f"{name} must be positive")
    return result


def empty_collection(value, name):
    require(value is None or value == [] or value == {}, f"{name} must be empty or null")


def require_bind_address(value):
    require(isinstance(value, str), "invalid DASHBOARD_BIND_ADDRESS")
    try:
        address = ipaddress.IPv4Address(value)
    except ipaddress.AddressValueError as exc:
        raise ValidationError("invalid DASHBOARD_BIND_ADDRESS") from exc
    tailscale = ipaddress.IPv4Network("100.64.0.0/10")
    require(str(address) == value and (value == "127.0.0.1" or address in tailscale),
            "DASHBOARD_BIND_ADDRESS must be loopback or Tailscale IPv4")
    return value


def main():
    require(len(sys.argv) == 11, "usage: verify-compose-config.py JSON WORKSPACE BIND_ADDRESS PORT MEMORY CPUS PIDS LOG_SIZE LOG_FILES WORKSPACE_IDENTITY")
    with open(sys.argv[1], encoding="utf-8") as stream:
        cfg = json.load(stream)
    require(isinstance(cfg, dict), "invalid Compose configuration")
    services = cfg.get("services")
    require(isinstance(services, dict) and set(services) == {"dashboard"}, "exactly dashboard service is required")
    svc = services["dashboard"]
    require(isinstance(svc, dict), "invalid dashboard service")
    expected_workspace = os.path.realpath(sys.argv[2])
    expected_bind_address = require_bind_address(sys.argv[3])
    expected_port = require_int(sys.argv[4], "DASHBOARD_PORT")
    expected_memory = require_bytes(sys.argv[5], "DASHBOARD_MEMORY_LIMIT")
    expected_cpus = require_cpus(sys.argv[6], "DASHBOARD_CPUS")
    expected_pids = require_int(sys.argv[7], "DASHBOARD_PIDS_LIMIT")
    expected_log_size = sys.argv[8]
    expected_log_files = require_int(sys.argv[9], "DASHBOARD_LOG_MAX_FILE")
    expected_identity = sys.argv[10]
    require(expected_pids > 0, "DASHBOARD_PIDS_LIMIT must be positive")
    require(expected_log_files > 0, "DASHBOARD_LOG_MAX_FILE must be positive")
    require_bytes(expected_log_size, "DASHBOARD_LOG_MAX_SIZE")

    environment = svc.get("environment")
    require(isinstance(environment, dict) and environment.get("HERMES_API_KEY") == "", "inspection key must be empty")
    require(environment.get("WORKSPACE_IDENTITY") == expected_identity, "workspace startup identity mismatch")
    require(svc.get("entrypoint") is None, "Compose entrypoint override is forbidden")
    require(svc.get("command") is None, "Compose command override is forbidden")
    require(svc.get("read_only") is True, "read_only must be true")
    require("privileged" not in svc or svc["privileged"] is False, "privileged must be false when present")
    require(svc.get("deploy") is None, "deploy is forbidden")
    for field in ("devices", "device_cgroup_rules", "device_requests", "pid", "ipc"):
        empty_collection(svc.get(field), field)
    for field in ("cpu_count", "cpu_percent", "cpu_period", "cpu_quota", "cpu_rt_period",
                  "cpu_rt_runtime", "cpu_shares", "cpuset", "mem_reservation", "mem_swappiness",
                  "memswap_limit", "oom_kill_disable", "oom_score_adj"):
        require(field not in svc, f"additional resource control forbidden: {field}")
    require(require_bytes(svc.get("mem_limit"), "mem_limit") == expected_memory, "mem_limit mismatch")
    require(require_cpus(svc.get("cpus"), "cpus") == expected_cpus, "cpus mismatch")
    require(require_int(svc.get("pids_limit"), "pids_limit") == expected_pids, "pids_limit mismatch")

    logging = svc.get("logging")
    require(isinstance(logging, dict) and set(logging) == {"driver", "options"}, "logging must contain exactly driver and options")
    require(logging["driver"] == "local", "logging driver must be local")
    log_options = logging["options"]
    require(isinstance(log_options, dict) and set(log_options) == {"max-size", "max-file"}, "invalid logging options")
    require(log_options["max-size"] == expected_log_size, "max-size mismatch")
    require(require_int(log_options["max-file"], "max-file") == expected_log_files, "max-file mismatch")

    require(svc.get("cap_add") in (None, []), "cap_add must be empty or null")
    require(require_list(svc.get("cap_drop"), "cap_drop") == ["ALL"], "cap_drop must be exactly ALL")
    security_opt = [str(value).lower().replace("=", ":", 1) for value in require_list(svc.get("security_opt"), "security_opt")]
    require(set(security_opt) == {"no-new-privileges:true"} and len(security_opt) == 1, "security_opt must contain only no-new-privileges")

    ports = require_list(svc.get("ports"), "ports")
    require(len(ports) == 1 and isinstance(ports[0], dict), "exactly one structured port is required")
    port = ports[0]
    require(port.get("host_ip") == expected_bind_address, "published port bind address mismatch")
    require(require_int(port.get("published"), "published") == expected_port, "published port mismatch")
    require(require_int(port.get("target"), "target") == 3000, "target port must be 3000")
    require(str(port.get("protocol", "")).lower() == "tcp", "port protocol must be tcp")

    volumes = require_list(svc.get("volumes"), "volumes")
    require(len(volumes) == 1 and isinstance(volumes[0], dict), "exactly one structured volume is required")
    workspace = volumes[0]
    require(workspace.get("type") == "bind" and workspace.get("target") == "/workspace", "workspace bind mount is required")
    require(workspace.get("read_only") is True, "workspace mount must be read-only")
    source = workspace.get("source")
    require(isinstance(source, str) and os.path.isabs(source), "workspace source must be absolute")
    require(os.path.realpath(source) == expected_workspace, "workspace source mismatch")

    tmpfs = require_list(svc.get("tmpfs"), "tmpfs")
    require(len(tmpfs) == 1, "exactly one tmpfs is required")
    tmp = tmpfs[0]
    target = tmp.split(":", 1)[0] if isinstance(tmp, str) else tmp.get("target") if isinstance(tmp, dict) else None
    require(target == "/tmp", "tmpfs target must be /tmp")
    for field in ("configs", "secrets", "volumes_from"):
        empty_collection(svc.get(field), field)


if __name__ == "__main__":
    try:
        main()
    except (ValidationError, json.JSONDecodeError, OSError) as exc:
        print(f"verify-compose-config: {exc}", file=sys.stderr)
        sys.exit(1)
