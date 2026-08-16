## Why

O control plane já define eventos append-only, retenção técnica e exports, mas ainda não possui uma matriz normativa que diga por quanto tempo cada classe de dado vive, quando pode ser anonimizada, tombstonada ou destruída e quando evidência, auditoria ou incidente impõem preservação. Sem esse contrato, limpeza pode apagar prova necessária ou backups podem reter dados que o runtime já excluiu.

## What Changes

- Definir classificação e matriz versionada para eventos, runs, sessões, uso/custos, auditoria, observações, logs, worktrees e backups.
- Separar expiração lógica, tombstone, anonimização, destruição física e legal/evidence hold.
- Propagar exclusões para derivados, exports e backups dentro de prazos mensuráveis, preservando somente provas mínimas autorizadas.
- Implementar planejamento, execução idempotente, auditoria sanitizada e verificação de jobs de retenção.

## Goals

- Tornar retenção e privacidade determinísticas, revisáveis e fail-closed.
- Preservar integridade contábil, auditoria e evidência sem reter payloads desnecessários.
- Impedir que logs, worktrees, observações e backups virem retenção indefinida acidental.

## Non-Goals

- Alegar conformidade jurídica específica sem revisão competente.
- Apagar dados vivos nesta mudança de especificação.
- Autorizar dispatch, integração observacional ao vivo ou acesso a provedores.

## Operational risks

- Política incorreta pode causar perda irreversível ou retenção excessiva.
- Holds podem ser abusados para impedir expiração; exigem autoridade, motivo e prazo.
- Exclusão em backups é assíncrona e precisa de prazo e prova próprios.

## Affected data sources

PostgreSQL do dashboard, projeções do Orchestrator, sessões Hermes observadas, logs, telemetria, worktrees temporários, exports e backups. Bancos e credenciais de outros serviços permanecem fora da autoridade direta do dashboard.

## Capabilities

### New Capabilities

- `runtime-data-retention-and-privacy`: classificação, retenção, holds, tombstones, exclusão verificável e minimização de dados operacionais.

