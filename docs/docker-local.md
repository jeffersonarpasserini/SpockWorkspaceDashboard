# Execução Docker local (preparação)

Esta configuração prepara um runtime de produção para teste futuro. Ela **não executa nem altera** Docker, Homepage, proxy reverso, Tailscale ou serviços do homelab atual. A integração com Homepage continua adiada até uma validação real em host Docker.

## Limites de segurança

- A publicação padrão é `127.0.0.1:3011`; a aplicação não possui autenticação para LAN/Internet.
- O workspace é o único mount e entra como somente leitura em `/workspace`.
- Não monte `/var/run/docker.sock`, `~/.hermes`, arquivos `.env`, devices ou credenciais do host.
- O serviço declara `privileged: false`, remove todas as capabilities, aplica somente `no-new-privileges` em `security_opt`, rejeita modos PID/IPC host-like e usa filesystem raiz somente leitura.
- `GET /api/health` é apenas liveness não autenticado. Ele retorna somente `{ "status": "ok" }`; não comprova disponibilidade de integrações e não autoriza exposição remota.

Se acesso além do loopback for necessário, use proxy reverso autenticado ou Tailscale com política restritiva. Não publique diretamente em `0.0.0.0`.

## Configuração

```bash
export DASHBOARD_WORKSPACE_PATH=/caminho/absoluto/do/workspace
export DASHBOARD_PORT=3011
export DASHBOARD_MEMORY_LIMIT=512m
export DASHBOARD_CPUS=1.0
export DASHBOARD_PIDS_LIMIT=128
export DASHBOARD_LOG_MAX_SIZE=10m
export DASHBOARD_LOG_MAX_FILE=3
# Opcionais somente se a API for alcançável de dentro do contêiner:
export HERMES_API_URL=http://endereco-protegido:8642
# Defina HERMES_API_KEY somente no runtime, nunca durante a inspeção abaixo.
```

Os limites são defaults conservadores de preparação, não uma recomendação universal. O operador deve medir o host antes de alterá-los. `127.0.0.1` dentro do contêiner é o próprio contêiner, não o host. A Hermes CLI e o diretório Hermes do host não são incluídos; Kanban pode degradar como projetado.

## Seleção imutável da stack

Cada bloco independente carrega `scripts/compose-safe.sh`. O helper resolve sua própria localização física, exige que ela pertença à raiz Git validada e que `compose.yaml` exista nessa raiz. Toda chamada usa simultaneamente `--project-directory "$REPO_ROOT"`, `--file "$REPO_ROOT/compose.yaml"` e `--project-name spock-workspace-dashboard`.

O helper remove do processo filho `COMPOSE_FILE`, `COMPOSE_PROJECT_NAME`, `COMPOSE_PATH_SEPARATOR`, `COMPOSE_ENV_FILES`, `COMPOSE_PROFILES` e `COMPOSE_CONVERT_WINDOWS_PATHS`. Assim, estado herdado do shell não pode trocar arquivo, diretório, separador de caminhos, profiles ou projeto. `compose_safe` preserva uma `HERMES_API_KEY` fornecida pelo chamador para operações de runtime; `compose_safe_no_secret` a sobrescreve com vazio para inspeção/build. Não substitua os helpers por uma chamada Compose ambiente-dependente.

## Verificação futura em host com Docker

Os comandos falham quando uma invariante não vale e não escrevem no workspace. **Nunca** renderize a configuração com uma chave Hermes real exportada: configuração expandida pode interpolar e imprimir o valor. `compose_safe_no_secret` fornece `HERMES_API_KEY=` somente a `config` e `build`, que não precisam do segredo. `compose_safe up` preserva a chave opcional para injeção no runtime. `ps`, o `exec` limitado abaixo e `down` não imprimem o ambiente; ainda assim, `docker inspect` amplo, `compose config`, comandos `exec env` e logs/debug bundles podem revelar valores de runtime e devem ser tratados como saída sensível.

### 1. Compose expandido, sem segredo

