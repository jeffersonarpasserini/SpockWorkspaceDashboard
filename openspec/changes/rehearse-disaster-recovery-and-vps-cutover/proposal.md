## Why

A portabilidade geral não define objetivos mensuráveis nem prova que um backup pode recuperar o workspace sem split-brain. Antes de uma VPS real, o projeto precisa de RPO/RTO, criptografia, assinatura, rotação de chaves, restore periódico, freeze final e rollback verificável.

## What Changes

- Definir tiers de dados e objetivos RPO/RTO aprovados.
- Especificar backup consistente, assinado, criptografado, rotacionado e testado.
- Ensaiar restore isolado, cutover, prevenção de split-brain e rollback.
- Manter implantação e cutover reais bloqueados enquanto a VPS estiver adiada.

## Goals

Recuperabilidade comprovada, operação reproduzível e decisão de cutover baseada em evidência.

## Non-Goals

Provisionar VPS, alterar DNS/TLS/Tailscale, congelar o servidor local ou executar cutover nesta mudança.

## Operational risks

Backups inconsistentes, perda de chaves, restore de dados já excluídos, dois primários graváveis e rollback depois de novas escritas.

## Affected data sources

Bancos separados, estado consistente Hermes suportado, repositórios/revisões OpenSpec, manifests, secret references e tombstones. Segredos em claro, caches, logs e worktrees continuam excluídos.

## Capabilities

### New Capabilities

- `disaster-recovery-and-vps-cutover`: objetivos, backup protegido, restore periódico, freeze/cutover e rollback sem split-brain.

