# Deploy versionado (build once / deploy many)

> Esta mudança não cria tag, versão, imagem GHCR, GitHub Release nem deploy. Ela somente prepara um processo fail-closed.

O contrato público aceita somente versões estáveis numéricas `MAJOR.MINOR.PATCH`, sem prefixo no CLI/manifest, e tags exatas `vMAJOR.MINOR.PATCH`. Prerelease (`-rc.1`), metadata (`+build`), zeros à esquerda e formatos parciais são rejeitados.

## Gate externo obrigatório antes da primeira tag

**Não crie a primeira tag enquanto todos os itens abaixo não estiverem ativos e verificados.** Este repositório não configura essas proteções por workflow.

1. Em **Settings → Environments → release**, crie o environment `release`, adicione pelo menos um **Required reviewer** independente e desabilite self-review. O job usa `environment: release` e ainda consulta a API; se a proteção não puder ser comprovada, a release falha.
2. Em **Settings → Rules → Rulesets**, crie um ruleset ativo com target **Tags**, inclusão `refs/tags/v*`, bloqueio de update/force-change e deletion, e criação restrita aos release managers aprovados. Não conceda bypass ao `GITHUB_TOKEN`. Esse gate torna tags de versão imutáveis.
3. Mantenha `main` como default branch protegida, com merge/review/status gates. O workflow faz checkout com histórico completo e exige que `GITHUB_SHA` seja ancestral de `origin/main`; uma tag em feature commit falha.
4. Garanta que GitHub Actions possa gravar Contents, Packages, ID token e Attestations, e que a API possa ler environment/ruleset/package/release. O job usa permissões somente para essas operações.

**Estado observado na revisão final:** no host Linux Docker `bumblebee`, `verify` e `status` retornaram rc 0 no commit `3908841`, incluindo o probe corrigido de isolamento, sobre o contêiner criado pelo fluxo anterior. O rerun completo de `deploy.sh local` no mesmo commit permanece pendente para fechar a evidência de build/criação/start. O environment `release` continua ausente, não há ruleset ativo e `main` permanece sem proteção; tag e release seguem bloqueadas.

Gate verificável (requer `gh` autenticado com acesso administrativo de leitura):

```bash
repo=jeffersonarpasserini/SpockWorkspaceDashboard
gh api "repos/$repo" --jq '.default_branch'                         # deve imprimir main
gh api "repos/$repo/environments/release" \
  --jq '[.protection_rules[] | select(.type=="required_reviewers") | {prevent_self_review, reviewers}]'
gh api --paginate "repos/$repo/rulesets" \
  --jq '.[] | select(.target=="tag" and .enforcement=="active") | [.id,.name] | @tsv'
# Para cada id retornado, confira conditions.ref_name.include contendo refs/tags/v*
# e rules protegendo creation/update/deletion, além de bypass_actors vazio/explicitamente aprovado:
gh api "repos/$repo/rulesets/<ID>"
```

Qualquer saída ausente, erro `403/404`, reviewer vazio, ruleset inativo, filtro divergente ou bypass não aprovado é **bloqueador de release**. A revisão desses gates deve ser registrada antes da tag; não há fallback nem bypass no workflow.

## Publicação imutável e proveniência

`.github/workflows/release.yml`:

- serializa por versão (`release-${tag}`, sem cancelamento de execução em andamento);
- aceita apenas tag estável exata e confirma tag/commit pela API autoritativa;
- recusa commit fora de `origin/main` ou environment sem reviewer não vazio e `prevent_self_review=true` verificáveis;
- falha antes do build em rerun e se já existir workflow artifact, GitHub Release/asset ou tag GHCR da versão; para GHCR, primeiro exige visibilidade autenticada da coleção do owner, compara coleção/endpoint do pacote e, se existente, enumera todas as versões; um `404` isolado nunca prova ausência;
- publica somente `ghcr.io/jeffersonarpasserini/spock-workspace-dashboard:<versão>` — nunca `latest`;
- captura o digest, cria GitHub Artifact Attestation OCI e exporta `releases/<versão>.env` como artifact e asset;
- usa actions fixadas por SHA completo revisado.

Uma execução parcialmente publicada (por exemplo, imagem enviada e release falha) **não pode ser repetida para a mesma versão**. Corrija a causa e use uma versão nova. Não force/mova tags e não apague assets para reutilizar número.

O manifest contém exatamente:

```dotenv
RELEASE=1.2.3
GIT_TAG=v1.2.3
GIT_SHA=<sha-completo-minúsculo>
BUILT_AT=<UTC-ISO-8601>
DASHBOARD_IMAGE=ghcr.io/jeffersonarpasserini/spock-workspace-dashboard:1.2.3@sha256:<digest>
```