```bash
set -eu
SAFE_COMPOSE_HELPER="$(git rev-parse --show-toplevel)/scripts/compose-safe.sh"
. "$SAFE_COMPOSE_HELPER"
: "${DASHBOARD_WORKSPACE_PATH:?defina o caminho absoluto do workspace}"
case "$DASHBOARD_WORKSPACE_PATH" in /*) ;; *) echo "DASHBOARD_WORKSPACE_PATH deve ser absoluto" >&2; exit 1;; esac
[ -d "$DASHBOARD_WORKSPACE_PATH" ]
CONFIG_JSON="$(mktemp "${TMPDIR:-/tmp}/spock-compose-config.XXXXXX.json")"
trap 'rm -f "$CONFIG_JSON"' EXIT HUP INT TERM
compose_safe_no_secret config --format json >"$CONFIG_JSON"
python3 "$REPO_ROOT/scripts/verify-compose-config.py" \
  "$CONFIG_JSON" "$DASHBOARD_WORKSPACE_PATH" "${DASHBOARD_PORT:-3011}" \
  "${DASHBOARD_MEMORY_LIMIT:-512m}" "${DASHBOARD_CPUS:-1.0}" \
  "${DASHBOARD_PIDS_LIMIT:-128}" "${DASHBOARD_LOG_MAX_SIZE:-10m}" \
  "${DASHBOARD_LOG_MAX_FILE:-3}"
rm -f "$CONFIG_JSON"
trap - EXIT HUP INT TERM
```

O verifier exige exatamente um serviço, publicação e mount; `privileged: false`; `cap_drop: [ALL]`; coleção `security_opt` exata contendo somente `no-new-privileges`; e ausência de `devices`, `device_cgroup_rules`, `device_requests`, PID/IPC host-like, capabilities adicionais, mounts/configs/secrets extras, recursos concorrentes e opções extras de log.

### 2. Build, inicialização e estado

```bash
set -eu
SAFE_COMPOSE_HELPER="$(git rev-parse --show-toplevel)/scripts/compose-safe.sh"
. "$SAFE_COMPOSE_HELPER"
compose_safe_no_secret build
compose_safe up -d
compose_safe ps
CID="$(compose_safe ps -q dashboard)"
[ -n "$CID" ]
[ "$(docker inspect --format '{{.State.Running}}' "$CID")" = "true" ]
```

### 3. Health Docker e liveness HTTP separados

```bash
set -eu
SAFE_COMPOSE_HELPER="$(git rev-parse --show-toplevel)/scripts/compose-safe.sh"
. "$SAFE_COMPOSE_HELPER"
CID="$(compose_safe ps -q dashboard)"
[ -n "$CID" ]
health=""
for _ in $(seq 1 60); do
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$CID")"
  [ "$health" = "healthy" ] && break
  [ "$health" = "unhealthy" ] && { echo "healthcheck Docker ficou unhealthy" >&2; exit 1; }
  sleep 2
done
[ "$health" = "healthy" ]
body="$(curl --fail --silent --show-error "http://127.0.0.1:${DASHBOARD_PORT:-3011}/api/health")"
python3 - "$body" <<'PY'
import json, sys
if json.loads(sys.argv[1]) != {"status": "ok"}:
    print("health payload inesperado", file=sys.stderr)
    raise SystemExit(1)
PY
```

### 4. Usuário, escrita e sandbox efetivo

Os testes de escrita consultam permissões e não criam arquivos no workspace. A projeção seleciona somente campos necessários; não imprime ambiente ou secrets.

