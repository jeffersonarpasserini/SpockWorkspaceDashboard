# Design: Workspace Agent Dashboard

## Architecture

Use a Next.js App Router application with React and TypeScript. Server components and route handlers call typed adapters; the browser never receives filesystem roots, command paths or Hermes credentials.

### Adapters

1. `WorkspaceRepository`
   - Scans only direct children of `WORKSPACE_ROOT` by default.
   - Recognizes `.git`, `openspec`, common package/build files and `AGENTS.md`.
   - Rejects resolved paths outside the configured root.

2. `GitRepository`
   - Uses `execFile` with fixed Git arguments and a bounded timeout.
   - Returns branch, clean/dirty state and latest local commit.
   - Returns an unavailable state instead of failing the whole page.

3. `OpenSpecRepository`
   - Reads active change artifacts and parses Markdown checkboxes.
   - On Linux, opens the project and every nested OpenSpec component through anchored `/proc/self/fd` directory descriptors with `O_NOFOLLOW`, preventing directory-swap races.
   - Caps each task file at 1 MB, counts every non-hidden active-looking change entry and marks the source unavailable if any entry is non-directory, symlinked, missing, unsafe, unreadable or oversized while preserving observed partial counts.
   - Preserves task text and section/change provenance.
   - Maps unchecked tasks to `todo` and checked tasks to `done`.

4. `HermesKanbanRepository`
   - Uses the documented `hermes kanban --board <slug> list --json` surface.
   - Never reads or writes `kanban.db` directly.
   - Accepts only recognized task-array response shapes; malformed JSON objects make the source unavailable.
   - Maps native statuses `triage|todo|ready|running|blocked|done|archived` without collapsing running or blocked work.
   - Falls back to an unavailable state when Hermes or the board is absent.

5. `HermesChatClient`
   - Calls `${HERMES_API_URL}/v1/chat/completions` server-side.
   - Uses `HERMES_API_KEY` only in the Authorization header.
   - Adds the verified project path as an untrusted-data descriptor in the system message.
   - Carries at most 20 validated recent conversation messages because the Hermes endpoint is stateless.
   - Applies a 60-second timeout and incrementally enforces a 1 MB response-size limit, cancelling both declared-oversized and streamed-oversized bodies without buffering the remainder.
   - Redacts the verified project and workspace roots if the assistant echoes either in a browser response.
   - Provides conversational project context only; filesystem/tool isolation remains the responsibility of the trusted local Hermes API process.

## Status derivation

Project summaries expose separate evidence fields and one conservative label:

- `blocked`: any live Hermes task is blocked.
- `in_progress`: any Hermes task is running or ready, or any OpenSpec task is unchecked.
- `complete_locally`: Git, OpenSpec and Hermes are all available, every discovered OpenSpec task is checked, and no live task is pending/running/blocked.
- `unknown`: no sufficient OpenSpec or Kanban evidence.

`complete_locally` is not equivalent to integrated, CI-green or released.

## UI

Linear-inspired dark interface:

- Workspace overview with project cards, status, OpenSpec progress and active-agent count.
- Project detail with evidence header and seven Kanban columns.
- Running cards grouped visually by assignee.
- Pending OpenSpec cards carry their change and section provenance.
- Project-scoped chat drawer with clear unavailable/error states.
- Responsive single-column board on small screens and horizontal board scrolling on desktop.

## Security and privacy

- Resolve and validate every project identifier against the discovered project set.
- Never accept arbitrary command arguments or shell strings from the client.
- Do not return environment variables, absolute roots or API tokens.
- Do not represent prompt-level project context as an operating-system sandbox; remote exposure requires a separate authenticated deployment change.
- Sanitize integration errors before returning them.
- Chat request and response bodies are incrementally bounded before JSON parsing; integration errors are sanitized.
- The default server binds for local development only.

## Refresh and consistency

Use dynamic server rendering with explicit refresh controls. API responses disable durable caching. The UI displays the observation timestamp and source availability so stale or partial evidence is visible.

## Testing

- Unit tests for checkbox parsing, status derivation, path containment and Kanban normalization.
- Component tests for project cards, unavailable integrations and Kanban rendering.
- Route tests with injected/fake adapters for project and chat behavior.
- Production build and browser smoke test against fixture workspace data.

## Deployment

Initial deployment is local with environment variables:

- `WORKSPACE_ROOT`
- `HERMES_BIN` (optional, defaults to `hermes`)
- `HERMES_BOARD_MAP` (optional JSON map of project name to board slug)
- `HERMES_API_URL` (optional)
- `HERMES_API_KEY` (optional, server-side only)

A later change may add authentication and remote deployment. This change does not expose the service publicly.