As três stages do `Dockerfile` usam `node:20.19.5-bookworm-slim` fixado no manifest-list digest aprovado `sha256:9e70124bd00f47dd023e349cd587132ae61892acc0e47ed641416c3e18f401c3`. Atualização de Node/base **exige mudança deliberada desse digest**, revisão do Dockerfile, testes, documentação e nova versão; nunca remova o pin para obter atualização automática.

## Preparação local

Execute sempre o CLI como processo filho; nunca use `source` ou `.`:

```bash
export DASHBOARD_WORKSPACE_PATH=/srv/workspaces
./scripts/deploy.sh validate
./scripts/deploy.sh build
./scripts/deploy.sh local
```

`build` é somente local. Deploy de release nunca compila no host. O CLI inicia com `/bin/bash -p`, tracing desativado e `BASH_ENV`/`ENV` removidos, fixa raiz/Compose/projeto, remove seletores Compose herdados, captura a chave em variável não exportada e exporta `HERMES_API_KEY=` antes de qualquer filho. Somente o processo exato `docker compose ... up --no-start` recebe a chave salva; Git, `stat`, verifiers, `gh`, pull, inspect, start, health, probe de isolamento e estado recebem vazio e nenhum comando imprime credenciais. O workspace conserva device/inode; o contêiner é criado parado, inspecionado e seu entrypoint compara a identidade do bind efetivo antes de executar Node. Evite `docker compose config`, `docker inspect` amplo, `exec env`, logs e bundles de debug quando houver secrets.

## Baixar, verificar e implantar

Pré-requisitos do host: Linux com Docker/Compose, `curl`, Python 3, GNU coreutils `timeout` com suporte a `--kill-after`, `gh >= 2.68.0` autenticado para ler o repositório/attestation e login GHCR somente de leitura. Além do limite de versão, o CLI consulta `gh attestation verify --help` e exige `--source-ref`, `--source-digest` e `--bundle-from-oci`; capacidade ausente falha fechado. CLI antigo, `timeout` incompatível, API indisponível, tag divergente ou attestation inválida são erros fatais; nunca bypass a verificação.

```bash
mkdir -p releases
umask 077
gh release download v1.2.3 --repo jeffersonarpasserini/SpockWorkspaceDashboard \
  --pattern '1.2.3.env' --dir releases
chmod 600 releases/1.2.3.env
./scripts/deploy.sh validate 1.2.3
./scripts/deploy.sh 1.2.3
```

Antes de `pull`, o CLI exige manifest regular não-symlink e não gravável por grupo/outros, compara `GIT_TAG → GIT_SHA` pela API autoritativa e executa o equivalente a:

```bash
gh attestation verify 'oci://ghcr.io/jeffersonarpasserini/spock-workspace-dashboard:1.2.3@sha256:<digest>' \
  --repo jeffersonarpasserini/SpockWorkspaceDashboard \
  --source-ref refs/tags/v1.2.3 --source-digest '<GIT_SHA>' --bundle-from-oci
```

Só então executa `pull` sem chave, `up --no-start --no-build` com a chave opcional, inspeção efetiva ainda sem processo e `start` sem chave. A inspeção exige `User=node` e `ReadonlyRootfs=true`. O gate Linux device/inode executa antes do Node; depois de start e health, um probe limitado no mesmo CID exige UID não-root e `/`/`/workspace` não graváveis sem tentar escrita, antes da liveness HTTP. Mismatch, health inválido, falha/timeout do isolamento ou liveness inválida removem o contêiner staged e não registram sucesso. Isto não promete atomicidade host/daemon: o gate valida o mount que o daemon efetivamente fixou. Daemon remoto, Docker Desktop ou filesystem que remapeie device/inode falha fechado e não é suportado sem validação equivalente. `DEPLOY_HEALTH_TIMEOUT`, `DEPLOY_HEALTH_INTERVAL` e `DEPLOY_RUNTIME_TIMEOUT` devem ser inteiros positivos; o último usa 10 segundos por padrão. Sucesso grava apenas versão e referência imutável (sem secret) em state local com modo restrito. Temporários são removidos em saída e sinais.

## Estado, rollback e down

```bash
./scripts/deploy.sh status
./scripts/deploy.sh verify
./scripts/deploy.sh 1.2.2  # rollback para target explícito previamente verificado
./scripts/deploy.sh down
```

`status` identifica a versão imutável registrada. Rollback continua sendo deploy explícito de um manifest/digest fixo; `down` alcança somente o projeto e Compose fixos e remove o estado local após sucesso. O Compose não tem volume persistente da aplicação; workspace é read-only. Homepage, proxy, Tailscale e outros serviços não são alterados.
