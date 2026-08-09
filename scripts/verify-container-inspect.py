#!/usr/bin/env python3
"""Fail-closed verifier for the selected Docker inspect projection."""
from decimal import Decimal, InvalidOperation
import json
import os
import re
import sys


class ValidationError(Exception):
    """Raised when effective container state violates an invariant."""


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


def require_tmpfs_size(value):
    require(isinstance(value, str), "tmpfs size must be a string")
    match = re.fullmatch(r"([0-9]+)(kib|mib|kb|mb|k|m|b)?", value.strip().lower())
    require(match is not None, "invalid tmpfs size")
    units = {None: 1, "b": 1, "k": 1024, "kb": 1024, "kib": 1024,
             "m": 1024**2, "mb": 1024**2, "mib": 1024**2}
    require(int(match.group(1)) * units[match.group(2)] == 64 * 1024**2, "tmpfs size must be 64 MiB")


def main():
    require(len(sys.argv) == 9, "usage: verify-container-inspect.py JSON WORKSPACE PORT MEMORY CPUS PIDS LOG_SIZE LOG_FILES")
    with open(sys.argv[1], encoding="utf-8") as stream:
        state = json.load(stream)
    require(isinstance(state, dict), "invalid container inspection")
    expected_workspace = os.path.realpath(sys.argv[2])
    expected_port = require_int(sys.argv[3], "DASHBOARD_PORT")
    expected_memory = require_bytes(sys.argv[4], "DASHBOARD_MEMORY_LIMIT")
    expected_nano_cpus = require_cpus(sys.argv[5], "DASHBOARD_CPUS") * Decimal(1_000_000_000)
    require(expected_nano_cpus == expected_nano_cpus.to_integral_value(), "DASHBOARD_CPUS cannot be represented as NanoCpus")
    expected_pids = require_int(sys.argv[6], "DASHBOARD_PIDS_LIMIT")
    expected_log_size = sys.argv[7]
    expected_log_files = require_int(sys.argv[8], "DASHBOARD_LOG_MAX_FILE")

    require(state.get("Privileged") is False, "Privileged must be false")
    require(state.get("Devices") in (None, []), "Devices must be empty")
    require(state.get("DeviceRequests") in (None, []), "DeviceRequests must be empty")
    require(state.get("DeviceCgroupRules") in (None, []), "DeviceCgroupRules must be empty")
    require(state.get("PidMode") in (None, ""), "host/container PID mode forbidden")
    require(state.get("IpcMode") in (None, "", "private"), "host/container IPC mode forbidden")
    apparmor = state.get("AppArmorProfile")
    require(apparmor is None or isinstance(apparmor, str), "invalid AppArmorProfile")
    require(not isinstance(apparmor, str) or apparmor.strip().lower() != "unconfined", "unsafe AppArmorProfile")

    security_opt = require_list(state.get("SecurityOpt"), "SecurityOpt")
    normalized = [str(value).lower().replace("=", ":", 1) for value in security_opt]
    require("no-new-privileges:true" in normalized, "no-new-privileges missing")
    require("seccomp=unconfined" not in [str(v).lower() for v in security_opt], "unconfined seccomp forbidden")
    require("seccomp:unconfined" not in normalized, "unconfined seccomp forbidden")
    require("apparmor=unconfined" not in [str(v).lower() for v in security_opt], "unconfined AppArmor forbidden")
    require("apparmor:unconfined" not in normalized, "unconfined AppArmor forbidden")
    for value in normalized:
        require(value == "no-new-privileges:true" or value.startswith("seccomp:") or value.startswith("apparmor:"), "unknown SecurityOpt")

    require(require_int(state.get("Memory"), "Memory") == expected_memory, "Memory mismatch")
    require(require_int(state.get("NanoCpus"), "NanoCpus") == int(expected_nano_cpus), "NanoCpus mismatch")
    require(require_int(state.get("PidsLimit"), "PidsLimit") == expected_pids, "PidsLimit mismatch")
    log_config = state.get("LogConfig")
    require(isinstance(log_config, dict) and set(log_config) == {"Type", "Config"}, "invalid LogConfig")
    require(log_config["Type"] == "local", "logging type must be local")
    options = log_config["Config"]
    require(isinstance(options, dict) and set(options) == {"max-size", "max-file"}, "invalid LogConfig options")
    require(options["max-size"] == expected_log_size, "max-size mismatch")
    require(require_int(options["max-file"], "max-file") == expected_log_files, "max-file mismatch")

    require(state.get("CapAdd") in (None, []), "CapAdd must be empty")
    require(require_list(state.get("CapDrop"), "CapDrop") == ["ALL"], "CapDrop must be exactly ALL")
    bindings = state.get("PortBindings")
    require(isinstance(bindings, dict) and set(bindings) == {"3000/tcp"}, "exactly 3000/tcp must be published")
    published = bindings["3000/tcp"]
    require(isinstance(published, list) and len(published) == 1 and isinstance(published[0], dict), "exactly one structured binding is required")
    require(published[0].get("HostIp") == "127.0.0.1", "published port must bind to loopback")
    require(require_int(published[0].get("HostPort"), "HostPort") == expected_port, "HostPort mismatch")

    mounts = require_list(state.get("Mounts"), "Mounts")
    require(len(mounts) == 1 and isinstance(mounts[0], dict), "exactly one structured mount is required")
    workspace = mounts[0]
    require(workspace.get("Destination") == "/workspace" and workspace.get("Type") == "bind", "workspace bind mount is required")
    require(workspace.get("RW") is False, "workspace mount must be read-only")
    source = workspace.get("Source")
    require(isinstance(source, str) and os.path.isabs(source), "workspace source must be absolute")
    require(os.path.realpath(source) == expected_workspace, "workspace source mismatch")

    tmpfs = state.get("Tmpfs")
    require(isinstance(tmpfs, dict) and set(tmpfs) == {"/tmp"}, "exactly /tmp tmpfs is required")
    option_string = tmpfs["/tmp"]
    require(isinstance(option_string, str) and bool(option_string), "tmpfs options are required")
    parsed = {}
    for token in option_string.split(","):
        require(bool(token) and token.strip() == token, "invalid tmpfs option token")
        key, separator, value = token.partition("=")
        require(bool(key) and key not in parsed, "duplicate or empty tmpfs option")
        parsed[key] = value if separator else None
    raw_keys = {"size", "mode"}
    normalized_keys = {"rw", "noexec", "nosuid", "nodev", "size"}
    require(set(parsed) in (raw_keys, normalized_keys), "unexpected tmpfs options")
    if set(parsed) == raw_keys:
        require(parsed["mode"] == "1777", "tmpfs mode must be 1777")
    else:
        for flag in ("rw", "noexec", "nosuid", "nodev"):
            require(parsed[flag] is None, f"tmpfs {flag} must be a flag")
    require_tmpfs_size(parsed["size"])


if __name__ == "__main__":
    try:
        main()
    except (ValidationError, json.JSONDecodeError, OSError) as exc:
        print(f"verify-container-inspect: {exc}", file=sys.stderr)
        sys.exit(1)
