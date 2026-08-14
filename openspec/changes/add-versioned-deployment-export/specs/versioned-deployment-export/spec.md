## ADDED Requirements

### Requirement: Release usa aprovação, ancestralidade e versão estável

Uma release MUST aceitar somente tag exata `vMAJOR.MINOR.PATCH` numérica estável, sem zeros à esquerda, prerelease ou metadata. O workflow MUST usar histórico completo, environment `release` com required reviewers não vazios e `prevent_self_review=true`, e MUST falhar se `GITHUB_SHA` não estiver contido em `origin/main` ou se a tag autoritativa não resolver para esse SHA. Environment/reviewer independente, proteção de `main` e ruleset imutável de tags `v*` MUST existir como gates externos antes da primeira tag.

#### Scenario: Tag aponta para feature commit
- **WHEN** a tag resolve para commit fora de `origin/main`
- **THEN** o workflow falha antes de login, build ou publicação

### Requirement: Versão é build-once e não sobrescrevível

O workflow MUST serializar por versão com cancelamento desabilitado e MUST falhar fechado antes do build quando já existir GitHub Release/asset ou tag GHCR daquela versão. Para provar ausência GHCR, MUST primeiro estabelecer visibilidade autenticada da coleção de pacotes do owner, MUST exigir consistência coleção/endpoint e, se o pacote existir, MUST enumerar todas as versões/tags com sucesso; um `404` isolado MUST NOT provar ausência. Uma imagem parcialmente publicada MUST exigir nova versão. `latest` MUST NOT ser publicada.

#### Scenario: Rerun encontra imagem já publicada
- **WHEN** GHCR já contém a tag numérica da versão
- **THEN** a execução falha e não reconstrói nem sobrescreve a versão

### Requirement: Supply chain é fixada e atestada

Todas as actions MUST ser fixadas por SHA completo revisado com comentário de versão. As três stages MUST usar `node:20.19.5-bookworm-slim@sha256:9e70124bd00f47dd023e349cd587132ae61892acc0e47ed641416c3e18f401c3`; refresh MUST ser deliberado e revisado. O workflow MUST gerar GitHub Artifact Attestation para a imagem OCI com subject digest publicado.

#### Scenario: Imagem é publicada
- **WHEN** o build produz um digest
- **THEN** uma attestation vinculada ao repositório, tag e commit acompanha o subject OCI

### Requirement: Manifest e proveniência falham fechados

O manifest MUST conter exatamente `RELEASE`, `GIT_TAG`, `GIT_SHA`, `BUILT_AT` e `DASHBOARD_IMAGE`; imagem MUST ser exatamente `ghcr.io/jeffersonarpasserini/spock-workspace-dashboard:<versão>@sha256:<digest>`. O arquivo MUST ser regular, não-symlink e não gravável por grupo/outros, com proteção contra troca durante leitura. Antes de `pull`, o CLI MUST exigir `gh >= 2.68.0`, provar por help as flags `--source-ref`, `--source-digest` e `--bundle-from-oci`, confirmar `GIT_TAG → GIT_SHA` pela API de `jeffersonarpasserini/SpockWorkspaceDashboard` e verificar a attestation OCI com source ref e source digest exatos. CLI `gh` antigo/incompatível ou erro de rede/API/attestation MUST bloquear sem bypass.

#### Scenario: Attestation ou tag não corresponde
- **WHEN** verificação não comprova repositório, source tag, source commit e digest
- **THEN** o CLI falha antes de qualquer pull/start

### Requirement: Operação é terminal-safe e target é fixo

O operador MUST executar `scripts/deploy.sh` como processo filho. O executável MUST usar interpretador Bash absoluto em modo privilegiado, desativar tracing e neutralizar `BASH_ENV`/`ENV` antes de ler segredos. Toda operação MUST usar raiz física validada, Compose absoluto e projeto fixo, neutralizando seletores herdados. O CLI MUST capturar a chave em variável não exportada e exportar chave Hermes vazia antes de qualquer filho; somente o processo exato `up --no-start` MAY receber a chave runtime sem imprimi-la. O workspace canonicalizado MUST reter device/inode, ser revalidado antes desse up, permanecer parado durante inspeção efetiva e MUST ter a identidade do bind consumido validada por entrypoint antes da aplicação. A configuração declarada MUST rejeitar overrides de command/entrypoint e a inspeção efetiva MUST confirmar exatamente o gate e o comando Node esperados antes de `start`. Mismatch MUST remover o staged e impedir sucesso; compatibilidade é Linux Docker local que preserve device/inode, sem alegação de atomicidade host/daemon.

#### Scenario: CLI falha em sessão remota
- **WHEN** uma validação falha
- **THEN** somente o processo filho termina não zero e o shell chamador mantém opções/sessão

### Requirement: Deploy é pull-only e sucesso é comprovado

Deploy e rollback versionados MUST executar `pull`, `up --no-start --no-build`, inspeção efetiva parada e `start` para target explícito. Timeouts e intervalo de health MUST ser inteiros positivos. Sucesso MUST exigir health Docker, verifier efetivo com usuário `node` e rootfs read-only, probe comportamental limitado no mesmo CID para UID não-root e `/`/`/workspace` não graváveis sem tentar escrita, e payload HTTP; somente após isso estado restrito sem secrets MUST identificar versão/referência imutável. Falha ou sinal MUST limpar temporários e MUST NOT registrar/alegar sucesso. `down` MUST permanecer limitado à stack fixa.

#### Scenario: Health fica unhealthy ou expira
- **WHEN** a verificação não conclui
- **THEN** o CLI retorna não zero, não registra a versão e não imprime credenciais

### Requirement: Workspace e integrações externas permanecem limitados

Operações MUST exigir `DASHBOARD_WORKSPACE_PATH` absoluto/existente e MUST NOT alterar Homepage, proxy ou Tailscale.

#### Scenario: Workspace não foi configurado
- **WHEN** operador chama o CLI
- **THEN** ele falha antes de Docker com orientação concisa
