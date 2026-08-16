## Context

Retenção atravessa fontes com autoridades diferentes. O PostgreSQL do control plane pode aplicar política diretamente; Hermes, Orchestrator, observabilidade e backups exigem adaptadores e confirmações. A ausência de confirmação nunca será convertida em sucesso.

## Goals / Non-Goals

**Goals:** matriz versionada; minimização; holds limitados; purge idempotente; propagação a derivados/backups; evidência sanitizada; modo dry-run.

**Non-Goals:** política legal universal; eliminação retroativa sem inventário; acesso direto a bancos alheios; limpeza durante esta mudança documental.

## Decisions

### Matriz versionada e precedência

Cada classe declara owner, classificação, base temporal, período ativo, período tombstone, prazo de destruição, derivados e exceções. Hold de evidência/incidente prevalece sobre purge, mas precisa de escopo, autoridade, justificativa, expiração e auditoria. Dados de custos preservam fatos financeiros mínimos; payloads e identificadores desnecessários podem ser reduzidos.

### Estados explícitos

O ciclo é `active -> expired -> tombstoned -> purged`, com `held` como bloqueio ortogonal. Tombstones não contêm o conteúdo removido. Jobs usam cursor e idempotency key, lotes e limites de tempo; falha parcial é retomável.

### Exclusão distribuída e backups

Adaptadores retornam `confirmed`, `pending`, `unsupported` ou `failed`. Backups imutáveis não são regravados silenciosamente: expiram por geração, recebem inventário de exclusões pendentes e não podem restaurar conteúdo tombstonado sem reconciliação pós-restore.

### Privacidade e segurança

Planos e auditorias carregam IDs opacos, classe, regra, contagens e resultado; nunca payload, token, prompt privado ou segredo. Worktrees são removidos somente sob run root canônico, sem seguir symlinks. Destruição usa primitivas suportadas pelo storage; não promete secure erase físico em mídia abstrata.

## Trust boundaries and degraded mode

- O control plane governa apenas seu banco e artefatos próprios.
- Sistemas externos confirmam ações por adaptadores autenticados separados.
- Adaptador indisponível mantém item `pending`; readiness de privacidade fica degradada.
- Regra ausente, contraditória ou com hold ambíguo bloqueia purge.

## Testing

Testes de tabela para todas as classes, relógio controlado, property tests de idempotência, concorrência de claims, symlink/path escape, redaction, restore de backup antigo e falhas parciais. Integrações destrutivas usam fixtures isoladas.

## Rollback

Antes de purge, rollback desativa scheduler e preserva planos. Após destruição confirmada não há rollback do conteúdo; recuperação só pode usar backup ainda autorizado, passando por reconciliação de tombstones.

