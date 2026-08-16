## 1. Foundation

- [x] 1.1 Create the Next.js TypeScript application, scripts, linting and test harness.
- [x] 1.2 Add environment schema, typed domain model and local development documentation.
- [x] 1.3 Add Linear-inspired responsive design tokens and application shell.

## 2. Workspace overview — TDD slice

- [x] 2.1 RED: add failing tests for safe project discovery and path containment.
- [x] 2.2 GREEN: implement bounded workspace discovery and containment.
- [x] 2.3 RED: add failing tests for Git/OpenSpec evidence and conservative status derivation.
- [x] 2.4 GREEN: implement Git/OpenSpec adapters and project summary service.
- [x] 2.5 RED/GREEN: implement overview components for projects, progress and unavailable sources.

## 3. Project Kanban — TDD slice

- [x] 3.1 RED: add failing tests for Hermes JSON normalization and all native statuses.
- [x] 3.2 GREEN: implement shell-free Hermes Kanban adapter with timeout and degraded mode.
- [x] 3.3 RED/GREEN: merge OpenSpec tasks with Hermes tasks without losing provenance.
- [x] 3.4 RED/GREEN: implement project detail and responsive seven-column Kanban.
- [x] 3.5 Show running work by assignee, blocked reasons and evidence timestamps.

## 4. Hermes conversation — TDD slice

- [x] 4.1 RED: add failing tests for project-scoped chat, input limits and unavailable API.
- [x] 4.2 GREEN: implement server-side Hermes API client and chat route.
- [x] 4.3 RED/GREEN: implement chat drawer, transcript and sanitized failure states.

## 5. Validation and delivery

- [x] 5.1 Run unit/component/route tests and confirm zero unexplained failures.
- [x] 5.2 Run lint, typecheck and production build.
- [x] 5.3 Run browser smoke tests for overview, project Kanban, degraded integrations and responsive layout.
- [x] 5.4 Document configuration, architecture, trust boundaries and operating procedure.
- [x] 5.5 Run `openspec validate add-workspace-agent-dashboard --strict` and correct all errors.
- [x] 5.6 Generate Graphify and cross-check project relationships; retain the dated evidence and query limitations in `docs/graphify-evidence.md`.
- [x] 5.7 Review the complete diff, repository state and exclude generated/private data.
- [x] 5.8 Create the private GitHub repository, push `main`, verify the immutable remote commit and inspect GitHub Actions, checks and branch protection; none are configured in this initial repository.

## 6. Independent-review corrections

- [x] 6.1 Reproduce the reported OpenSpec symlink escape and confirm the current `lstat` guard and regression test reject it.
- [x] 6.2 RED: prove that missing Git or Hermes evidence cannot result in `complete_locally`.
- [x] 6.3 GREEN: gate local completion on all three evidence sources being available.
- [x] 6.4 RED: prove that an assistant response cannot echo the verified absolute project path to the browser.
- [x] 6.5 GREEN: redact project-root paths and state clearly that chat scope is prompt-based, not an execution sandbox.
- [x] 6.6 Bound each OpenSpec task file to 1 MB and eliminate the lstat/read race by validating the opened inode.
- [x] 6.7 Rerun unit, type, lint, build, browser, audit and strict OpenSpec validation.
- [x] 6.8 Obtain an independent review of the corrected current diff.

## 7. Nested-containment corrections

- [x] 7.1 RED: prove symlinked project markers, `openspec` directories and `openspec/changes` directories cannot expose external tasks.
- [x] 7.2 GREEN: reject symlinked markers and resolve OpenSpec parent directories canonically within the verified project.
- [x] 7.3 Stop and cancel Hermes response streams immediately when the 1 MB byte limit is exceeded.
- [x] 7.4 Re-run all local quality gates on the exact corrected diff.
- [x] 7.5 Obtain independent approval of the exact corrected diff.

## 8. Inbound request bounding

- [x] 8.1 RED: prove an oversized chunked chat request is cancelled before complete buffering.
- [x] 8.2 GREEN: stream and cap the inbound chat request before JSON parsing.
- [x] 8.3 Re-run all local quality gates on the exact corrected diff.
- [x] 8.4 Obtain independent approval of the exact corrected diff.

## 9. Descriptor-anchored OpenSpec reads

- [x] 9.1 Anchor project, OpenSpec, changes, change and task opens through Linux `/proc/self/fd` descriptors with `O_NOFOLLOW`.
- [x] 9.2 Mark OpenSpec evidence unavailable whenever any active change cannot be read completely while preserving observed partial counts.
- [x] 9.3 Re-run all local quality gates on the exact corrected diff.
- [x] 9.4 Obtain independent approval of the exact corrected diff.

## 10. Normative status alignment

- [x] 10.1 RED: prove an entirely unchecked OpenSpec backlog is `in_progress` as required by the specification.
- [x] 10.2 GREEN: align status derivation with the normative unchecked-task scenario.
- [x] 10.3 Re-run all local quality gates on the exact corrected diff.
- [x] 10.4 Obtain independent approval of the exact corrected diff.

## 11. Hermes evidence shape validation

- [x] 11.1 RED: prove an unrecognized Hermes JSON object is unavailable rather than an empty successful board.
- [x] 11.2 GREEN: reject malformed Hermes response shapes before status derivation.
- [x] 11.3 Re-run all local quality gates on the exact corrected diff.
- [x] 11.4 Obtain independent approval of the exact corrected diff.

## 12. Unsafe-entry and early-cancellation handling

- [x] 12.1 RED: prove a symlinked active change makes OpenSpec unavailable and remains counted as incomplete evidence.
- [x] 12.2 RED: prove a declared-oversized body is cancelled before rejection.
- [x] 12.3 GREEN: validate every active-looking change entry and cancel declared-oversized streams.
- [x] 12.4 Re-run all local quality gates on the exact corrected diff.
- [x] 12.5 Obtain independent approval of the exact corrected diff.

## 13. Status vocabulary cleanup

- [x] 13.1 Remove the obsolete `planned` status from the domain type, UI mapping and CSS.
- [x] 13.2 Align design documentation with the normative unchecked-task `in_progress` rule.
- [x] 13.3 Re-run all local quality gates on the exact corrected diff.
- [x] 13.4 Obtain independent approval of the exact corrected diff.