```bash
set -eu
SAFE_COMPOSE_HELPER="$(git rev-parse --show-toplevel)/scripts/compose-safe.sh"
. "$SAFE_COMPOSE_HELPER"
CID="$(compose_safe ps -q dashboard)"
[ -n "$CID" ]
compose_safe exec -T dashboard sh -eu -c '
  [ "$(id -u)" -ne 0 ]
  [ ! -w / ]
  [ ! -w /workspace ]
'
[ "$(docker inspect --format '{{.HostConfig.ReadonlyRootfs}}' "$CID")" = "true" ]
EFFECTIVE_JSON="$(mktemp "${TMPDIR:-/tmp}/spock-container-effective.XXXXXX.json")"
trap 'rm -f "$EFFECTIVE_JSON"' EXIT HUP INT TERM
docker inspect --format '{"Privileged":{{json .HostConfig.Privileged}},"Devices":{{json .HostConfig.Devices}},"DeviceRequests":{{json .HostConfig.DeviceRequests}},"DeviceCgroupRules":{{json .HostConfig.DeviceCgroupRules}},"PidMode":{{json .HostConfig.PidMode}},"IpcMode":{{json .HostConfig.IpcMode}},"AppArmorProfile":{{json .AppArmorProfile}},"SecurityOpt":{{json .HostConfig.SecurityOpt}},"CapAdd":{{json .HostConfig.CapAdd}},"CapDrop":{{json .HostConfig.CapDrop}},"PortBindings":{{json .HostConfig.PortBindings}},"Mounts":{{json .Mounts}},"Tmpfs":{{json .HostConfig.Tmpfs}},"Memory":{{json .HostConfig.Memory}},"NanoCpus":{{json .HostConfig.NanoCpus}},"PidsLimit":{{json .HostConfig.PidsLimit}},"LogConfig":{{json .HostConfig.LogConfig}}}' "$CID" >"$EFFECTIVE_JSON"
python3 "$REPO_ROOT/scripts/verify-container-inspect.py" \
  "$EFFECTIVE_JSON" "$DASHBOARD_WORKSPACE_PATH" "${DASHBOARD_PORT:-3011}" \
  "${DASHBOARD_MEMORY_LIMIT:-512m}" "${DASHBOARD_CPUS:-1.0}" \
  "${DASHBOARD_PIDS_LIMIT:-128}" "${DASHBOARD_LOG_MAX_SIZE:-10m}" \
  "${DASHBOARD_LOG_MAX_FILE:-3}"
rm -f "$EFFECTIVE_JSON"
trap - EXIT HUP INT TERM
```

O verifier efetivo rejeita `Privileged`, `Devices`, `DeviceRequests`, `DeviceCgroupRules`, PID/IPC host-like, `CapAdd`, mounts e tmpfs extras. Também rejeita explicitamente AppArmor ou seccomp `unconfined`, exige `no-new-privileges`, `CapDrop: [ALL]`, a publicação loopback única e os recursos/logs esperados. A validação de fixtures adversariais não substitui esta execução posterior contra um daemon.

## Rollback e retorno ao Node local

Este Compose não declara volumes persistentes. O único mount é o workspace read-only. O teardown abaixo só pode alcançar o projeto fixo `spock-workspace-dashboard` e o `compose.yaml` desta raiz validada; ele não pode selecionar outra stack por variáveis herdadas.

```bash
set -eu
SAFE_COMPOSE_HELPER="$(git rev-parse --show-toplevel)/scripts/compose-safe.sh"
. "$SAFE_COMPOSE_HELPER"
compose_safe down
unset DASHBOARD_WORKSPACE_PATH DASHBOARD_PORT DASHBOARD_MEMORY_LIMIT DASHBOARD_CPUS
unset DASHBOARD_PIDS_LIMIT DASHBOARD_LOG_MAX_SIZE DASHBOARD_LOG_MAX_FILE
unset HERMES_API_URL HERMES_API_KEY
unset DASHBOARD_HOSTNAME PORT HOSTNAME
export WORKSPACE_ROOT=/caminho/absoluto/do/diretorio-pai-dos-projetos
case "$WORKSPACE_ROOT" in /*) ;; *) echo "WORKSPACE_ROOT deve ser absoluto" >&2; exit 1;; esac
[ -d "$WORKSPACE_ROOT" ]
npm ci
npm run build
# O start prepara .next/static e public no runtime standalone; não refaz o build.
DASHBOARD_HOSTNAME=127.0.0.1 PORT=3011 npm start
```

`npm start` delega a `start:standalone`, que sempre executa `prepare:standalone` antes do servidor. Esse preparo copia `.next/static` e, quando presente, `public`; não executa build implicitamente. Homepage, proxy e Tailscale permanecem fora do rollback.

## Graphify

A consulta Graphify continua pendente porque `graphify-out/graph.json` não existe neste root. Nenhum resultado foi inventado.
