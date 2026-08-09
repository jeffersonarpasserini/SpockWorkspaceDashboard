# Change: Add workspace agent dashboard

## Why

Project status, OpenSpec progress, Git state and Hermes Agent work are currently spread across local repositories, CLI commands and the Hermes Kanban board. A single local-first dashboard is needed to communicate with Hermes and understand what agents are doing, what remains pending and the overall state of every project in the workspace.

## Goals

- Discover projects under a configured workspace root and present evidence-based summaries.
- Show project-level Git and OpenSpec progress without treating file presence as completion.
- Present a Kanban view combining live Hermes tasks with pending/completed OpenSpec tasks.
- Identify running, blocked and assigned agent work.
- Provide a project-scoped chat surface backed by the Hermes API server.
- Continue operating in a clearly marked degraded mode when an integration is unavailable.

## Non-goals

- Reimplement the Hermes dispatcher or write directly to `kanban.db`.
- Replace OpenSpec, GitHub Projects or the existing Hermes dashboard.
- Expose credentials, arbitrary filesystem paths or unrestricted shell execution to the browser.
- Claim CI, deployment or release status without an authoritative integration.

## Data sources

- Configured workspace filesystem and project markers.
- Git CLI for local branch/worktree evidence.
- OpenSpec `openspec/changes/**/tasks.md` and project metadata.
- Hermes `kanban ... --json` CLI for board state.
- Hermes OpenAI-compatible API server for conversations.

## Risks

- Projects may have inconsistent OpenSpec task formats.
- Hermes may not be installed in the web server environment.
- Board names may not match project directory names.
- Large workspaces require bounded scanning and refresh behavior.
- Chat and task data can contain sensitive operational information.

## Impact

This creates a new standalone project. It does not modify QualitasSystem or Hermes Agent. The first release is local-only and read-mostly; chat is the only remote side effect and is routed through the configured Hermes API server.
