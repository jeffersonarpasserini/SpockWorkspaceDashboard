## Context

Esta mudança especializa `workspace-portability` e depende da matriz de retenção. A VPS segue adiada; todos os ensaios usam destinos isolados ou infraestrutura efêmera.

## Goals / Non-Goals

**Goals:** RPO/RTO mensurável; backups consistentes; envelope encryption; assinatura; rotação; restore periódico; fencing; rollback.

**Non-Goals:** selecionar provedor VPS; executar produção; transportar segredos em bundles; prometer disponibilidade sem medição.

## Decisions

### Objetivos por tier

Dados são classificados por criticidade. RPO e RTO são registrados com owner, método de medição e dependências. Um objetivo não testado aparece como `unproven`, nunca como atendido.

### Proteção criptográfica

Cada bundle usa chave de dados aleatória e criptografia autenticada; a chave é envelopada por uma chave externa rotacionável. Manifest e checksums recebem assinatura verificável. Chaves e bundles ficam em limites separados; rotação re-envelopa quando suportado sem descriptografar conteúdo para disco compartilhado.

### Consistência e restore

Backups usam snapshots/dumps suportados e coordenados. SQLite/WAL/SHM nunca é copiado separadamente. Restore ocorre em databases/diretórios isolados, sem tráfego, e aplica migrations, ownership, secret references e tombstones antes de smoke/readiness.

### Cutover e fencing

O freeze registra última revisão e cursor. Um fencing token/lease torna apenas um lado gravável. DNS/proxy só muda depois da verificação final. Rollback exige parar/fencear a VPS antes de reabrir o servidor antigo e reconciliar qualquer escrita pós-freeze.

## Trust boundaries and degraded mode

Backup operator não recebe automaticamente material de chave. Falha de assinatura, decryption, secret reference, revisão ou fencing bloqueia restore/cutover. Dependência externa indisponível mantém objetivo degradado.

## Testing

Fixtures corrompidas, chave errada/rotacionada, versão incompatível, restore periódico, medição RPO/RTO, freeze concorrente, lease expirado, DNS simulado e rollback com escrita pós-freeze.

## Rollback

Ensaios descartam somente destinos isolados. Cutover real exigirá mudança operacional aprovada, janela, contatos, critérios go/no-go e rollback testado.

