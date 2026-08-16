## Why

O projeto conhece partes da topologia Hermes, mas ainda não possui contrato para provar que gateways e dependências containerizados são equivalentes ao runtime atual. Empacotar cedo demais pode perder acesso aos planos por assinatura da OpenAI e do Alibaba, corromper estado de perfis ou mudar semântica de sessão.

## What Changes

- Inventariar processos, gateways por perfil, Honcho, PostgreSQL/pgvector, Redis, volumes, redes e ownership.
- Definir testes de equivalência comportamental para autenticação por assinatura/token plan, sessões, ferramentas, streaming, cancelamento e recovery.
- Especificar uma composição definitiva futura, health/readiness, ordem de startup, persistência, backup e rollback.
- Proibir ativação até equivalência, segurança e recuperação serem aprovadas.

## Goals

Containerização reproduzível sem perder as capacidades exclusivas fornecidas pelo Hermes.

## Non-Goals

Substituir Hermes, acessar provedores diretamente, copiar credenciais para imagens, iniciar containers definitivos ou autorizar dispatch real.

## Operational risks

Perda de autenticação por assinatura, diferenças de gateway, estado SQLite inconsistente, exposição de portas internas e dependências iniciadas fora de ordem.

## Affected data sources

Configuração e estado Hermes referenciados, gateways de perfis, Honcho, PostgreSQL/pgvector, Redis, logs e volumes. Prompts privados e credenciais permanecem fora de imagens e manifests.

## Capabilities

### New Capabilities

- `hermes-runtime-topology`: inventário, equivalência, composição futura, persistência, health, startup e rollback do runtime Hermes.

