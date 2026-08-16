# Graphify evidence

Last verified: 2026-08-15 (America/Sao_Paulo)

`graphify update .` completed successfully for this repository and retained the current topology at 1,181 nodes, 1,622 edges and 110 communities. The generated artifacts are `graphify-out/graph.json`, `graphify-out/graph.html` and `graphify-out/GRAPH_REPORT.md`.

The relationship query cross-checked the control plane, runtime retention/privacy, disaster recovery and VPS cutover, Hermes runtime topology, Docker deployment and Tailscale access. It confirmed these boundaries:

- retention policy and tombstone reconciliation precede recovery readiness and VPS cutover;
- cutover requires final sync, write freeze and fencing and is not authorized by portable deployment artifacts;
- Hermes remains the provider-access boundary and per-profile provider/model/billing equivalence precedes container traffic switching;
- Docker liveness and Tailscale reachability do not imply application authorization or dispatch readiness;
- destructive purge, real dispatch, credential movement, definitive Hermes containers and VPS cutover each require their own later approval gate.

The traversal found 248 related nodes at depth two and displayed 48 within the query output budget. This truncation is recorded as a search-output limitation, not as missing graph data. Two JSON fixtures (`dashboard-projection.v1.json` and `orchestrator-contract.v1.json`) produced zero AST nodes; they remain source fixtures validated by tests and OpenSpec rather than executable graph nodes.
