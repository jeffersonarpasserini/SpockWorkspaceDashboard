## Context

Hermes é necessário porque fornece acesso aos planos por assinatura da OpenAI/Codex e Alibaba Token Plan. A containerização deve preservar essa fronteira, não reimplementar providers. Esta mudança depende de observação estável e de backup/retenção, e fica posterior à equivalência comportamental.

## Goals / Non-Goals

**Goals:** inventário autoritativo; matriz host/container; contract tests; dependências explícitas; volumes mínimos; health/readiness; rollback misto.

**Non-Goals:** migração imediata; provider direto como caminho principal; credenciais em Compose; dispatch; expor gateways publicamente.

## Decisions

### Equivalência antes de composição

Cada perfil recebe um contrato de capabilities, provider/model observado, billing mode, sessão, tools, stream, cancelamento e recovery. `flash-0731` permanece Alibaba Token Plan; reservas diretas não são tratadas como equivalentes. Diferença bloqueia migração do perfil afetado.

### Topologia e ownership

O manifest classifica componentes como container-owned, host-owned ou external. Um componente tem uma única autoridade de restart e persistência. Internal APIs, PostgreSQL e Redis usam redes privadas e usuários/volumes separados.

### Estado e secrets

Imagens não contêm home Hermes, tokens, cookies ou prompts. Secrets entram por references e mounts mínimos read-only quando inevitáveis. SQLite usa backup/checkpoint suportado ou quiesce; WAL/SHM não são copiados isoladamente.

### Startup, readiness e rollback

Ordem: storage/memory, migrations/checks, Honcho/auxiliares, gateway por perfil e então consumidores. Health de processo não basta: readiness executa probe local não faturável quando possível e confirma capability/billing esperado. Rollback pode manter perfis incompatíveis no host; nunca permite dois gateways graváveis para a mesma identidade de sessão.

## Trust boundaries and degraded mode

Dashboard observa estado sanitizado e não recebe secrets. Hermes conserva provider access. Orchestrator usa API versionada. Falha de um perfil degrada somente suas rotas; ausência de evidência de billing/provider bloqueia uso pago e não aciona fallback implícito.

## Testing

Contract tests host/container, fixtures de profiles, restart/kill, volume ownership, rede/porta, secret scanning, backup/restore, upgrade/downgrade e soak sem dispatch produtivo.

## Rollback

Parar e fencear o gateway containerizado, restaurar estado compatível quando necessário e reativar o gateway host verificado. O Compose definitivo só poderá ser ativado por mudança posterior aprovada.

