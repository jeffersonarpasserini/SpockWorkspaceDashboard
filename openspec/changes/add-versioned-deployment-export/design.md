## Context

A mudança prepara release build-once/deploy-many sem publicar ou implantar. Os blockers exigem aprovação externa verificável, imutabilidade por versão, pins completos, proveniência OCI e contrato de versão estável.

## Goals / Non-Goals

**Goals:** somente `MAJOR.MINOR.PATCH`; commit contido em `main`; environment aprovado; concorrência/preflight imutável; actions/base por digest; attestation; manifest publisher exato; verificação autoritativa antes do pull; CLI terminal-safe; estado restrito após health.

**Non-Goals:** criar proteção/tag/release agora; executar Docker; publicar `latest`; alterar Homepage/proxy/Tailscale; persistir credenciais.

## Decisions

### Gates externos e fail-closed

O job usa `environment: release`, fetch completo e ancestry contra `origin/main`. Consulta required reviewers não vazios, `prevent_self_review=true` e tag pela API. Required reviewer independente, proteção de main e ruleset ativo/imutável de `refs/tags/v*` são pré-requisitos documentados; incapacidade de comprová-los bloqueia release.

### Build once por versão

Concorrência usa a tag e `cancel-in-progress: false`. Preflight rejeita Release/asset ou tag GHCR existente e erros de API. Ausência GHCR exige primeiro visibilidade autenticada da coleção de pacotes, consistência com o endpoint do pacote e enumeração completa de versões quando ele existe; `404` isolado não prova ausência. Publicação parcial exige nova versão; não há latest, overwrite ou force-tag suportado.

### Supply chain e proveniência

Actions são pins SHA revisados. Todas as stages Node compartilham digest manifest-list aprovado, atualizado somente deliberadamente. A imagem exata `ghcr.io/jeffersonarpasserini/spock-workspace-dashboard` recebe attestation OCI ligada ao digest.

### Deploy verificado

Manifest estável e seguro fixa tag/SHA/digest. `gh >= 2.68.0`, com probe fail-closed das flags `--source-ref`, `--source-digest` e `--bundle-from-oci`, confirma a tag no repositório autoritativo e verifica attestation antes de Docker pull. Deploy captura a chave sem exportá-la, mantém todos os filhos em chave vazia e a injeta somente no processo exato `up --no-start --no-build`; inspeção parada, `start`, health e probe comportamental limitado no CID fixo seguem sem chave. A projeção exige o usuário de imagem literal `node` e rootfs read-only; após health, o probe exige UID não-zero e `/`/`/workspace` não graváveis sem tentar escrita.

### Robustez operacional

O CLI é processo filho com shebang absoluto `/bin/bash -p`; antes de ler o secret, desativa tracing e remove `BASH_ENV`/`ENV`, evitando startup hooks e opções/funções importadas. Depois neutraliza Compose herdado e elimina herança do secret. Arquivos manifest são regulares/não-symlink, não graváveis por grupo/outros e lidos com identidade estável. O workspace retém device/inode; `up --no-start` fixa o bind, inspeção ocorre parado e um entrypoint Linux compara a identidade efetiva antes de Node. Isto impede serviço sobre replacement sem prometer atomicidade host/daemon. Remapeamento de inode (daemon remoto/Desktop/filesystem incompatível) falha fechado. Temporários e staged limpam em falha/sinais; estado 0600 só atualiza depois de health/verifiers/liveness.

## Testing

Vitest usa gh/docker/curl mockados para versão, publisher, symlink/permissão, attestation/tag, CLI antigo, pull ordering, health, estado e segredo. Gates finais: Vitest constrangido, typecheck, lint, build, E2E exato, OpenSpec strict, bash/YAML, audit e diff.

## Rollback

Executar explicitamente versão anterior verificada. `down` remove somente stack fixa e estado local após sucesso. Nenhum serviço externo é alterado.
