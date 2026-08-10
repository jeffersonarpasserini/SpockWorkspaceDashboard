# Spock Workspace Dashboard

Local-first control plane for workspace projects, OpenSpec progress and Hermes Agent work.

## What it shows

- project discovery beneath a configured workspace root;
- Git branch and clean/dirty evidence;
- OpenSpec active-change and checkbox progress;
- Hermes Kanban items with native statuses and assignees;
- a merged, provenance-preserving project board;
- project-scoped chat through the Hermes OpenAI-compatible API.

The dashboard reports only observed local evidence. `Complete locally` is not a claim that GitHub CI, deployment or release succeeded.

## Requirements

- Node.js 20.19 or newer;
- Git for repository evidence;
- Hermes Agent for Kanban and chat integrations;
- projects arranged as direct child directories of `WORKSPACE_ROOT`.

## Install and run

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://127.0.0.1:3011`. Override the host-facing development port explicitly with `PORT` when needed.

Production verification and startup:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
npm run start:standalone
```

O build usa `output: "standalone"`; por isso a produção executa `.next/standalone/server.js`, não `next start`. Execute `npm run build` com sucesso antes de `npm start` ou `npm run start:standalone`; os scripts de start não fazem build implicitamente. Todo start executa primeiro o script determinístico `prepare:standalone`, que substitui a cópia de `.next/static` dentro de `.next/standalone/.next/static` e copia `public` quando esse diretório existe. No shell Linux/homelab, `npm start` é um alias do script explícito `start:standalone`, que escuta `127.0.0.1:3011` por padrão e respeita overrides do operador, por exemplo `PORT=3100 npm run start:standalone`.

## Configuration

| Variable | Purpose | Default |
|---|---|---|
| `WORKSPACE_ROOT` | Directory whose direct children are scanned | `/workspace` |
| `HERMES_BIN` | Hermes executable path | `hermes` |
| `HERMES_BOARD_MAP` | JSON mapping of project name to Hermes board slug | `{}` |
| `HERMES_API_URL` | Base URL of the local Hermes API server | `http://127.0.0.1:8642` in the example |
| `HERMES_API_KEY` | Must match Hermes `API_SERVER_KEY` | empty |
| `DASHBOARD_HOSTNAME` | Override explícito do endereço do servidor standalone Node local | `127.0.0.1` |
| `PORT` | Porta host-facing dos servidores Node local (desenvolvimento e standalone) | `3011` |
| `DASHBOARD_PORT` | Porta publicada pelo Compose no loopback do host; o contêiner continua em `3000` | `3011` |

Example board mapping:

```dotenv
HERMES_BOARD_MAP={"QualitasSystem":"qualitas-system","SpockWorkspaceDashboard":"workspace-dashboard"}
```

When a project has no explicit mapping, its lower-case hyphenated name is used as the board slug.

## Hermes Kanban

Create one durable board per project and bind it to the project path:

```bash
hermes kanban board create "QualitasSystem" --slug qualitas-system --workspace /workspace/QualitasSystem
hermes kanban board create "Workspace Dashboard" --slug workspace-dashboard --workspace /workspace/SpockWorkspaceDashboard
hermes kanban board list --json
```

The server adapter calls Hermes with a fixed argument vector; it never invokes a shell. If Hermes or a board is unavailable, the dashboard still renders Git and OpenSpec evidence and labels Hermes unavailable.

## Hermes chat API

According to the current Hermes Agent API Server documentation, add the following to `~/.hermes/.env` on the machine running Hermes:

```dotenv
API_SERVER_ENABLED=true
API_SERVER_KEY=<generate-a-strong-local-secret>
```

Then start the gateway:

```bash
hermes gateway
```

Set the same secret only in this application's local environment:

```dotenv
HERMES_API_URL=http://127.0.0.1:8642
HERMES_API_KEY=<same-local-secret>
```

The browser calls `/api/chat`; the API key remains server-side. CORS is therefore not required for the normal deployment. Do not commit `.env.local` or any credential.

Project scope in chat is conversational context, not an operating-system sandbox. Run the Hermes API as a trusted local process with filesystem and tool permissions restricted appropriately. The dashboard redacts the selected project and workspace roots if Hermes echoes either in a response; do not expose this initial local-only dashboard through a public reverse proxy.

## Docker local e deploy versionado

Os arquivos `Dockerfile` e `compose.yaml` suportam preparação local e releases imutáveis sem alterar Homepage, proxy ou Tailscale. O Compose exige `DASHBOARD_WORKSPACE_PATH`, monta esse workspace como somente leitura, declara `privileged: false` e publica somente em `127.0.0.1` por padrão. Defaults conservadores limitam o serviço a `512m`, `1.0` CPU e `128` PIDs, com logs rotacionados. A imagem não inclui Hermes CLI nem monta Docker socket, devices, home Hermes ou credenciais do host.

O operador executa somente `./scripts/deploy.sh <comando>` como processo filho; nunca faz source de helper nem altera opções no terminal remoto. `build`/`local` são o fluxo local. Uma versão estável exata `MAJOR.MINOR.PATCH` usa manifest GHCR por digest, faz verificação de proveniência, `pull`, `up --no-start --no-build`, inspeção parada e `start`; prerelease, metadata e zeros à esquerda são rejeitados. A chave Hermes é herdada somente pelo processo exato de `up --no-start`; o entrypoint Linux valida device/inode do bind efetivo antes de Node. Ainda não existe tag, versão ou release publicada por esta mudança.

Consulte [`docs/docker-local.md`](docs/docker-local.md) para preparação e [`docs/versioned-deployment.md`](docs/versioned-deployment.md) para produção de release, deploy, rollback, secrets e comandos exatos. `GET /api/health` é somente liveness mínimo e não é autenticação nem readiness das integrações.

## Security model

- discovery is restricted to direct, non-symlinked workspace children and non-symlinked project markers;
- OpenSpec reads are anchored through Linux `/proc/self/fd` directory descriptors with `O_NOFOLLOW`; task files are capped at 1 MB and any unreadable active change makes the source unavailable;
- project identifiers are canonical base64url names and are revalidated against discovery;
- command execution uses fixed `execFile` arguments with timeouts and output limits;
- chat request bodies are streamed and capped at 100 KB before JSON parsing; Hermes response streams are cancelled above 1 MB;
- chat messages are bounded to 4,000 characters and recent history to 20 messages;
- integration errors are normalized before reaching the browser;
- no mutation or arbitrary command endpoint is exposed in this MVP.

## OpenSpec

As mudanças ativas são:

- `add-workspace-agent-dashboard`: implementação local-first original;
- `prepare-containerized-local-deployment`: preparação Docker local/homelab;
- `add-versioned-deployment-export`: exportação de release imutável e CLI terminal-safe.

```bash
npx -y @fission-ai/openspec@1.8.0 validate add-workspace-agent-dashboard --strict
npx -y @fission-ai/openspec@1.8.0 validate prepare-containerized-local-deployment --strict
npx -y @fission-ai/openspec@1.8.0 validate add-versioned-deployment-export --strict
```

A consulta Graphify da nova raiz continua pendente porque `graphify-out/graph.json` não existe; nenhum resultado foi presumido.
